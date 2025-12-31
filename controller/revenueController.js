import order from "../models/orderSchema.js";
import catchAsync from "../utills/catchAsync.js";
import User from "../models/userModel.js";

const ALLOWED_ROLES = ["admin", "superadmin"];

// Helper: check role
const ensureAdmin = (user) => {
  return user && ALLOWED_ROLES.includes(user.role);
};

// Minimal helpers to normalize day boundaries
const startOfDay = (input) => {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (input) => {
  const d = new Date(input);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Helper: generate array of date strings between start and end (inclusive) in YYYY-MM-DD
const datesBetween = (start, end) => {
  const arr = [];
  const cur = new Date(start);
  while (cur <= end) {
    arr.push(
      cur
        .toLocaleDateString("en-CA") // yields YYYY-MM-DD in most environments; safe fallback
        .replace(/\//g, "-")
    );
    cur.setDate(cur.getDate() + 1);
  }
  return arr;
};

// Get revenue by date range
export const getRevenue = catchAsync(async (req, res, next) => {
  const { email, startDate, endDate, view } = req.query;

  // Fetch the plant name associated with this email
  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  if (!ensureAdmin(user)) {
    return res.status(403).json({ message: "Forbidden: admins only" });
  }

  const plantName = user.plant;

  let start, end;
  const today = startOfDay(new Date());

  // Determine date range based on view
  switch (view) {
    case "today":
      start = startOfDay(today);
      end = endOfDay(today);
      break;

    case "weekly":
      // Last 7 days including today: start = today - 6 days
      {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6); // last 7 days including today
        start = startOfDay(weekStart);
        end = endOfDay(today);
      }
      break;

    case "monthly":
      {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        start = startOfDay(monthStart);

        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end = endOfDay(monthEnd);
      }
      break;

    case "custom":
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ message: "Start and end dates required for custom view" });
      }
      start = startOfDay(new Date(startDate));
      end = endOfDay(new Date(endDate));
      break;

    default:
      start = startOfDay(today);
      end = endOfDay(today);
  }

  // Define the statuses for "order revenue" (processing-stage revenue)
  const orderRevenueStatuses = [
    "processing",
    "ready for delivery",
    "delivery rider assigned",
  ];

  // ----------------------
  // SUMMARY PIPELINE
  // ----------------------
  // We include documents if either createdAt or updatedAt falls in range (so payments updated in this range are considered).
  // But inside $group we ensure:
  //  - orderRevenue is counted only when createdAt is in range AND status in orderRevenueStatuses
  //  - paymentReceived is counted only when updatedAt is in range AND status === 'delivered'
  const summaryPipeline = [
    {
      $match: {
        plantName,
        $or: [
          { createdAt: { $gte: start, $lte: end } },
          { updatedAt: { $gte: start, $lte: end } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        orderRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", orderRevenueStatuses] },
                  { $gte: ["$createdAt", start] },
                  { $lte: ["$createdAt", end] },
                ],
              },
              { $toDouble: "$price" },
              0,
            ],
          },
        },
        orderRevenueCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", orderRevenueStatuses] },
                  { $gte: ["$createdAt", start] },
                  { $lte: ["$createdAt", end] },
                ],
              },
              1,
              0,
            ],
          },
        },
        paymentReceived: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "delivered"] },
                  { $gte: ["$updatedAt", start] },
                  { $lte: ["$updatedAt", end] },
                ],
              },
              { $toDouble: "$price" },
              0,
            ],
          },
        },
        paymentReceivedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "delivered"] },
                  { $gte: ["$updatedAt", start] },
                  { $lte: ["$updatedAt", end] },
                ],
              },
              1,
              0,
            ],
          },
        },
        avgOrderRevenueValue: {
          $avg: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", orderRevenueStatuses] },
                  { $gte: ["$createdAt", start] },
                  { $lte: ["$createdAt", end] },
                ],
              },
              { $toDouble: "$price" },
              null,
            ],
          },
        },
        avgPaymentValue: {
          $avg: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "delivered"] },
                  { $gte: ["$updatedAt", start] },
                  { $lte: ["$updatedAt", end] },
                ],
              },
              { $toDouble: "$price" },
              null,
            ],
          },
        },
      },
    },
  ];

  const summaryAgg = await order.aggregate(summaryPipeline);

  const summary = summaryAgg[0] || {
    orderRevenue: 0,
    orderRevenueCount: 0,
    paymentReceived: 0,
    paymentReceivedCount: 0,
    avgOrderRevenueValue: 0,
    avgPaymentValue: 0,
  };

  // ----------------------
  // DAILY BREAKDOWN
  // ----------------------
  // Two aggregations:
  //  - ordersByCreated: group by createdAt day (orderRevenue, orderCount)
  //  - paymentsByUpdated: group by updatedAt day (paymentReceived, paymentCount)
  // Then merge them into a single array that has an entry for each date in the range.
  const ordersByCreatedPipeline = [
    {
      $match: {
        plantName,
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Kolkata",
          },
        },
        orderRevenue: {
          $sum: {
            $cond: [
              { $in: ["$status", orderRevenueStatuses] },
              { $toDouble: "$price" },
              0,
            ],
          },
        },
        orderCount: {
          $sum: { $cond: [{ $in: ["$status", orderRevenueStatuses] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        orderRevenue: 1,
        orderCount: 1,
      },
    },
  ];

  const paymentsByUpdatedPipeline = [
    {
      $match: {
        plantName,
        updatedAt: { $gte: start, $lte: end },
        status: "delivered",
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$updatedAt",
            timezone: "Asia/Kolkata",
          },
        },
        paymentReceived: { $sum: { $toDouble: "$price" } },
        paymentCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        paymentReceived: 1,
        paymentCount: 1,
      },
    },
  ];

  const [ordersByCreated, paymentsByUpdated] = await Promise.all([
    order.aggregate(ordersByCreatedPipeline),
    order.aggregate(paymentsByUpdatedPipeline),
  ]);

  // Convert arrays to maps for quick merge
  const ordersMap = {};
  for (const r of ordersByCreated) {
    ordersMap[r.date] = {
      orderRevenue: r.orderRevenue || 0,
      orderCount: r.orderCount || 0,
    };
  }
  const paymentsMap = {};
  for (const p of paymentsByUpdated) {
    paymentsMap[p.date] = {
      paymentReceived: p.paymentReceived || 0,
      paymentCount: p.paymentCount || 0,
    };
  }

  // Build full date list between start and end (inclusive) in YYYY-MM-DD
  const dateList = datesBetween(start, end);

  const dailyBreakdown = dateList.map((date) => {
    return {
      date,
      orderRevenue: (ordersMap[date] && ordersMap[date].orderRevenue) || 0,
      orderCount: (ordersMap[date] && ordersMap[date].orderCount) || 0,
      paymentReceived:
        (paymentsMap[date] && paymentsMap[date].paymentReceived) || 0,
      paymentCount: (paymentsMap[date] && paymentsMap[date].paymentCount) || 0,
    };
  });

  // ----------------------
  // STATUS BREAKDOWN
  // ----------------------
  // Include documents where either createdAt or updatedAt in range (so statuses that changed to delivered within range are included).
  const statusPipeline = [
    {
      $match: {
        plantName,
        $or: [
          { createdAt: { $gte: start, $lte: end } },
          { updatedAt: { $gte: start, $lte: end } },
        ],
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        revenue: { $sum: { $toDouble: "$price" } },
      },
    },
  ];

  const statusBreakdown = await order.aggregate(statusPipeline);

  res.status(200).json({
    success: true,
    dateRange: { start, end },
    summary: {
      orderRevenue: summary.orderRevenue || 0,
      orderRevenueCount: summary.orderRevenueCount || 0,
      avgOrderRevenueValue: summary.avgOrderRevenueValue || 0,
      paymentReceived: summary.paymentReceived || 0,
      paymentReceivedCount: summary.paymentReceivedCount || 0,
      avgPaymentValue: summary.avgPaymentValue || 0,
    },
    dailyBreakdown,
    statusBreakdown,
    message: "Revenue data retrieved successfully",
  });
});

