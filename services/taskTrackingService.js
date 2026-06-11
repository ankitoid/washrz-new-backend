import TaskTrackingLeg from "../models/taskTrackingLegSchema.js";
import mongoose from "mongoose";
import Order from "../models/orderSchema.js";
import Pickup from "../models/pickupSchema.js";
import User from "../models/userModel.js";

const VALID_TASK_TYPES = new Set(["pickup", "delivery", "return_to_plant"]);
const MAX_STORED_POINTS_PER_LEG = 500;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPoint = (lat, lng) => ({
  type: "Point",
  coordinates: [toNumber(lng), toNumber(lat)],
});

const toPointFromCoordinate = (coordinate) => {
  if (!coordinate) return undefined;

  if (Array.isArray(coordinate.coordinates)) {
    return {
      type: "Point",
      coordinates: [
        toNumber(coordinate.coordinates[0]),
        toNumber(coordinate.coordinates[1]),
      ],
    };
  }

  const lat = coordinate.latitude ?? coordinate.lat;
  const lng = coordinate.longitude ?? coordinate.lng;
  if (lat == null || lng == null) return undefined;

  return toPoint(lat, lng);
};

const toTimelineLocation = (location) => {
  const point = toPointFromCoordinate(location);
  if (!point) return undefined;

  return {
    latitude: point.coordinates[1],
    longitude: point.coordinates[0],
  };
};

const appendTaskNavigationTimeline = async ({
  event,
  trackingLegId,
  riderId,
  taskId,
  taskType,
  location,
  totalDistanceKm = 0,
}) => {
  if (!taskId || !["pickup", "delivery"].includes(taskType)) return null;

  const rider = riderId
    ? await User.findById(riderId).select("name").lean()
    : null;
  const timelineEntry = {
    event,
    trackingLegId,
    taskType,
    riderId: riderId ? String(riderId) : undefined,
    riderName: rider?.name,
    location: toTimelineLocation(location),
    totalDistanceKm: toNumber(totalDistanceKm),
    message:
      event === "reached_location"
        ? "Rider reached the location"
        : "Rider started navigation",
    createdAt: new Date(),
  };

  const Model = taskType === "pickup" ? Pickup : Order;
  return Model.findByIdAndUpdate(
    {
      _id: taskId,
      navigationTimeline: {
        $not: {
          $elemMatch: {
            event,
            trackingLegId,
          },
        },
      },
    },
    { $push: { navigationTimeline: timelineEntry } },
    { new: true },
  );
};

export const upsertTaskTrackingFromLocation = async ({
  riderId,
  lat,
  lng,
  speed = 0,
  bearing = 0,
  batteryLevel = 100,
  taskTracking,
}) => {
  if (!taskTracking?.trackingLegId) return null;

  const taskType = taskTracking.taskType;
  if (!VALID_TASK_TYPES.has(taskType)) return null;

  const location = toPoint(lat, lng);
  const totalDistanceKm = toNumber(taskTracking.totalDistanceKm);
  const distanceFromPreviousKm = toNumber(taskTracking.distanceFromPreviousKm);
  const now = new Date();

  return TaskTrackingLeg.findOneAndUpdate(
    { trackingLegId: taskTracking.trackingLegId },
    {
      $setOnInsert: {
        trackingLegId: taskTracking.trackingLegId,
        riderId,
        taskId: String(taskTracking.taskId),
        taskType,
        destination: toPointFromCoordinate(taskTracking.destination),
        startLocation: location,
        startedAt: now,
      },
      $set: {
        riderId,
        taskId: String(taskTracking.taskId),
        taskType,
        status: "active",
        lastLocation: location,
        totalDistanceKm,
      },
      $inc: { pointsCount: 1 },
      $push: {
        points: {
          $each: [
            {
              location,
              distanceFromPreviousKm,
              totalDistanceKm,
              speed: toNumber(speed),
              bearing: toNumber(bearing),
              batteryLevel: toNumber(batteryLevel, 100),
              recordedAt: now,
            },
          ],
          $slice: -MAX_STORED_POINTS_PER_LEG,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const startTaskTrackingLeg = async ({
  riderId,
  trackingLegId,
  taskId,
  taskType,
  destination,
}) => {
  if (!trackingLegId || !riderId || !taskId || !VALID_TASK_TYPES.has(taskType)) {
    return null;
  }

  const trackingLeg = await TaskTrackingLeg.findOneAndUpdate(
    { trackingLegId },
    {
      $setOnInsert: {
        trackingLegId,
        riderId,
        taskId: String(taskId),
        taskType,
        destination: toPointFromCoordinate(destination),
        status: "active",
        startedAt: new Date(),
      },
      $set: {
        riderId,
        taskId: String(taskId),
        taskType,
        destination: toPointFromCoordinate(destination),
        status: "active",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await appendTaskNavigationTimeline({
    event: "navigation_started",
    trackingLegId,
    riderId,
    taskId,
    taskType,
    location: trackingLeg.startLocation,
  });

  return trackingLeg;
};

export const completeTaskTrackingLeg = async ({
  riderId,
  trackingLegId,
  taskId,
  taskType,
  totalDistanceKm,
  endLocation,
}) => {
  if (!trackingLegId) return null;

  const update = {
    status: "completed",
    endedAt: new Date(),
  };

  if (riderId) update.riderId = riderId;
  if (taskId) update.taskId = String(taskId);
  if (VALID_TASK_TYPES.has(taskType)) update.taskType = taskType;
  if (totalDistanceKm != null) update.totalDistanceKm = toNumber(totalDistanceKm);

  const point = toPointFromCoordinate(endLocation);
  if (point) {
    update.endLocation = point;
    update.lastLocation = point;
  }

  const trackingLeg = await TaskTrackingLeg.findOneAndUpdate(
    { trackingLegId },
    { $set: update },
    { new: true },
  );

  if (trackingLeg) {
    await appendTaskNavigationTimeline({
      event: "reached_location",
      trackingLegId,
      riderId: trackingLeg.riderId,
      taskId: trackingLeg.taskId,
      taskType: trackingLeg.taskType,
      location: point || trackingLeg.lastLocation,
      totalDistanceKm: trackingLeg.totalDistanceKm,
    });
  }

  return trackingLeg;
};

const getKolkataDateKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getKolkataDayRange = (dateKey = getKolkataDateKey()) => {
  const start = new Date(`${dateKey}T00:00:00+05:30`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, dateKey };
};

export const getRiderDailyTrackingSummary = async (riderId, date) => {
  const { start, end, dateKey } = getKolkataDayRange(date);
  const riderObjectId = mongoose.Types.ObjectId.isValid(riderId)
    ? new mongoose.Types.ObjectId(riderId)
    : riderId;

  const summary = await TaskTrackingLeg.aggregate([
    {
      $match: {
        riderId: riderObjectId,
        status: "completed",
        endedAt: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: "$taskType",
        totalDistanceKm: { $sum: "$totalDistanceKm" },
        legs: { $sum: 1 },
      },
    },
  ]);

  const byType = summary.reduce((acc, item) => {
    acc[item._id] = {
      totalDistanceKm: Number(item.totalDistanceKm.toFixed(3)),
      legs: item.legs,
    };
    return acc;
  }, {});

  const totalDistanceKm = summary.reduce(
    (sum, item) => sum + item.totalDistanceKm,
    0,
  );

  return {
    date: dateKey,
    totalDistanceKm: Number(totalDistanceKm.toFixed(3)),
    byType,
  };
};
