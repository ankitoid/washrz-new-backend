import Orders from "../models/orderSchema.js";
import pickup from "../models/pickupSchema.js";
import slotBookingSchema from "../models/slotBookingSchema.js";

export const customer_services = {};

const getItemType = (item) => item?.itemId?.type || item?.type || null;

const getItemQuantity = (item) => {
  const quantity = Number(item?.quantity);
  return quantity > 0 ? quantity : 1;
};

const getItemTotalPrice = (item) =>
  Number(item?.price || 0) * getItemQuantity(item);

customer_services.customerOrdersDetails = async (req, res) => {
  let phone = req.params.phone;

  const check_phone = phone.slice(0, 2);

  if (check_phone !== "91") {
    phone = "91" + phone;
  }

  let total_cost_laundry = 0;
  let total_cost_dryclean = 0;
  let total_cost_shoespa = 0;
  let total_number_of_orders = 0;
  let total_orders_value = 0;
  let avg_orders_value = 0;

  const orders = await Orders.find({ contactNo: phone }).populate({
    path: "items.itemId",
    select: "type",
  });
  console.log("this is the orders--->>>", orders);

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const itemType = getItemType(item);
      const itemTotalPrice = getItemTotalPrice(item);
      const itemQuantity = getItemQuantity(item);

      total_number_of_orders = total_number_of_orders + itemQuantity;

      if (itemType === "shoespa") {
        total_cost_shoespa = total_cost_shoespa + itemTotalPrice;
      } else if (itemType === "laundry") {
        total_cost_laundry = total_cost_laundry + itemTotalPrice;
      } else if (itemType === "dryclean") {
        total_cost_dryclean = total_cost_dryclean + itemTotalPrice;
      }
    });
  });

  total_orders_value =
    total_cost_laundry + total_cost_dryclean + total_cost_shoespa;

  avg_orders_value =
    total_number_of_orders > 0
      ? Math.ceil(total_orders_value / total_number_of_orders)
      : 0;

  return res.status(200).json({
    data: {
      total_cost_laundry,
      total_cost_dryclean,
      total_cost_shoespa,
      total_number_of_orders,
      avg_orders_value,
      total_orders_value,
      orders,
    },
  });
};

