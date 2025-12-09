import customer from "../models/customerSchema.js";
import order from "../models/orderSchema.js";
import pickup from "../models/pickupSchema.js";
import APIFeatures from "../utills/apiFeatures.js";
import AppError from "../utills/appError.js";
import catchAsync from "../utills/catchAsync.js";
import cron from "node-cron";
import User from "./../models/userModel.js";
import mongoose from "mongoose";
import ErrorHandler from "../utills/errorHandler.js";

export const addCustomer = catchAsync(async (req, res, next) => {
  const { name, address, mobile, date } = req.body;
  const socket = req.socket;
  if (!name || !address || !mobile || !date) {
    return next(new AppError("Please fill the all field", 404));
  }
  await customer.create({
    Name: name,
    Address: address,
    Phone: mobile,
    Date: date,
  });
  socket.emit("customeradded", { message: "customer added sucessfully" });
  res.status(200).json({
    message: "Customer Sucessfully Added",
  });
});

export const getCustomers = catchAsync(async (req, res, next) => {
  const [customers, countTotal] = await Promise.all([
    new APIFeatures(customer.find(), req.query).sort().limitFields().paginate()
      .query,
    customer.countDocuments(),
  ]);

  res.status(200).json({
    result: customers,
    total: countTotal,
    message: "Customers Retrieved Successfully",
  });
});

export const addPickup = catchAsync(async (req, res, next) => {
  const { name, contact, address } = req.body;
  const pickupData = await pickup.create({
    Name: name,
    Contact: contact,
    Address: address,
    plantName: "Delhi",
    type: "live",
    PickupStatus: "pending",
    pickup_date: new Date(),
  });
  req.socket.emit("addPickup", pickupData);
  res.status(200).json({
    message: "Pickup Added Sucessfully",
  });
});

// export const getPickups = catchAsync(async (req, res, next) => {
//   const [pickups, countTotal] = await Promise.all([
//     new APIFeatures(pickup.find({ type: "live", isDeleted: false }), req.query)
//       .sort()
//       .limitFields()
//       .paginate().query,
//     pickup.countDocuments({ type: "live", isDeleted: false }),
//   ]);

//   res.status(200).json({
//     Pickups: pickups,
//     total: countTotal,
//     message: "Pickup Retrieved Successfully",
//   });
// });

//ready for delivery

// export const getPickups = catchAsync(async (req, res, next) => {
//   const [pickups, countTotal] = await Promise.all([
//     new APIFeatures(
//       pickup.find({
//         type: "live",
//         isDeleted: false,
//         isRescheduled: false,
//       }),
//       req.query
//     )
//       .sort()
//       .limitFields()
//       .paginate().query,
//     pickup.countDocuments({
//       type: "live",
//       isDeleted: false,
//       isRescheduled: false,
//     }),
//   ]);

//   res.status(200).json({
//     Pickups: pickups,
//     total: countTotal,
//     message: "Pickup Retrieved Successfully",
//   });
// });
export const getPickups = catchAsync(async (req, res, next) => {
  const { date } = req.query; // Date filter from query
  const startDate = date ? new Date(date) : new Date(); // Default to current date
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  const [pickups, countTotal] = await Promise.all([
    new APIFeatures(
      pickup.find({
        PickupStatus: "pending",
        type: "live",
        isDeleted: false,
        isRescheduled: false,
        pickup_date: { $gte: startDate, $lte: endDate },
      }),
      req.query
    )
      .sort()
      .limitFields()
      .paginate().query,
    pickup.countDocuments({
      PickupStatus: "pending",
      type: "live",
      isDeleted: false,
      isRescheduled: false,
      pickup_date: { $gte: startDate, $lte: endDate },
    }),
  ]);

  res.status(200).json({
    Pickups: pickups,
    total: countTotal,
    message: "Pickup Retrieved Successfully",
  });
});

