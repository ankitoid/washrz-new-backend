import Razorpay from "razorpay";
import Order from "../models/orderSchema.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


// ================= GENERATE QR =================

export const generateQR = async (req, res) => {
  try {

    const { orderId } = req.body;

    const order = await Order.findOne({ order_id: orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.isPaid) {
      return res.status(400).json({
        success: false,
        message: "Order already paid"
      });
    }

    const amount = order.totalAmount || order.price;

    const QR_EXPIRY_SECONDS = 600; // 10 minutes

    const now = Date.now();

    // ================= CHECK ACTIVE QR =================

    const activeQR = order.qrPayments?.find((q) => {

      if (!q.generatedAt) return false;

      const generatedTime = new Date(q.generatedAt).getTime();
      const expiryTime = generatedTime + QR_EXPIRY_SECONDS * 1000;

      return q.status === "generated" && now < expiryTime;

    });

    if (activeQR) {

      const generatedTime = new Date(activeQR.generatedAt).getTime();
      const expiryTime = generatedTime + QR_EXPIRY_SECONDS * 1000;

      const remainingSeconds = Math.floor((expiryTime - now) / 1000);

      return res.json({
        success: true,
        message: "QR already generated and still valid",
        qrId: activeQR.qrId,
        qrImageUrl: activeQR.qrImageUrl,
        qrString: activeQR.qrString,
        amount: activeQR.amount,
        expiresAt: new Date(expiryTime),
        remainingSeconds,
        remainingMinutes: Math.ceil(remainingSeconds / 60)
      });
    }

    // ================= CLOSE PREVIOUS QR =================

    const lastQR = order.qrPayments?.slice(-1)[0];

    if (lastQR && lastQR.status === "generated") {

      try {

        await razorpay.qrCode.close(lastQR.qrId);

        lastQR.status = "expired";

      } catch (err) {
        console.log("Previous QR close skipped:", err.message);
      }

    }

    // ================= CREATE NEW QR =================

    const closeBy = Math.floor(Date.now() / 1000) + QR_EXPIRY_SECONDS;

    const qr = await razorpay.qrCode.create({
      type: "upi_qr",
      name: "Delivery Payment",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: amount * 100,
      description: `Order ${order.order_id}`,
      close_by: closeBy,
      notes: {
        orderId: order.order_id
      }
    });

    const generatedAt = new Date();
    const expiryTime = generatedAt.getTime() + QR_EXPIRY_SECONDS * 1000;

    order.qrPayments.push({
      qrId: qr.id,
      qrImageUrl: qr.image_url,
      qrString: qr.qr_string,
      amount,
      status: "generated",
      orderId: order.order_id,
      generatedAt
    });

    await order.save();

    res.json({
      success: true,
      message: "QR generated successfully",
      qrId: qr.id,
      qrImageUrl: qr.image_url,
      qrString: qr.qr_string,
      amount,
      generatedAt,
      expiresAt: new Date(expiryTime),
      remainingSeconds: QR_EXPIRY_SECONDS,
      remainingMinutes: QR_EXPIRY_SECONDS / 60
    });

  } catch (error) {

    console.error("QR generation error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};



// ================= GET QR STATUS =================

export const getQRStatus = async (req, res) => {

  try {

    const { qrId } = req.params;

    const order = await Order.findOne({
      "qrPayments.qrId": qrId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "QR not found"
      });
    }

    const qr = order.qrPayments.find(q => q.qrId === qrId);

    res.json({
      success: true,
      status: qr.status,
      amount: qr.amount,
      paidAt: qr.paidAt
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};



// ================= CANCEL QR =================

export const cancelQR = async (req, res) => {

  try {

    const { qrId } = req.params;

    await razorpay.qrCodes.close(qrId);

    const order = await Order.findOne({
      "qrPayments.qrId": qrId
    });

    if (order) {

      const qr = order.qrPayments.find(q => q.qrId === qrId);

      qr.status = "cancelled";

      await order.save();
    }

    res.json({
      success: true,
      message: "QR cancelled"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};