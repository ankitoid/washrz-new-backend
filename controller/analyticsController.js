import AnalyticsEvent from "../models/analyticsEventSchema.js";

const INDIA_TIMEZONE = "Asia/Kolkata";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DOWNLOAD_EVENT = "download_recorded";
const SIGNUP_EVENT = "sign_up";
const ACTIVE_USER_EVENTS = ["app_open", "session_start", "screen_view"];
const ALLOWED_EVENTS = [
  DOWNLOAD_EVENT,
  SIGNUP_EVENT,
  ...ACTIVE_USER_EVENTS,
];

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const getRangeWindow = ({ range, from, to }) => {
  const now = new Date();

  if (range === "custom" && from && to) {
    return {
      start: startOfDay(new Date(from)),
      end: endOfDay(new Date(to)),
    };
  }

  if (range === "today") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (range === "all") {
    return { start: new Date("2020-01-01T00:00:00.000Z"), end: endOfDay(now) };
  }

  if (range === "monthly") {
    return {
      start: startOfDay(new Date(now.getTime() - 29 * MS_PER_DAY)),
      end: endOfDay(now),
    };
  }

  // Default to weekly (last 7 days)
  return {
    start: startOfDay(new Date(now.getTime() - 6 * MS_PER_DAY)),
    end: endOfDay(now),
  };
};

const getPreviousWindow = ({ start, end }) => {
  const duration = end.getTime() - start.getTime() + 1;
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(end.getTime() - duration),
  };
};

const getPeriodLabel = (date, range) => {
  if (range === "today") {
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      hour12: true,
      timeZone: INDIA_TIMEZONE,
    });
  }

  if (range === "weekly") {
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      timeZone: INDIA_TIMEZONE,
    });
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: INDIA_TIMEZONE,
  });
};

const getTrendBuckets = ({ start, end, range }) => {
  const buckets = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    let bucketEnd;

    if (range === "today") {
      bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000 - 1);
      cursor.setHours(cursor.getHours() + 1);
    } else {
      bucketEnd = endOfDay(bucketStart);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }

    if (bucketEnd > end) bucketEnd = new Date(end);

    buckets.push({
      key: bucketStart.toISOString(),
      label: getPeriodLabel(bucketStart, range),
      start: bucketStart,
      end: bucketEnd,
    });
  }

  return buckets;
};

const getQueryLocationFilters = (query = {}) => ({
  city: normalizeString(query.city),
  zone: normalizeString(query.zone),
});

const withLocationMatch = (match, locationFilters) => {
  const nextMatch = { ...match };

  if (locationFilters.city) {
    nextMatch.city = locationFilters.city;
  }

  if (locationFilters.zone) {
    nextMatch.zone = locationFilters.zone;
  }

  return nextMatch;
};

const buildBaseMatch = ({ start, end, platform, locationFilters = {} }) => {
  const match = {
    occurredAt: {
      $gte: start,
      $lte: end,
    },
  };

  if (platform && platform !== "all") {
    match.platform = platform;
  }

  return withLocationMatch(match, locationFilters);
};

const getPercentChange = (current, previous) => {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const getDistinctIdentityCount = async (match, eventName = null) => {
  const pipeline = [{ $match: match }];

  if (eventName) {
    pipeline[0].$match.eventName = eventName;
  }

  pipeline.push({ $group: { _id: "$identityKey" } });

  const data = await AnalyticsEvent.aggregate(pipeline);
  return data.length;
};

const getDistinctIdentityCountForEvents = async (match, eventNames = []) => {
  const data = await AnalyticsEvent.aggregate([
    {
      $match: {
        ...match,
        eventName: { $in: eventNames },
      },
    },
    { $group: { _id: "$identityKey" } },
  ]);

  return data.length;
};

const getDistinctIdentityByPlatform = async (match) =>
  AnalyticsEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          platform: "$platform",
          identityKey: "$identityKey",
        },
      },
    },
    {
      $group: {
        _id: "$_id.platform",
        users: { $sum: 1 },
      },
    },
    { $sort: { users: -1 } },
  ]);

const getEventMetricSum = async ({ match, eventName }) => {
  return AnalyticsEvent.countDocuments({
    ...match,
    eventName,
  });
};

const getTrendSeries = async ({ buckets, platform, locationFilters }) => {
  const rows = await Promise.all(
    buckets.map(async (bucket) => {
      const match = buildBaseMatch({
        start: bucket.start,
        end: bucket.end,
        platform,
        locationFilters,
      });

      const [activeUsers, downloads] = await Promise.all([
        getDistinctIdentityCountForEvents(match, ACTIVE_USER_EVENTS),
        getEventMetricSum({ match, eventName: DOWNLOAD_EVENT }),
      ]);

      return {
        bucketKey: bucket.key,
        label: bucket.label,
        activeUsers,
        downloads,
      };
    }),
  );

  return rows;
};

const buildLatestLocationProjection = (prefix = "$latest") => ({
  city: `${prefix}.city`,
  zone: `${prefix}.zone`,
});

const getLatestUserLocations = async ({ match, eventNames }) => {
  const eventMatch = {
    ...match,
    eventName: { $in: eventNames },
  };

  return AnalyticsEvent.aggregate([
    { $match: eventMatch },
    { $sort: { identityKey: 1, occurredAt: -1, createdAt: -1 } },
    {
      $group: {
        _id: "$identityKey",
        latest: { $first: "$$ROOT" },
      },
    },
    {
      $project: {
        _id: 0,
        identityKey: "$_id",
        ...buildLatestLocationProjection(),
      },
    },
  ]);
};

