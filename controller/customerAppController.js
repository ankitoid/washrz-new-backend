import order from "../models/orderSchema.js";
import pickup from "../models/pickupSchema.js";
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

  const order_details =  await order.findOne({order_id})

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
