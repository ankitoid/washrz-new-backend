import AWS from "aws-sdk";
import multer from "multer";
import Trip from "../models/tripSchema.js";
import DailySummary from "../models/dailySummary.js";
import User from "../models/userModel.js";
import catchAsync from "../utills/catchAsync.js";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
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
const updateDailySummary = async (riderId, date, tripData, isStart = false) => {
  const dayString = getDayString(date);
  
  if (isStart) {
    // Update daily summary for start
    await DailySummary.findOneAndUpdate(
      { rider: riderId, date: dayString },
      {
        $inc: { totalDistance: 0 }, // Initialize if doesn't exist
        $push: {
          startImages: {
            imageUrl: tripData.startImage,
            timestamp: date,
            tripId: tripData._id
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
        $inc: { totalDistance: tripData.distance },
        $push: {
          endImages: {
            imageUrl: tripData.endImage,
            timestamp: new Date(),
            tripId: tripData._id
          },
          trips: {
            tripId: tripData._id,
            startTime: tripData.createdAt,
            endTime: new Date(),
            startKm: tripData.startKm,
            endKm: tripData.endKm,
            distance: tripData.distance
          }
        }
      },
      { upsert: true, new: true }
    );
  }
};

// POST /trips/start
export const startTrip = catchAsync(async (req, res, next) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload error", err });

    const { riderId, startKm } = req.body;
    if (!riderId || startKm == null) {
      return res.status(400).json({ message: "riderId and startKm are required" });
    }

    // Check if rider has an active trip
    const activeTrip = await Trip.findOne({ 
      rider: riderId, 
      status: "started" 
    });
    
    if (activeTrip) {
      return res.status(400).json({ 
        message: "You have an active trip. Please end it before starting a new one.",
        activeTripId: activeTrip._id 
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

    // Create new trip
    const trip = await Trip.create({
      rider: riderId,
      date: now,
      startKm: Number(startKm),
      startImage: startImageUrl,
      status: "started",
    });

    // Update daily summary with start info
    await updateDailySummary(riderId, now, {
      _id: trip._id,
      startImage: startImageUrl
    }, true);

    res.status(201).json({ 
      message: "Trip started successfully", 
      trip 
    });
  });
});

// PUT /trips/:tripId/end
export const endTrip = catchAsync(async (req, res, next) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload error", err });

    const { tripId } = req.params;
    const { endKm } = req.body;
    
    if (!tripId || endKm == null) {
      return res.status(400).json({ message: "tripId and endKm are required" });
    }

    // Find and validate trip
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    
    if (trip.status !== "started") {
      return res.status(400).json({ message: "Trip is not in started state" });
    }

    const numericEndKm = Number(endKm);
    if (numericEndKm < trip.startKm) {
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

    const distance = numericEndKm - trip.startKm;

    // Update trip
    trip.endKm = numericEndKm;
    trip.endImage = endImageUrl;
    trip.distance = distance;
    trip.status = "ended";
    await trip.save();

    // Update user's total km
    const user = await User.findByIdAndUpdate(
      trip.rider, 
      { $inc: { totalKm: distance } }, 
      { new: true }
    );

    // Update daily summary
    await updateDailySummary(
      trip.rider, 
      trip.date, 
      {
        _id: trip._id,
        startKm: trip.startKm,
        endKm: trip.endKm,
        distance: trip.distance,
        startImage: trip.startImage,
        endImage: trip.endImage,
        createdAt: trip.createdAt
      }, 
      false
    );

    res.status(200).json({ 
      message: "Trip ended successfully", 
      trip,
      userTotalKm: user.totalKm
    });
  });
});

// GET /trips/daily/:riderId?date=YYYY-MM-DD
export const getDailySummary = catchAsync(async (req, res, next) => {
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

  // Get all trips for the day
  const startOfDay = new Date(targetDate);
  const endOfDay = new Date(targetDate);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const dailyTrips = await Trip.find({
    rider: riderId,
    date: { $gte: startOfDay, $lt: endOfDay },
    status: "ended"
  }).sort({ date: -1 });

  // Calculate total distance for the day
  const totalDailyDistance = dailyTrips.reduce((sum, trip) => sum + trip.distance, 0);

  res.status(200).json({
    date: targetDate,
    dailySummary: dailySummary || {
      date: targetDate,
      totalDistance: 0,
      startImages: [],
      endImages: [],
      trips: []
    },
    dailyTrips,
    totalDailyDistance,
    tripCount: dailyTrips.length
  });
});

// GET /trips/custom-summary/:riderId
export const getCustomSummary = catchAsync(async (req, res, next) => {
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
    // Custom summary from lastResetAt to now
    startDate = user.lastResetAt;
    summaryType = "sinceReset";
  } else {
    // If no reset, show all-time summary
    startDate = new Date(0); // Beginning of time
    summaryType = "allTime";
  }

  // Get trips since last reset
  const tripsSinceReset = await Trip.find({
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
  const totalDistance = tripsSinceReset.reduce((sum, trip) => sum + trip.distance, 0);
  const tripCount = tripsSinceReset.length;
  const daysWithTrips = dailySummaries.length;
  
  // Calculate average per day
  const daysSinceReset = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
  const avgPerDay = daysSinceReset > 0 ? totalDistance / daysSinceReset : 0;

  res.status(200).json({
    summaryType,
    startDate: user.lastResetAt || "No reset date found",
    endDate: new Date(),
    totalDistance,
    userTotalKm: user.totalKm, // Should match
    tripCount,
    daysWithTrips,
    daysSinceReset: daysSinceReset > 0 ? daysSinceReset : "N/A",
    averagePerDay: avgPerDay.toFixed(2),
    dailySummaries,
    trips: tripsSinceReset.slice(0, 50) // Limit trips for response size
  });
});

// GET /trips/:riderId?startDate=&endDate=&page=&limit=
export const getTrips = catchAsync(async (req, res, next) => {
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
      end.setDate(end.getDate() + 1); // Include the entire end date
      query.date.$lt = end;
    }
  }

  const skip = (page - 1) * limit;

  const [trips, total] = await Promise.all([
    Trip.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Trip.countDocuments(query)
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
    trips,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit)
  });
});

// POST /trips/reset/:riderId
export const resetTotalKm = catchAsync(async (req, res, next) => {
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

// GET /trips/monthly/:riderId?year=&month=
export const getMonthlySummary = catchAsync(async (req, res, next) => {
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

// GET /trips/active/:riderId
export const getActiveTrip = catchAsync(async (req, res) => {
  const { riderId } = req.params;

  if (!riderId) {
    return res.status(400).json({ message: "riderId is required" });
  }

  const activeTrip = await Trip.findOne({
    rider: riderId,
    status: "started",
  }).sort({ createdAt: -1 });

  if (!activeTrip) {
    return res.status(200).json({
      hasActiveTrip: false,
      trip: null,
    });
  }

  res.status(200).json({
    hasActiveTrip: true,
    trip: {
      _id: activeTrip._id,
      startKm: activeTrip.startKm,
      startImage: activeTrip.startImage,
      startedAt: activeTrip.createdAt,
      date: activeTrip.date,
    },
  });
});