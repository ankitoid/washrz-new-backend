import Order from "../models/orderSchema.js";
import order from "../models/orderSchema.js";
import pickup from "../models/pickupSchema.js";
import slotBookingSchema from "../models/slotBookingSchema.js";
import APIFeatures from "../utills/apiFeatures.js";

export const getCustomerOrders = async (req,res) =>
{

  console.log("thisss",req.params);


  const {phoneNumber}  =  req.params

  console.log('this is appCustomerId',phoneNumber)

//   const orderData =  await Order.find({contactNo:phoneNumber})

    const [orders, countTotal] = await Promise.all([
    new APIFeatures(
      order.find({contactNo:phoneNumber}),
      req.query
    )
      .sort()
      .limitFields()
      .paginate().query,
    order.countDocuments({contactNo:phoneNumber}),
  ]);

  console.log("this is orderdata",orders);

    res.status(200).json({
    orders: orders,
    total: countTotal,
    message: "Orders Retrieved Successfully",
  });
}


export const getCustomerSingleOrderDetails = async (req,res) =>
{
try {
    const {order_id} = req.params

  if(!order_id)
  {
    res.status(400).json({
    message: "orderId is required",
  });
  }

  const order_details =  await order.findOne({order_id});
  const pickup_details = await pickup.findOne({orderId: order_details?._id});
  const booking_details = await slotBookingSchema.findOne({bookingId: pickup_details?.bookingId});

  order_details.deliveryLabel = booking_details?.deliveryLabel;
if (!order_details) {
  return res.status(404).json({
    message: "Order not found",
  });
}

  console.log("this is orderdetails==>>",order_details)

  res.status(200).json({order_details: order_details, message: "Orders Retrieved Successfully"})
} catch (error) {
  console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
}
}


export const getCustomersPickups = async (req,res) =>
{  
try {
   const {phone,status} = req.query

   console.log("i want phone",phone,status)

   if(!phone){
     return res.status(400).json({message: "Phone is required!"})
   } 

   let query = {Contact : phone}

   if (status) {
  const statusArray = status.split(","); // pending,assigned
  console.log("status arrayyy",statusArray)
  query.PickupStatus = { $in: statusArray };
}

   const Pickups = await pickup.find(query).sort({ createdAt: -1 });

   if(Pickups.length ===0)
   {
    return res.status(200).json({pickups: Pickups, message: "No Pickup Found"})
   }

   console.log("this is Pickups",Pickups)
   
   res.status(200).json({pickups: Pickups, message: "Pickups Retrieved Successfully"})
   
} catch (error) {
  console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
}
}

// export const getOrders = catchAsync(async (req, res, next) => {
//   const { email, date } = req.query;

//   // Fetch the plant name associated with this email
//   const user = await User.findOne({ email: email });
//   if (!user || !user.plant) {
//     return res.status(404).json({ message: "User or Plant not found" });
//   }

//   // Use the user's plant name to filter orders
//   const plantName = user.plant;

//   const startDate = date ? new Date(date) : new Date(); // Default to current date
//   startDate.setHours(0, 0, 0, 0);
//   const endDate = new Date(startDate);
//   endDate.setHours(23, 59, 59, 999);

//   const [orders, countTotal] = await Promise.all([
//     new APIFeatures(
//       order.find({
//         plantName: plantName,
//         createdAt: { $gte: startDate, $lte: endDate },
//       }),
//       req.query
//     )
//       .sort()
//       .limitFields()
//       .paginate().query,
//     order.countDocuments({
//       plantName: plantName,
//       createdAt: { $gte: startDate, $lte: endDate },
//     }),
//   ]);

//   res.status(200).json({
//     orders: orders,
//     total: countTotal,
//     message: "Orders Retrieved Successfully",
//   });
// });

export const getCustomerSinglePickupDetails = async (req, res) => {
  try {
    const { pickup_id } = req.params;

    if (!pickup_id) {
      return res.status(400).json({
        message: "pickupId is required",
      });
    }

    console.log("this is pickup_id====>", pickup_id);

    const pickup_details = await pickup.findById(pickup_id);

    if (!pickup_details) {
      return res.status(404).json({
        message: "Pickup not found",
      });
    }

    console.log("this is pickupdetails==>>", pickup_details);

    return res.status(200).json({
      pickup_details,
      message: "Pickup Retrieved Successfully",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


export const getActivePickupOrOrder = async (req, res) => {
  try {
    const { phone } = req.params;

    console.log("this is the phone==>>", phone);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Find pickup and populate booking details
    const latestPickup = await pickup.findOne({
      Contact: phone,
    })
    .sort({ createdAt: -1 })
    .populate({
      path: 'bookingId',
      model: 'Booking',
      foreignField: 'bookingId', // This tells Mongoose to match against the bookingId field in Booking model
      select: '-__v' // Optional: exclude version field
    }); // Populates the booking details from Booking table

    console.log("this is the latestPickup--->>", latestPickup);

    if (!latestPickup) {
      return res.status(404).json({
        success: false,
        message: "No pickup detail found",
      });
    }

    // Check pickup status
    if (latestPickup.PickupStatus === "pending" || latestPickup.PickupStatus === "assigned") {
      return res.status(200).json({
        success: true,
        message: "Active pickup found",
        data: latestPickup,
        type: "pickup"
      });
    }

    // If pickup is complete, check for orders
    if (latestPickup.PickupStatus === "complete") {
      const latestOrder = await Order.findOne({
        contactNo: phone
      }).sort({ createdAt: -1 });

      console.log("this is the latestOrder===>>>", latestOrder);

      if (latestOrder) {
        return res.status(200).json({
          success: true,
          message: "Order details found",
          data: latestOrder,
          type: "order"
        });
      } 
      else {
        return res.status(404).json({
          success: false,
          message: "No order details found for completed pickup",
        });
      }
    }

    // Fallback for other statuses
    return res.status(200).json({
      success: false,
      message: "nothing found",
      data: [],
      type: "none"
    });

  } catch (error) {
    console.log("this is the error===>>>", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const removeDeliveredOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("this is the iddd====>>>>", id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required!",
      });
    }

    const updatedOrder = await order.findOneAndUpdate(
      { _id: id },
      { isArchived: true },
      { new: true } // Optional: returns the updated document
    );

    console.log("this is the updatedOrder===>>>", updatedOrder);


    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order archived successfully",
      data: updatedOrder,
    });

  } catch (error) {
    console.log("this is the error==>>", error);
    

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