// Get revenue comparison (current vs previous period)
export const getRevenueComparison = catchAsync(async (req, res, next) => {
  const { email, view } = req.query;

  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  if (!ensureAdmin(user)) {
    return res.status(403).json({ message: "Forbidden: admins only" });
  }

  const plantName = user.plant;
  const today = startOfDay(new Date());

  let currentStart, currentEnd, previousStart, previousEnd;

  switch (view) {
    case "weekly":
      // Last 7 days including today for "current"
      currentStart = startOfDay(new Date(today.setDate(today.getDate() - 6))); // careful: today modified
      currentStart = startOfDay(currentStart);
      currentEnd = endOfDay(new Date()); // today end

      // previous 7-day window just before currentStart
      previousEnd = endOfDay(new Date(currentStart.getTime() - 1)); // day before currentStart end
      previousStart = startOfDay(new Date(previousEnd.getTime()));
      previousStart.setDate(previousStart.getDate() - 6);
      previousStart = startOfDay(previousStart);
      break;

    case "monthly":
      {
        currentStart = startOfDay(
          new Date(today.getFullYear(), today.getMonth(), 1)
        );
        currentEnd = endOfDay(
          new Date(today.getFullYear(), today.getMonth() + 1, 0)
        );

        previousStart = startOfDay(
          new Date(today.getFullYear(), today.getMonth() - 1, 1)
        );
        previousEnd = endOfDay(
          new Date(today.getFullYear(), today.getMonth(), 0)
        );
      }
      break;

    default: // today
      currentStart = startOfDay(today);
      currentEnd = endOfDay(today);

      const prev = new Date(today);
      prev.setDate(today.getDate() - 1);
      previousStart = startOfDay(prev);
      previousEnd = endOfDay(prev);
  }

  const orderRevenueStatuses = [
    "processing",
    "ready for delivery",
    "delivery rider assigned",
  ];

  // Build summary for a range similar to getRevenue summary: include docs where either createdAt or updatedAt is in range
  const buildSummaryForRange = (rangeStart, rangeEnd) => [
    {
      $match: {
        plantName,
        $or: [
          { createdAt: { $gte: rangeStart, $lte: rangeEnd } },
          { updatedAt: { $gte: rangeStart, $lte: rangeEnd } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        orderRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", orderRevenueStatuses] },
                  { $gte: ["$createdAt", rangeStart] },
                  { $lte: ["$createdAt", rangeEnd] },
                ],
              },
              { $toDouble: "$price" },
              0,
            ],
          },
        },
        orderCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", orderRevenueStatuses] },
                  { $gte: ["$createdAt", rangeStart] },
                  { $lte: ["$createdAt", rangeEnd] },
                ],
              },
              1,
              0,
            ],
          },
        },
        paymentReceived: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "delivered"] },
                  { $gte: ["$updatedAt", rangeStart] },
                  { $lte: ["$updatedAt", rangeEnd] },
                ],
              },
              { $toDouble: "$price" },
              0,
            ],
          },
        },
        paymentCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "delivered"] },
                  { $gte: ["$updatedAt", rangeStart] },
                  { $lte: ["$updatedAt", rangeEnd] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ];

  const [currentAgg, previousAgg] = await Promise.all([
    order.aggregate(buildSummaryForRange(currentStart, currentEnd)),
    order.aggregate(buildSummaryForRange(previousStart, previousEnd)),
  ]);

  const current = currentAgg[0] || {
    orderRevenue: 0,
    orderCount: 0,
    paymentReceived: 0,
    paymentCount: 0,
  };
  const previous = previousAgg[0] || {
    orderRevenue: 0,
    orderCount: 0,
    paymentReceived: 0,
    paymentCount: 0,
  };

  const percentChange = (curr, prev) => {
    if (!prev || prev === 0) return null; // cannot compute percentage (no baseline)
    return ((curr - prev) / prev) * 100;
  };

  const revenueChangeOrder = percentChange(
    current.orderRevenue,
    previous.orderRevenue
  );
  const revenueChangePayment = percentChange(
    current.paymentReceived,
    previous.paymentReceived
  );

  const ordersChange = percentChange(current.orderCount, previous.orderCount);
  const paymentsCountChange = percentChange(
    current.paymentCount,
    previous.paymentCount
  );

  res.status(200).json({
    success: true,
    current: {
      orderRevenue: current.orderRevenue || 0,
      orderCount: current.orderCount || 0,
      paymentReceived: current.paymentReceived || 0,
      paymentCount: current.paymentCount || 0,
    },
    previous: {
      orderRevenue: previous.orderRevenue || 0,
      orderCount: previous.orderCount || 0,
      paymentReceived: previous.paymentReceived || 0,
      paymentCount: previous.paymentCount || 0,
    },
    change: {
      orderRevenuePct:
        revenueChangeOrder === null ? null : revenueChangeOrder.toFixed(2),
      paymentReceivedPct:
        revenueChangePayment === null ? null : revenueChangePayment.toFixed(2),
      orderCountPct: ordersChange === null ? null : ordersChange.toFixed(2),
      paymentCountPct:
        paymentsCountChange === null ? null : paymentsCountChange.toFixed(2),
    },
    message: "Revenue comparison retrieved successfully",
  });
});
