import AWS from "aws-sdk";
import multer from "multer";
import Shift from "../models/shiftSchema.js";
import VrpTrip from "../models/Trip.js";
import DailySummary from "../models/dailySummary.js";
import User from "../models/userModel.js";
import catchAsync from "../utills/catchAsync.js";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
  httpOptions: {
    timeout: 8000,
    connectTimeout: 8000,
  },
  maxRetries: 1,
});

// Helper function to get YYYY-MM-DD format
const getDayString = (date) => {
  return date.toISOString().split('T')[0];
};

const uploadToS3Buffer = (file, bucketName, folder = "riderTripPic") => {
  const params = {
    Bucket: bucketName,
    Key: `${folder}/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  return s3.upload(params).promise();
};

const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 20 * 1024 * 1024 },
}).single("image");

// Helper to update daily summary
const updateDailySummary = async (riderId, date, shiftData, isStart = false) => {
  const dayString = getDayString(date);
  
  if (isStart) {
    // Update daily summary for start
    await DailySummary.findOneAndUpdate(
      { rider: riderId, date: dayString },
      {
        $inc: { totalDistance: 0 }, // Initialize if doesn't exist
        $push: {
          startImages: {
            imageUrl: shiftData.startImage,
            timestamp: date,
            tripId: shiftData._id
          }
        }
      },
      { upsert: true, new: true }
    );
  } else {
    // Update daily summary for end
    await DailySummary.findOneAndUpdate(
      { rider: riderId, date: dayString },
      {
        $inc: { totalDistance: shiftData.distance },
        $push: {
          endImages: {
            imageUrl: shiftData.endImage,
            timestamp: new Date(),
            tripId: shiftData._id
          },
          trips: {
            tripId: shiftData._id,
            startTime: shiftData.createdAt,
            endTime: new Date(),
            startKm: shiftData.startKm,
            endKm: shiftData.endKm,
            distance: shiftData.distance
          }
        }
      },
      { upsert: true, new: true }
    );
  }
};

// POST /shifts/start
export const startShift = catchAsync(async (req, res, next) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload error", err });

    try {
      const { riderId, startKm } = req.body;
      if (!riderId || startKm == null) {
        return res.status(400).json({ message: "riderId and startKm are required" });
      }

      // Check if rider has an active shift
      const activeShift = await Shift.findOne({ 
        rider: riderId, 
        status: "started" 
      });
      
      if (activeShift) {
        return res.status(400).json({ 
          message: "You have an active shift. Please end it before starting a new one.",
          activeShiftId: activeShift._id 
        });
      }

      const now = new Date();
      let startImageUrl = null;
      
      if (req.file) {
        const uploaded = await uploadToS3Buffer(
          req.file,
          process.env.AWS_S3_BUCKET_NAME,
          "riderTripPic/start"
        );
        startImageUrl = uploaded.Location;
      }

      // Check if there is an active VRP Trip assigned to this rider
      const activeVrpTrip = await VrpTrip.findOne({
        riderId,
        status: { $in: ["assigned", "in_progress"] }
      });

      let vrpTripId = null;
      if (activeVrpTrip) {
        vrpTripId = activeVrpTrip._id;
        activeVrpTrip.status = "in_progress";
        await activeVrpTrip.save({ validateBeforeSave: false });
      }

      // Create new shift
      const shift = await Shift.create({
        rider: riderId,
        date: now,
        startKm: Number(startKm),
        startImage: startImageUrl,
        status: "started",
        vrpTripId,
      });

      // Update daily summary with start info
      await updateDailySummary(riderId, now, {
        _id: shift._id,
        startImage: startImageUrl
      }, true);

      res.status(201).json({ 
        message: "Shift started successfully", 
        trip: shift // Keep the key name as 'trip' for API compatibility
      });
    } catch (error) {
      console.error("Error in startShift callback:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Failed to start shift due to S3 upload or database issue."
      });
    }
  });
});

// PUT /shifts/:shiftId/end
export const endShift = catchAsync(async (req, res, next) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload error", err });

    try {
      const shiftId = req.params.shiftId || req.params.tripId; // Support both tripId and shiftId params
      const { endKm } = req.body;
      
      if (!shiftId || endKm == null) {
        return res.status(400).json({ message: "shiftId and endKm are required" });
      }

      // Find and validate shift
      const shift = await Shift.findById(shiftId);
      if (!shift) return res.status(404).json({ message: "Shift not found" });
      
      if (shift.status !== "started") {
        return res.status(400).json({ message: "Shift is not in started state" });
      }

      // Check if the rider has an active uncompleted VRP Trip
      const uncompletedVrpTrip = await VrpTrip.findOne({
        riderId: shift.rider,
        status: { $in: ["assigned", "in_progress"] }
      });

      if (uncompletedVrpTrip) {
        return res.status(400).json({
          status: "error",
          message: "You cannot end your shift because you have uncompleted stops on your route. Please complete all pickups and deliveries first."
        });
      }

      const numericEndKm = Number(endKm);
      if (numericEndKm < shift.startKm) {
        return res.status(400).json({ 
          message: "endKm must be greater than or equal to startKm" 
        });
      }

      // Upload end image if exists
      let endImageUrl = null;
      if (req.file) {
        const uploaded = await uploadToS3Buffer(
          req.file,
          process.env.AWS_S3_BUCKET_NAME,
          "riderTripPic/end"
        );
        endImageUrl = uploaded.Location;
      }

      const distance = numericEndKm - shift.startKm;

      // Get the VRP Trip for distance comparison
      const vrpTrip = shift.vrpTripId ? await VrpTrip.findById(shift.vrpTripId) : await VrpTrip.findOne({
        riderId: shift.rider,
        status: "completed"
      }).sort({ updatedAt: -1 });

      // Update shift
      shift.endKm = numericEndKm;
      shift.endImage = endImageUrl;
      shift.distance = distance;
      shift.status = "ended";
      shift.actualDistance = distance;
      if (vrpTrip) {
        shift.optimizedDistance = vrpTrip.distanceKm || 0;
        shift.distanceDiff = distance - (vrpTrip.distanceKm || 0);
      }
      await shift.save({ validateBeforeSave: false });

      // Update user's total km
      const user = await User.findByIdAndUpdate(
        shift.rider, 
        { $inc: { totalKm: distance } }, 
        { new: true }
      );

      // Update daily summary
      await updateDailySummary(
        shift.rider, 
        shift.date, 
        {
          _id: shift._id,
          startKm: shift.startKm,
          endKm: shift.endKm,
          distance: shift.distance,
          startImage: shift.startImage,
          endImage: shift.endImage,
          createdAt: shift.createdAt
        }, 
        false
      );

      res.status(200).json({ 
        message: "Shift ended successfully", 
        trip: shift, // Keep the key name as 'trip' for API compatibility
        userTotalKm: user.totalKm
      });
    } catch (error) {
      console.error("Error in endShift callback:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Failed to end shift due to S3 upload or database issue."
      });
    }
  });
});

// GET /shifts/daily/:riderId?date=YYYY-MM-DD
export const getDailyShiftSummary = catchAsync(async (req, res, next) => {
  const { riderId } = req.params;
  const { date } = req.query;
  
  if (!riderId) {
    return res.status(400).json({ message: "riderId is required" });
  }

  const targetDate = date || getDayString(new Date());
  
  // Get daily summary
  const dailySummary = await DailySummary.findOne({
    rider: riderId,
    date: targetDate
  }).populate('trips.tripId', 'startKm endKm distance startImage endImage createdAt');

  // Get all shifts for the day
  const startOfDay = new Date(targetDate);
  const endOfDay = new Date(targetDate);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const dailyShifts = await Shift.find({
    rider: riderId,
    date: { $gte: startOfDay, $lt: endOfDay },
    status: "ended"
  }).sort({ date: -1 });

  // Calculate total distance for the day
  const totalDailyDistance = dailyShifts.reduce((sum, s) => sum + s.distance, 0);

  res.status(200).json({
    date: targetDate,
    dailySummary: dailySummary || {
      date: targetDate,
      totalDistance: 0,
      startImages: [],
      endImages: [],
      trips: []
    },
    dailyTrips: dailyShifts, // Keep key name for API compatibility
    totalDailyDistance,
    tripCount: dailyShifts.length
  });
});

// GET /shifts/custom-summary/:riderId
export const getCustomShiftSummary = catchAsync(async (req, res, next) => {
  const { riderId } = req.params;
  
  if (!riderId) {
    return res.status(400).json({ message: "riderId is required" });
  }

  // Get user with lastResetAt
  const user = await User.findById(riderId).select("totalKm lastResetAt");
  
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let startDate;
  let summaryType = "complete";
  
  if (user.lastResetAt) {
    startDate = user.lastResetAt;
    summaryType = "sinceReset";
  } else {
    startDate = new Date(0);
    summaryType = "allTime";
  }

  // Get shifts since last reset
  const shiftsSinceReset = await Shift.find({
    rider: riderId,
    date: { $gte: startDate },
    status: "ended"
  }).sort({ date: -1 });

  // Get daily summaries since last reset
  const dailySummaries = await DailySummary.find({
    rider: riderId,
    date: { 
      $gte: getDayString(startDate),
      $lte: getDayString(new Date())
    }
  }).sort({ date: -1 });

  // Calculate statistics
  const totalDistance = shiftsSinceReset.reduce((sum, s) => sum + s.distance, 0);
  const tripCount = shiftsSinceReset.length;
  const daysWithTrips = dailySummaries.length;
  
  // Calculate average per day
  const daysSinceReset = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
  const avgPerDay = daysSinceReset > 0 ? totalDistance / daysSinceReset : 0;

  res.status(200).json({
    summaryType,
    startDate: user.lastResetAt || "No reset date found",
    endDate: new Date(),
    totalDistance,
    userTotalKm: user.totalKm,
    tripCount,
    daysWithTrips,
    daysSinceReset: daysSinceReset > 0 ? daysSinceReset : "N/A",
    averagePerDay: avgPerDay.toFixed(2),
    dailySummaries,
    trips: shiftsSinceReset.slice(0, 50) // Keep key name for API compatibility
  });
});

// GET /shifts/:riderId?startDate=&endDate=&page=&limit=
export const getShifts = catchAsync(async (req, res, next) => {
  const { riderId } = req.params;
  const { startDate, endDate, page = 1, limit = 20 } = req.query;
  
  if (!riderId) {
    return res.status(400).json({ message: "riderId is required" });
  }

  const query = { rider: riderId, status: "ended" };
  
  // Add date range if provided
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query.date.$lt = end;
    }
  }

  const skip = (page - 1) * limit;

  const [shifts, total] = await Promise.all([
    Shift.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Shift.countDocuments(query)
  ]);

  // Get user info
  const user = await User.findById(riderId).select("totalKm lastResetAt name");

  res.status(200).json({
    rider: {
      id: user._id,
      name: user.name,
      totalKm: user.totalKm,
      lastResetAt: user.lastResetAt
    },
    trips: shifts, // Keep key name for API compatibility
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit)
  });
});

// POST /shifts/reset/:riderId
export const resetShiftTotalKm = catchAsync(async (req, res, next) => {
  const { riderId } = req.params;
  
  if (!riderId) {
    return res.status(400).json({ message: "riderId required" });
  }

  const user = await User.findByIdAndUpdate(
    riderId,
    { 
      totalKm: 0, 
      lastResetAt: new Date() 
    },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json({ 
    message: "Total km reset to 0", 
    user: {
      id: user._id,
      name: user.name,
      totalKm: user.totalKm,
      lastResetAt: user.lastResetAt
    }
  });
});

// GET /shifts/monthly/:riderId?year=&month=
export const getMonthlyShiftSummary = catchAsync(async (req, res, next) => {
  const { riderId } = req.params;
  const { year, month } = req.query;
  
  if (!riderId) {
    return res.status(400).json({ message: "riderId is required" });
  }

  const currentYear = year || new Date().getFullYear();
  const currentMonth = month || new Date().getMonth() + 1;
  
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0);
  
  const dailySummaries = await DailySummary.find({
    rider: riderId,
    date: { 
      $gte: getDayString(startDate),
      $lte: getDayString(endDate)
    }
  }).sort({ date: 1 });

  const totalMonthlyDistance = dailySummaries.reduce((sum, day) => {
    return sum + (day.totalDistance || 0);
  }, 0);

  res.status(200).json({
    month: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
    totalDistance: totalMonthlyDistance,
    dailySummaries,
    daysWithTrips: dailySummaries.length,
    averagePerDay: dailySummaries.length > 0 
      ? (totalMonthlyDistance / dailySummaries.length).toFixed(2) 
      : 0
  });
});

// GET /shifts/active/:riderId
export const getActiveShift = catchAsync(async (req, res) => {
  const { riderId } = req.params;

  if (!riderId) {
    return res.status(400).json({ message: "riderId is required" });
  }

  const activeShift = await Shift.findOne({
    rider: riderId,
    status: "started",
  }).sort({ createdAt: -1 });

  if (!activeShift) {
    return res.status(200).json({
      hasActiveTrip: false, // Keep key name for API compatibility
      trip: null,
    });
  }

  res.status(200).json({
    hasActiveTrip: true,
    trip: {
      _id: activeShift._id,
      startKm: activeShift.startKm,
      startImage: activeShift.startImage,
      startedAt: activeShift.createdAt,
      date: activeShift.date,
    },
  });
});

// GET /shifts/riders-summary
export const getRidersShiftSummary = catchAsync(async (req, res, next) => {
  const {
    date = new Date().toISOString().split("T")[0],
    page = 1,
    limit = 50,
    search = "",
    sortField = "dailyDistance",
    sortOrder = "desc",
  } = req.query;

  const pageNum = Math.max(1, Number(page));
  const perPage = Math.max(1, Math.min(500, Number(limit)));
  const skip = (pageNum - 1) * perPage;
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  const match = { role: "rider" };
  if (search && String(search).trim() !== "") {
    const re = { $regex: String(search).trim(), $options: "i" };
    match.$or = [{ name: re }, { phone: re }];
  }
  const pipeline = [ { $match: match },
    {
      $lookup: {
        from: "dailysummaries",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$rider", "$$userId"] },
                  { $eq: ["$date", date] },
                ],
              },
            },
          },
          {
            $project: {
              totalDistance: 1,
              startImages: 1,
              endImages: 1,
              _id: 0,
            },
          },
        ],
        as: "daily",
      },
    },

    // bring dailyDistance up and default to 0
    {
      $addFields: {
        dailyDistance: {
          $ifNull: [{ $arrayElemAt: ["$daily.totalDistance", 0] }, 0],
        },
        startImages: {
          $ifNull: [{ $arrayElemAt: ["$daily.startImages", 0] }, []],
        },
        endImages: {
          $ifNull: [{ $arrayElemAt: ["$daily.endImages", 0] }, []],
        },
      },
    },

    // project only the fields we want
    {
      $project: {
        daily: 0,
      },
    },

    // sorting
    { $sort: { [sortField]: sortDirection, _id: 1 } },

    // facet to get data + total count
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: perPage }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const result = await User.aggregate(pipeline).exec();
  const data = (result[0] && result[0].data) || [];
  const totalCount = (result[0] && result[0].totalCount[0] && result[0].totalCount[0].count) || 0;

  const formatted = data.map((u) => ({
    id: u._id,
    name: u.name,
    phone: u.phone || null,
    totalKm: u.totalKm || 0,
    lastResetAt: u.lastResetAt || null,
    dailyDistance: typeof u.dailyDistance === "number" ? u.dailyDistance : Number(u.dailyDistance || 0),
    startImages: Array.isArray(u.startImages) ? u.startImages : [],
    endImages: Array.isArray(u.endImages) ? u.endImages : [],
  }));

  res.status(200).json({
    date,
    page: pageNum,
    limit: perPage,
    total: totalCount,
    totalPages: Math.ceil(totalCount / perPage),
    riders: formatted,
  });
});