export const getAssignedPickups = catchAsync(async (req, res, next) => {
  const { email } = req.query;

  // Fetch the plant name associated with this email
  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  // Use the user's plant name to filter pickups
  const plantName = user.plant;
  const riderName = user.name;

  const todayDate = new Date().toISOString().split("T")[0];

  if (user.role === "admin" || user.role === "plant-manager") {
    const [pickups, countTotal] = await Promise.all([
      new APIFeatures(
        pickup.find({
          PickupStatus: "pending",
          type: "live",
          isDeleted: false,
          isRescheduled: false,
          plantName: plantName, // Filter based on user's plant name
        }),
        req.query
      )
        .sort()
        .limitFields()
        .paginate().query,
      pickup.countDocuments({
        PickupStatus: "pending",
        type: "live",
        isDeleted: false,
        isRescheduled: false,
        plantName: plantName,
      }),
    ]);
    res.status(200).json({
      status: "success",
      total: countTotal,
      Pickups: pickups,
    });
  }
  // if (user.role === "rider") {
  //   const [pickups, countTotal] = await Promise.all([
  //     new APIFeatures(
  //       pickup.find({
  //         type: "live",
  //         isDeleted: false,
  //         isRescheduled: false,
  //         plantName: plantName, // Filter based on user's plant name
  //         riderName: riderName,
  //       }),
  //       req.query
  //     )
  //       .sort()
  //       .limitFields()
  //       .paginate().query,
  //     pickup.countDocuments({
  //       type: "live",
  //       isDeleted: false,
  //       isRescheduled: false,
  //       plantName: plantName,
  //       riderName: riderName,
  //     }),
  //   ]);
  //   res.status(200).json({
  //     status: "success",
  //     total: countTotal,
  //     Pickups: pickups,
  //   });
  // }
  // Get today's date in YYYY-MM-DD format

  if (user.role === "rider") {
    const [pickups, countTotal] = await Promise.all([
      new APIFeatures(
        pickup.find({
          PickupStatus: "pending",
          type: "live",
          isDeleted: false,
          isRescheduled: false,
          plantName: plantName, // Filter based on user's plant name
          riderName: riderName,
          riderDate: todayDate, // Filter for today's assigned pickups
        }),
        req.query
      )
        .sort()
        .limitFields()
        .paginate().query,
      pickup.countDocuments({
        PickupStatus: "pending",
        type: "live",
        isDeleted: false,
        isRescheduled: false,
        plantName: plantName,
        riderName: riderName,
        riderDate: todayDate, // Count only today's pickups
      }),
    ]);
    res.status(200).json({
      status: "success",
      total: countTotal,
      Pickups: pickups,
    });
  } else {
    res.status(403).json({ message: "Unauthorized access" });
  }
});

export const deletePickup = catchAsync(async (req, res, next) => {
  const pickupData = await pickup.findByIdAndUpdate(req.params.id, {
    isDeleted: true,
    PickupStatus: "deleted",
    type: "",
  });
  if (!pickupData) {
    return next(new AppError("No pickup found with that ID", 404));
  }
  res.status(200).json({
    message: "Pickup Deleted Sucessfully",
  });
});

export const completePickup = catchAsync(async (req, res, next) => {
  const pickupData = await pickup.findByIdAndUpdate(req.params.id, {
    isDeleted: true,
    PickupStatus: "complete",
    type: "",
  });
  if (!pickupData) {
    return next(new AppError("No pickup found with that ID", 404));
  }
  res.status(200).json({
    message: "Pickup Deleted Sucessfully",
  });
});

export const addSchedulePickup = catchAsync(async (req, res, next) => {
  const { name, contact, address, slot } = req.body;
  const schedulePickupData = await pickup.create({
    Name: name,
    Contact: contact,
    Address: address,
    slot,
    plantName: "Delhi",
    type: "schedule",
    PickupStatus: "pending",
    pickup_date: new Date(),
  });
  req.socket.emit("addSchedulePickup", schedulePickupData);
  res.status(200).json({
    message: "SchedulePickup Added Sucessfully",
  });
});

// This function will be called every 24 hours
const schedulePickuptolive = async () => {
  try {
    const currentDate = new Date();

    // Find all pickups that are rescheduled and where the rescheduled date has passed or is today
    const rescheduledPickups = await pickup.find({
      type: "schedule",
    });

    // Update each rescheduled pickup back to "regular"
    for (const pickupData of rescheduledPickups) {
      pickupData.type = "live";
      pickupData.isRescheduled = false;
      pickupData.isDeleted = false;
      pickupData.PickupStatus = "pending";
      pickupData.pickup_date = currentDate;

      await pickupData.save(); // Save the changes
    }

    console.log("Rescheduled pickups have been updated successfully");
  } catch (error) {
    console.error("Error in reschedulePickupJob:", error);
  }
};

// Schedule the cron job to run every 24 hours (you can set it to run at midnight every day)
cron.schedule("0 0 * * *", schedulePickuptolive); // This runs at 00:00 (midnight) every day

export const getSchedulePickups = catchAsync(async (req, res, next) => {
  const [pickups, countTotal] = await Promise.all([
    new APIFeatures(
      pickup.find({ type: "schedule", PickupStatus: "pending" }),
      req.query
    )
      .sort()
      .limitFields()
      .paginate().query,
    pickup.countDocuments({ type: "schedule", PickupStatus: "pending" }),
  ]);

  res.status(200).json({
    Pickups: pickups,
    total: countTotal,
    message: "SchedulePickups Retrieved Successfully",
  });
});

