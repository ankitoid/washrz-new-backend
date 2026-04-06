import Coupon from "../models/couponSchema.js";
import Order from "../models/orderSchema.js";



 const coupons_service =  {}

/**
 * CREATE COUPON
 */
coupons_service.create = async (body) => {
  const {
    name,
    code,
    type,
    discount,
    maxCap,
    totalLimit,
    perUser,
    minOrder,
    startDate,
    expiryDate,
    isActive,
    categories
  } = body;

  // Required validation
  if (!name || !code || !type || !discount || !totalLimit) {
    throw new Error("Required fields missing");
  }

  if (!startDate || !expiryDate) {
    throw new Error("startDate and expiryDate are required");
  }

  if (!["flat", "discount"].includes(type)) {
    throw new Error("Invalid coupon type");
  }

  if (new Date(startDate) > new Date(expiryDate)) {
    throw new Error("Invalid date range");
  }

  // Unique check
  const existing = await Coupon.findOne({ code });
  if (existing) {
    throw new Error("Coupon code already exists");
  }

  return Coupon.create({
    name,
    code,
    type,

    //SAFE NUMBER CONVERSION
    discount: Number(discount),
    maxCap: maxCap ? Number(maxCap) : null,
    totalLimit: Number(totalLimit),
    perUser: perUser ? Number(perUser) : 1,
    minOrder: minOrder ? Number(minOrder) : 0,

    startDate,
    expiryDate,

    isActive: isActive ?? true,
    categories: categories || []
  });
};

/**
 * LIST COUPONS (PAGINATED)
 */
coupons_service.list = async (queryParams) => {
  const { page = 1, limit = 10, search = "", status } = queryParams;

  const query = {};

  // Search
  if (search) {
    query.$or = [
      { code: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } }
    ];
  }

  // 🔹 Status filter
  if (status === "active") query.isActive = true;
  if (status === "inactive") query.isActive = false;

  const coupons = await Coupon.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Coupon.countDocuments(query);

  return {
    success: true,
    data: coupons,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * UPDATE COUPON
 */
coupons_service.update = async (id, body) => {
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new Error("Coupon not found");
  }

  return Coupon.findByIdAndUpdate(id, body, { new: true });
};

/**
 * TOGGLE COUPON
 */
coupons_service.toggle = async (id) => {
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new Error("Coupon not found");
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return coupon;
};

/**
 * DELETE COUPON
 */
coupons_service.remove = async (id) => {
  return Coupon.findByIdAndDelete(id);
};



//customer end logic starts here-->>


// GET AVAILABLE COUPONS
coupons_service.getAvailable = async (query) => {
  const { cartAmount , category } = query;
  const now = new Date();

  const coupons = await Coupon.find({
    isActive: true,
    startDate: { $lte: now },
    expiryDate: { $gte: now },
    minOrder: { $lte: Number(cartAmount) },
    ...(category && { categories: category }),
    $expr: {
      $lt: [
        { $add: ["$usedCount", "$reservedCount"] },
        "$totalLimit"
      ]
    }
  }).lean();

  return coupons;
};

// APPLY COUPON (RESERVE)
coupons_service.applyToOrder = async (userId, body) => {
  const { orderId, code } = body;

  const order = await Order.findOne({ order_id: orderId });
  if (!order) throw new Error("Order not found");

  if (order.Coupon) throw new Error("Coupon already applied");

  const now = new Date();

  const coupon = await Coupon.findOneAndUpdate(
    {
      code,
      isActive: true,
      startDate: { $lte: now },
      expiryDate: { $gte: now },
      minOrder: { $lte: order.totalAmount },
      $expr: {
        $lt: [
          { $add: ["$usedCount", "$reservedCount"] },
          "$totalLimit"
        ]
      }
    },
    { $inc: { reservedCount: 1 } },
    { new: true }
  );

  if (!coupon) throw new Error("Invalid coupon");

  let discount = 0;

  if (coupon.type === "flat") {
    discount = coupon.discount;
  } else {
    discount = (order.price * coupon.discount) / 100;
    if (coupon.maxCap) {
      discount = Math.min(discount, coupon.maxCap);
    }
  }

  const reservation = await CouponReservation.create({
    couponId: coupon._id,
    userId,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  order.discountAmount = discount;
  order.totalAmount =
    order.price  - discount;

  order.Coupon.coupon = {
    couponId: coupon._id,
    code: coupon.code,
    discount,
    type: coupon.type
  };

  order.Coupon.reservationId = reservation._id;

  await order.save();

  return { success: true, order };
};



// CONFIRM COUPON (ON PAYMENT)
coupons_service.confirmAfterPayment = async (userId, body) => {
  const { orderId } = body;

  const order = await Order.findOne({ order_id: orderId });

  if (!order || !order.Coupon) return { success: true };

  await Coupon.findByIdAndUpdate(order.Coupon.coupon.couponId, {
    $inc: {
      usedCount: 1,
      reservedCount: -1
    }
  });

  await CouponReservation.findByIdAndUpdate(order.reservationId, {
    status: "confirmed"
  });

  return { success: true };
};


// RELEASE COUPON (CANCEL)
coupons_service.removeFromOrder = async (userId, body) => {
  const { orderId } = body;

  const order = await Order.findOne({ order_id: orderId });
  if (!order || !order.Coupon) return { success: true };

  await Coupon.findByIdAndUpdate(order.Coupon.coupon.couponId, {
    $inc: { reservedCount: -1 }
  });

  await CouponReservation.findByIdAndUpdate(order.reservationId, {
    status: "expired"
  });

  order.discountAmount = 0;
  order.totalAmount =
    order.price + order.deliveryCharges + order.taxAmount;

  order.Coupon = null;
  order.reservationId = null;

  await order.save();

  return { success: true };
};







export default coupons_service;