async function generateInvoiceNumber(){
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `INV-${yyyy}${mm}${dd}`;   // e.g., INV-20260526
 
  // Find the last order that has an invoice with today's prefix
  const lastOrder = await Orders.findOne({
    'invoice.invoiceNumber': { $regex: `^${prefix}` },
  })
    .sort({ 'invoice.invoiceNumber': -1 })   // descending by full invoice number
    .lean();
 
  let seq = 1;
  if (lastOrder?.invoice?.invoiceNumber) {
    const parts = lastOrder.invoice.invoiceNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
 
  // Example: INV-20260526-0001
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}


customer_services.generateCustomerInvoice = async (req,res) => {
try{
  const { orderId } = req.params;

  const currentTime = new Date();

  const gstNumber = "09AAKCG0890R1ZR"

  if (!orderId) {
    return res.status(400).json({ message: "orderId is required" });
  }

  const order = await Orders.findOne({ order_id: orderId })
   
  if(order?.status !== "delivered"){
    return res.status(400).json({ message: "Invoice can only be generated for delivered and paid orders" });
  }

  if(currentTime - order.statusHistory.delivered < 15 * 60 * 1000){
    return res.status(400).json({ message: "Invoice can be generated after 15 minutes of delivery" });
  }

  if(order?.invoice){
    return res.status(200).json({ data: order.invoice, message: "Invoice already generated for this order" });
  }

     // Build immutable snapshot from current order data
    const invoiceSnapshot = {
      invoiceNumber: await generateInvoiceNumber(),
      gstNumber: gstNumber,
      invoiceDate: new Date(),
      invoiceGeneratedBy: 'admin',
      customerName: order.customerName || '',
      address: order.address || '',
      contactNo: order.contactNo || '',
      email: order.email || '',
      orderId: order.order_id,
      items: order.items.map((item) => ({
        label: item.itemId.label || 'Service',
        price: item.price,
        quantity: item.quantity,
        unit: item.unit || '',
        totalItemPrice: +(item.price * item.quantity).toFixed(2).toString(),
        sku : item.itemId.sku || '',
        sacid : item.itemId.sacid || ''
      })),
      subtotal: +order.price.toFixed(2),
      deliveryCharges: +order.deliveryCharges.toFixed(2),
      taxAmount: +(order.price.toFixed(2) * 0.18).toFixed(2), // Example tax calculation
      discountAmount: +order.discountAmount.toFixed(2),
      totalAmount: +order.totalAmount.toFixed(2),
      payment: {
        mode: order.payment.paymentMode || 'unknown',
        transactionId:
          order.payment.transactionId ||
          order.payment.razorpayPaymentId ||
          '',
        status: order.payment.status,
        paidAt: order.payment.updatedAt || new Date(),
      },
      status: 'generated',
    };
 
    // Save the snapshot – do NOT modify this field again!
    order.invoice = invoiceSnapshot;
    await order.save();
 
    return res.status(201).json({
      success: true,
      data: order.invoice,
    });
}catch(error){
  console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
}
}

customer_services.markPaymentNotDone = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    // 1. Fetch the MongoDB _id for this order
    const orderDoc = await Orders.findOne({ order_id: orderId }).select("_id");
    if (!orderDoc) {
      return res.status(404).json({ message: "Order not found" });
    }
    const orderMongoId = orderDoc._id;

    console.log("Fetched order MongoDB ID:",orderDoc,orderMongoId);

    // 2. Fetch isSameDayDelivery from the related booking
    const pickupDoc = await pickup.findOne({ orderId: orderMongoId }).select("bookingId");
    if (!pickupDoc) {
      return res.status(404).json({ message: "Pickup record not found" });
    }
    
     console.log("Fetched pickup document:", pickupDoc);

    
    const bookingDoc = await slotBookingSchema.findOne({ bookingId: pickupDoc.bookingId }).select("isSameDayDelivery");

    console.log("Fetched booking document:", bookingDoc);

    
    const isSameDayDelivery = bookingDoc?.isSameDayDelivery || false;

    // 3. Perform the main update (atomic, with conditions)
    const updatedOrder = await Orders.findOneAndUpdate(
      {
        order_id: orderId,
        appCustomerId: { $exists: true, $ne: null },
        platform_type: "app",
      },
      {
        morningDelivery: false,
        isCODConfirmed: true,
      },
      { new: false } // we don't need the updated doc
    );

    if (!updatedOrder) {
      const orderExists = await Orders.exists({ order_id: orderId });
      if (!orderExists) {
        return res.status(404).json({ message: "Order not found" });
      } else {
        return res.status(400).json({
          message: "This operation is only allowed for app orders with a customer ID",
        });
      }
    }

    // 4. If same‑day delivery, automatically reschedule the order
    if (isSameDayDelivery) {
      // Decide the new delivery date – e.g., tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      try {
        await rescheduleOrderService(orderId, tomorrow);
        // Optionally log success
      } catch (rescheduleError) {
        // Since the main update succeeded, decide whether to fail the whole request.
        // Here we log the error and return a 207 (Multi‑Status) or a warning.
        console.error("Reschedule failed after marking payment not done:", rescheduleError);
        // You could also choose to return a 500 with a specific message.
        // For this example, we return success for the update but include a warning.
        return res.status(207).json({
          message: "Order updated, but rescheduling failed. Please retry.",
          error: rescheduleError.message,
        });
      }
    }

    // 5. Success – no content
    return res.status(204).send();

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


const rescheduleOrderService = async (orderId, newDate) => {
  const order = await Orders.findOne({ order_id: orderId });
  if (!order) {
    throw new Error('Order not found');
  }
  // Additional business validations can be added here

  order.rescheduledDate = newDate;
  order.isRescheduled = true;
  await order.save();
  return order;
};