export const addOrder = catchAsync(async (req, res, next) => {
  const { contactNo, customerName, address, items, price } = req.body;
  const latestOrder = await order.find().sort({ _id: -1 });
  console.log("this is the latesoder---> ", latestOrder);
  let order_id = `WZ1001`;
  if (latestOrder.length > 0) {
    order_id = latestOrder[0].order_id.split("WZ")[1] * 1 + 1;
    order_id = "WZ" + order_id;
    console.log("updated order id---> ", order_id);
  }
  await order.create({
    contactNo,
    customerName,
    address,
    items,
    price,
    order_id,
  });
  res.status(200).json({
    message: "Order Added Sucessfully",
  });
});

// export const getOrders = catchAsync(async (req, res, next) => {
//   const { email } = req.query;

//   // Fetch the plant name associated with this email
//   const user = await User.findOne({ email: email });
//   if (!user || !user.plant) {
//     return res.status(404).json({ message: "User or Plant not found" });
//   }

//   // Use the user's plant name to filter pickups
//   const plantName = user.plant;

//   const [orders, countTotal] = await Promise.all([
//     new APIFeatures(order.find({ plantName: plantName }), req.query)
//       .sort()
//       .limitFields()
//       .paginate().query,
//     order.countDocuments({ plantName: plantName }),
//   ]);

//   res.status(200).json({
//     orders: orders,
//     total: countTotal,
//     message: "orders Retrieved Successfully",
//   });
// });

