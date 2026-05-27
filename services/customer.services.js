import Orders from "../models/orderSchema.js"
import User from "../models/userModel.js";

export const customer_services = {}


customer_services.customerOrdersDetails = async (req,res) =>
{ 
  let phone = req.params.phone

  const check_phone =  phone.slice(0,2)

  if(check_phone !== "91"){
    phone = "91" + phone
  }

  
  let total_cost_laundry = 0;
  let total_cost_dryclean = 0;
  let total_cost_shoespa = 0;
  let total_number_of_orders = 0;
  let total_orders_value = 0;
  let avg_orders_value = 0;

  console.log('phone',phone)



  const orders =  await Orders.find({contactNo:phone})

     console.log("this is the orders--->>>",orders)

   const data =  orders.forEach((el)=>
    { 
        
        el.items.forEach((el)=>{
        total_number_of_orders = total_number_of_orders + 1
        if(el.type == "shoespa")
        {
        total_cost_shoespa =  total_cost_shoespa + (el?.price * el?.quantity)
        }
        else if(el.type == "laundry")
        {
          total_cost_laundry =  total_cost_laundry + (el?.price * el?.quantity)
        }
        else if(el.type == "dryclean")
        {
          total_cost_dryclean =  total_cost_dryclean + (el?.price * el?.quantity)
        }
      })
    })
  total_orders_value = total_cost_laundry + total_cost_dryclean + total_cost_shoespa;

  avg_orders_value = Math.ceil(total_orders_value/total_number_of_orders)


   return res.status(200).json({data: {
    total_cost_laundry : total_cost_laundry,
    total_cost_dryclean : total_cost_dryclean,
    total_cost_shoespa : total_cost_shoespa,
    total_number_of_orders : total_number_of_orders,
    avg_orders_value : avg_orders_value,
    total_orders_value : total_orders_value,
    orders : orders
   }})
}


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

  const gstNumber = "09AAKCG0890R1ZR"

  if (!orderId) {
    return res.status(400).json({ message: "orderId is required" });
  }

  const order = await Orders.findOne({ order_id: orderId })
   
  if(order?.status !== "delivered" && !order?.isPaid){
    return res.status(400).json({ message: "Invoice can only be generated for delivered and paid orders" });
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
        totalItemPrice: +(item.price * item.quantity).toFixed(2),
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