const toDistribution = (rows, field) => {
  const counts = new Map();

  rows.forEach((row) => {
    const key = normalizeString(row[field]);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, users]) => ({ label, users }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 10);
};

const sanitizeEvent = (payload = {}) => {
  const city = normalizeString(payload.city);
  const zone = normalizeString(payload.zone);

  return {
    eventName: normalizeString(payload.eventName) || "",
    identityKey: normalizeString(payload.identityKey) || "",
    platform: normalizeString(payload.platform) || "unknown",
    city,
    zone,
    occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
  };
};

export const ingestAnalyticsEvent = async (req, res) => {
  try {
    const payload = sanitizeEvent(req.body);

    if (!payload.eventName || !payload.identityKey) {
      return res.status(400).json({
        success: false,
        message: "eventName and identityKey are required",
      });
    }

    if (!ALLOWED_EVENTS.includes(payload.eventName)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported eventName: ${payload.eventName}`,
      });
    }

    const event = await AnalyticsEvent.create(payload);

    return res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const ingestAnalyticsBatch = async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];

    if (!events.length) {
      return res.status(400).json({
        success: false,
        message: "events array is required",
      });
    }

    const docs = events
      .map(sanitizeEvent)
      .filter(
        (event) =>
          event.eventName &&
          event.identityKey &&
          ALLOWED_EVENTS.includes(event.eventName),
      );

    if (!docs.length) {
      return res.status(400).json({
        success: false,
        message: "No valid events found in payload",
      });
    }

    const inserted = await AnalyticsEvent.insertMany(docs, { ordered: false });

    return res.status(201).json({
      success: true,
      insertedCount: inserted.length,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAnalyticsOverview = async (req, res) => {
  try {
    const range = req.query.range || "weekly";
    const platform = req.query.platform || "all";
    const locationFilters = getQueryLocationFilters(req.query);
    const { start, end } = getRangeWindow({
      range,
      from: req.query.from,
      to: req.query.to,
    });
    const previous = getPreviousWindow({ start, end });

    const currentMatch = buildBaseMatch({
      start,
      end,
      platform,
      locationFilters,
    });
    const previousMatch = buildBaseMatch({
      start: previous.start,
      end: previous.end,
      platform,
      locationFilters,
    });

    const [
      totalDownloads,
      previousDownloads,
      activeUsers,
      previousActiveUsers,
      newUsers,
      previousNewUsers,
      iosDownloads,
      previousIosDownloads,
      androidDownloads,
      previousAndroidDownloads,
      osBreakdown,
      activeUserLocations,
      trend,
    ] = await Promise.all([
      getEventMetricSum({
        match: currentMatch,
        eventName: DOWNLOAD_EVENT,
      }),
      getEventMetricSum({
        match: previousMatch,
        eventName: DOWNLOAD_EVENT,
      }),
      getDistinctIdentityCountForEvents(currentMatch, ACTIVE_USER_EVENTS),
      getDistinctIdentityCountForEvents(previousMatch, ACTIVE_USER_EVENTS),
      getDistinctIdentityCount(currentMatch, SIGNUP_EVENT),
      getDistinctIdentityCount(previousMatch, SIGNUP_EVENT),
      getEventMetricSum({
        match: { ...currentMatch, platform: "ios" },
        eventName: DOWNLOAD_EVENT,
      }),
      getEventMetricSum({
        match: { ...previousMatch, platform: "ios" },
        eventName: DOWNLOAD_EVENT,
      }),
      getEventMetricSum({
        match: { ...currentMatch, platform: "android" },
        eventName: DOWNLOAD_EVENT,
      }),
      getEventMetricSum({
        match: { ...previousMatch, platform: "android" },
        eventName: DOWNLOAD_EVENT,
      }),
      getDistinctIdentityByPlatform(currentMatch),
      getLatestUserLocations({
        match: currentMatch,
        eventNames: ACTIVE_USER_EVENTS,
      }),
      getTrendSeries({
        buckets: getTrendBuckets({ start, end, range }),
        platform,
        locationFilters,
      }),
    ]);

    const totalPlatformUsers = osBreakdown.reduce((sum, row) => sum + row.users, 0);
    const cityDistribution = toDistribution(activeUserLocations, "city");
    const zoneDistribution = toDistribution(activeUserLocations, "zone");

    return res.status(200).json({
      success: true,
      filters: {
        range,
        platform,
        ...locationFilters,
        from: start,
        to: end,
      },
      cards: {
        totalDownloads: {
          value: totalDownloads,
          changePct: getPercentChange(totalDownloads, previousDownloads),
        },
        iosDownloads: {
          value: iosDownloads,
          changePct: getPercentChange(iosDownloads, previousIosDownloads),
        },
        androidDownloads: {
          value: androidDownloads,
          changePct: getPercentChange(androidDownloads, previousAndroidDownloads),
        },
        activeUsers: {
          value: activeUsers,
          changePct: getPercentChange(activeUsers, previousActiveUsers),
        },
        newUsers: {
          value: newUsers,
          changePct: getPercentChange(newUsers, previousNewUsers),
        },
      },
      trends: trend,
      osBreakdown: osBreakdown.map((row) => ({
        platform: row._id || "unknown",
        users: row.users,
        sharePct: totalPlatformUsers
          ? Number(((row.users / totalPlatformUsers) * 100).toFixed(1))
          : 0,
      })),
      cityDistribution: cityDistribution.map((row) => ({
        city: row.label,
        users: row.users,
      })),
      zoneDistribution: zoneDistribution.map((row) => ({
        zone: row.label,
        users: row.users,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