export const getOrders = catchAsync(async (req, res, next) => {
  const { email, date } = req.query;

  // Fetch the plant name associated with this email
  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  // Use the user's plant name to filter orders
  const plantName = user.plant;

  const startDate = date ? new Date(date) : new Date(); // Default to current date
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  const [orders, countTotal] = await Promise.all([
    new APIFeatures(
      order.find({
        plantName: plantName,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      req.query
    )
      .sort()
      .limitFields()
      .paginate().query,
    order.countDocuments({
      plantName: plantName,
      createdAt: { $gte: startDate, $lte: endDate },
    }),
  ]);

  res.status(200).json({
    orders: orders,
    total: countTotal,
    message: "Orders Retrieved Successfully",
  });
});

export const getOrdersByFilter = catchAsync(async (req, res, next) => {
  const { email } = req.query;

  // Fetch the plant name associated with this email
  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  // Use the user's plant name to filter pickups
  const plantName = user.plant;

  // Check if 'status' is provided in the query, otherwise default to 'processing'

  if (req.query.status === "processing") {
    const status = req.query.status;
    const [orders, countTotal] = await Promise.all([
      new APIFeatures(order.find({ status, plantName: plantName }), req.query)
        .sort()
        .limitFields()
        .paginate().query,
      order.countDocuments({ status, plantName: plantName }),
    ]);

    res.status(200).json({
      orders: orders,
      total: countTotal,
      message: "Orders retrieved successfully",
    });
  }
  //ready for intransit
  if (req.query.status === "intransit") {
    const status = req.query.status;
    const [orders, countTotal] = await Promise.all([
      new APIFeatures(order.find({ status, plantName: plantName }), req.query)
        .sort()
        .limitFields()
        .paginate().query,
      order.countDocuments({ status, plantName: plantName }),
    ]);

    res.status(200).json({
      orders: orders,
      total: countTotal,
      message: "Orders retrieved successfully",
    });
  }

  if (req.query.status === "ready for delivery") {
    if (user.role === "admin" || user.role === "plant-manager") {
      const status = req.query.status;
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(
          order.find({ status, isRescheduled: false, plantName: plantName }),
          req.query
        )
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({
          status,
          isRescheduled: false,
          plantName: plantName,
        }),
      ]);

      res.status(200).json({
        orders: orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }
    // if (user.role === "rider") {
    //   const status = req.query.status;
    //   const riderName = user.name;
    //   const [orders, countTotal] = await Promise.all([
    //     new APIFeatures(
    //       order.find({
    //         status,
    //         isRescheduled: false,
    //         plantName: plantName,
    //         riderName: riderName,
    //       }),
    //       req.query
    //     )
    //       .sort()
    //       .limitFields()
    //       .paginate().query,
    //     order.countDocuments({
    //       status,
    //       isRescheduled: false,
    //       plantName: plantName,
    //       riderName: riderName,
    //     }),
    //   ]);

    //   res.status(200).json({
    //     orders: orders,
    //     total: countTotal,
    //     message: "Orders retrieved successfully",
    //   });
    // }
    if (user.role === "rider") {
      const todayDate = new Date().toISOString().split("T")[0];
      const status = req.query.status;
      const riderName = user.name;
      const RiderDate = todayDate;

      // Query ke andar riderDate ko bhi filter mein add karte hain
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(
          order.find({
            status,
            isRescheduled: false,
            plantName: plantName,
            riderName: riderName,
            riderDate: RiderDate, // Rider Date filter yahan add kiya hai
          }),
          req.query
        )
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({
          status,
          plantName: plantName,
          riderName: riderName,
          riderDate: RiderDate, // Rider Date filter yahan add kiya hai
        }),
      ]);

      res.status(200).json({
        orders: orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }
  }

  // delivered
  if (req.query.status === "delivered") {
    if (user.role === "admin" || user.role === "plant-manager") {
      const status = req.query.status;
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(order.find({ status, plantName: plantName }), req.query)
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({ status, plantName: plantName }),
      ]);

      res.status(200).json({
        orders: orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }
  }
  // if (user.role === "rider") {
  //   const status = req.query.status;
  //   const riderName = user.name;
  //   const [orders, countTotal] = await Promise.all([
  //     new APIFeatures(
  //       order.find({ status, plantName: plantName, riderName: riderName }),
  //       req.query
  //     )
  //       .sort()
  //       .limitFields()
  //       .paginate().query,
  //     order.countDocuments({
  //       status,
  //       plantName: plantName,
  //       riderName: riderName,
  //     }),
  //   ]);

  //   res.status(200).json({
  //     orders: orders,
  //     total: countTotal,
  //     message: "Orders retrieved successfully",
  //   });
  // }
});

export const getOrderTotalBill = catchAsync(async (req, res, next) => {
  const Price = await order
    .findOne({
      contactNo: req.params.number,
    })
    .select("price -_id");

  return res.status(200).json({
    Price,
    message: "Price Retrieved Successfully",
  });
});

export const getCancelPickups = catchAsync(async (req, res, next) => {
  const { email } = req.query;

  // Validate if the email exists
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Find the user by email to get their associated plant name
  const user = await User.findOne({ email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  const plantName = user.plant;

  // Fetch pickups that match the plant name and are marked as deleted
  const [pickups, countTotal] = await Promise.all([
    new APIFeatures(
      pickup.find({
        isDeleted: true,
        PickupStatus: "deleted",
        plantName: plantName,
      }), // Filter by plant name
      req.query
    )
      .sort()
      .limitFields()
      .paginate().query,
    pickup.countDocuments({
      isDeleted: true,
      PickupStatus: "deleted",
      plantName: plantName,
    }), // Count filtered documents
  ]);

  res.status(200).json({
    Pickups: pickups,
    total: countTotal,
    message: "Cancelled Pickups Retrieved Successfully",
  });
});

// export const changeOrderStatus = catchAsync(async (req, res, next) =>
// {
//    const _id = req.params.id;
//    const status = (req.body.status).toLowerCase();
//    const updatedOrder = await order.findOneAndUpdate({_id}, {status});
//    res.status(200).json({
//     result: updatedOrder,
//     message: `Added in ${status} tab`,
//   });
// })

export const changeOrderStatus = catchAsync(async (req, res, next) => {
  const _id = req.params.id;
  const status = req.body.status.toLowerCase();
  const validStatuses = [
    "intransit",
    "processing",
    "ready for delivery",
    "delivered",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid status provided.",
    });
  }

  const updatedOrder = await order.findOneAndUpdate(
    { _id },
    { status },
    { new: true }
  );

  if (!updatedOrder) {
    return res.status(404).json({
      message: "Order not found.",
    });
  }

  res.status(200).json({
    result: updatedOrder,
    message: `Order status updated to ${status}`,
  });
});

// cron.schedule("0 0 * * 0", async () => {
//   try {
//     const deletedOrders = await order.deleteMany({});
//     console.log(`Successfully deleted ${deletedOrders.deletedCount} orders.`);
//   } catch (error) {
//     console.log("Error deleting orders:", error);
//   }
// });

/* get order by order_id */
export const getOrderByOrderId = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorHandler("Invalid project ID format.", 400));
    }

    const orderData = await order.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) },
      },
      {
        $project: {
          _id: 0,
          contactNo: 1,
          address: 1,
          customerName: 1,
          price: 1,
          order_id: 1,
        },
      },
    ]);

    if (!orderData || orderData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: orderData[0],
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

/* Update order by order id */
export const updateOrderById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorHandler("Invalid project ID format.", 400));
    }
    const { customerName, contactNo, address, price } = req.body;

    const updated = await order.findByIdAndUpdate(
      id,
      { customerName, contactNo, address, price },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

/* Delete order by order id */
export const deleteOrderById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const deletedOrder = await order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});
