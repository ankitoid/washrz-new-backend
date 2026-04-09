import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/orderSchema.js";

// ================= RAZORPAY INSTANCE =================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ================= INITIATE PAYMENT =================

export const initiatePayment = async (req, res) => {
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

    const amount = order.totalAmount || order.price || 0;

    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: order.order_id
    });

    order.payment = {
      paymentId: razorpayOrder.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amount,
      currency: "INR",
      status: "pending",
      paymentGateway: "razorpay",
      initiatedAt: new Date()
    };

    await order.save();

    res.status(200).json({
      success: true,
      message: "Razorpay order created",
      orderId: order.order_id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Initiate payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
      error: error.message
    });
  }
};

// ================= VERIFY PAYMENT =================

export const verifyRazorpayPayment = async (req, res) => {

  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // ================= VERIFY SIGNATURE =================

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {

      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });

    }

    // ================= FIND ORDER =================

    const order = await Order.findOne({
      "payment.razorpayOrderId": razorpay_order_id
    });

    if (!order) {

      return res.status(404).json({
        success: false,
        message: "Order not found"
      });

    }

    // ================= PREVENT DUPLICATE =================

    if (order.isPaid) {

      return res.json({
        success: true,
        message: "Payment already verified",
        orderId: order.order_id
      });

    }

    // ================= UPDATE PAYMENT =================

    order.payment.paymentId = razorpay_payment_id;
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.paymentGateway = "razorpay";
    order.payment.status = "success";

    order.isPaid = true;

    order.markModified("payment");

    // ✅ CONFIRM COUPON AFTER PAYMENT
await coupons_service.confirmAfterPayment({
  orderId: order.order_id,
})

    await order.save();

    console.log("Payment verified:", order.order_id);

    // ================= SOCKET =================

    if (req.socket) {

      req.socket.to("admin-dashboard").emit("paymentUpdate", {
        orderId: order.order_id,
        paymentStatus: "success",
        isPaid: true,
        orderStatus: order.status,
        amount: order.totalAmount || order.price,
        transactionId: razorpay_payment_id,
        time: new Date()
      });

    }

    return res.json({
      success: true,
      message: "Payment verified successfully",
      orderId: order.order_id
    });

  } catch (error) {

    console.error("Payment verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message
    });

  }
};

// ================= PAYMENT STATUS =================

export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ order_id: orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.status(200).json({
      success: true,
      isPaid: order.isPaid || false,
      paymentStatus: order.payment?.status || "pending",
      paymentMode: order.payment?.paymentMode,
      transactionId: order.payment?.razorpayPaymentId,
      amount: order.totalAmount || order.price || 0,
      orderStatus: order.status,
      orderId: order.order_id,
      paymentId: order.payment?.paymentId,
      paymentInitiatedAt: order.payment?.initiatedAt,
      paymentCompletedAt: order.payment?.completedAt
    });

  } catch (error) {
    console.error("Check payment status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message
    });
  }
};

// ================= MANUAL PAYMENT =================

export const markAsPaid = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMode = "cash", transactionId, notes } = req.body;

    const order = await Order.findOne({ order_id: orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    order.payment = {
      paymentId: `MANUAL${Date.now()}`,
      transactionId: transactionId || `CASH${Date.now()}`,
      amount: order.totalAmount || order.price || 0,
      status: "success",
      paymentMode,
      methodDetails: {
        paymentMode,
        processedBy: req.user?.id || "admin"
      },
      completedAt: new Date(),
      isManual: true
    };

    order.isPaid = true;

    if (notes) order.notes = (order.notes || "") + `\nManual payment: ${notes}`;

    if (order.status === "pending" || order.status === "confirmed") {
      order.status = "processing";
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order marked as paid successfully"
    });

  } catch (error) {
    console.error("Mark as paid error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark as paid",
      error: error.message
    });
  }
};

// ================= REFUND =================

export const initiateRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, reason } = req.body;

    const order = await Order.findOne({ order_id: orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!order.isPaid) {
      return res.status(400).json({
        success: false,
        message: "Order not paid yet"
      });
    }

    order.payment.refundStatus = "initiated";
    order.payment.refundAmount =
      refundAmount || (order.totalAmount || order.price);

    order.payment.refundReason = reason;
    order.payment.refundInitiatedAt = new Date();
    order.status = "refund_pending";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Refund initiated successfully"
    });

  } catch (error) {
    console.error("Refund error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to initiate refund",
      error: error.message
    });
  }
};



export const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSignature) {
      console.log("❌ Webhook signature mismatch");
      return res.status(400).json({ success: false });
    }

    const event = req.body.event;
    console.log("✅ Razorpay webhook event:", event);

    // =====================================================
    // ================= PAYMENT CAPTURED ===================
    // =====================================================

    if (event === "payment.captured") {
      const payment = req.body.payload.payment.entity;

      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      console.log("🔍 PAYMENT DEBUG:", {
        order_id: payment.order_id,
        reference_id: payment.reference_id,
        notes: payment.notes,
        method: payment.method,
      });

      let order = null;

      // ---------- 1. NORMAL PAYMENT ----------
      if (razorpayOrderId) {
        order = await Order.findOne({
          "payment.razorpayOrderId": razorpayOrderId,
        });
      }

      // ---------- 2. QR PAYMENT (BEST WAY) ----------
      if (!order && payment.reference_id) {
        order = await Order.findOne({
          order_id: payment.reference_id,
        });
      }

      // ---------- 3. FALLBACK ----------
      if (!order && payment.notes?.orderId) {
        order = await Order.findOne({
          order_id: payment.notes.orderId,
        });
      }

      if (!order) {
        console.log("⚠️ Order not found for webhook");
        return res.status(200).json({ success: true });
      }

      // ---------- DUPLICATE SAFETY ----------
      if (order.isPaid) {
        console.log("⚠️ Payment already processed:", order.order_id);
        return res.status(200).json({ success: true });
      }

      // =====================================================
      // ================= PAYMENT MODE =======================
      // =====================================================

      let paymentMode = "unknown";

      if (payment.method === "upi") paymentMode = "upi";
      else if (payment.method === "netbanking") paymentMode = "netbanking";
      else if (payment.method === "wallet") paymentMode = "wallet";
      else if (payment.method === "emi") paymentMode = "emi";
      else if (payment.method === "card") {
        if (payment.card?.type === "credit") paymentMode = "credit_card";
        else if (payment.card?.type === "debit") paymentMode = "debit_card";
      }

      // =====================================================
      // ================= UPDATE ORDER ======================
      // =====================================================

      // ✅ FIX: ensure payment object exists
      if (!order.payment) {
        order.payment = {};
      }

      order.payment.paymentId = razorpayPaymentId;
      order.payment.razorpayPaymentId = razorpayPaymentId;
      order.payment.status = "success";
      order.payment.paymentGateway = "razorpay";
      order.payment.paymentMode = paymentMode;
      order.payment.amount = payment.amount / 100;

      order.isPaid = true;

      // ---------- UPDATE QR PAYMENT IF EXISTS ----------
      if (order.qrPayments && order.qrPayments.length > 0) {
        const qrPayment = order.qrPayments.find(
          (q) => q.status !== "paid"
        );

        if (qrPayment) {
          qrPayment.status = "paid";
          qrPayment.paymentId = razorpayPaymentId;
          qrPayment.paidAt = new Date();
        }
      }

      order.markModified("payment");
      order.markModified("qrPayments");

      await order.save();

      await coupons_service.confirmAfterPayment({
  orderId: order.order_id,
});

      console.log("✅ Webhook updated order:", order.order_id);

      // =====================================================
      // ================= SOCKET ============================
      // =====================================================

      if (req.socket) {
        req.socket.to("admin-dashboard").emit("paymentUpdate", {
          orderId: order.order_id,
          paymentStatus: "success",
          isPaid: true,
          orderStatus: order.status,
          amount: order.totalAmount || order.price,
          transactionId: razorpayPaymentId,
          time: new Date(),
        });

        // hariom codes here
        req.socket.to(`order:${order.order_id}`).emit("paymentUpdate", {
          orderId: order.order_id,
          paymentStatus: "success",
          isPaid: true,
        });
      }
    }

    // =====================================================
    // ================= PAYMENT FAILED =====================
    // =====================================================

    if (event === "payment.failed") {
      const payment = req.body.payload.payment.entity;

      let order = null;

      if (payment.order_id) {
        order = await Order.findOne({
          "payment.razorpayOrderId": payment.order_id,
        });
      }

      if (!order && payment.reference_id) {
        order = await Order.findOne({
          order_id: payment.reference_id,
        });
      }

      if (!order && payment.notes?.orderId) {
        order = await Order.findOne({
          order_id: payment.notes.orderId,
        });
      }

      if (order) {
        if (!order.payment) {
          order.payment = {};
        }

        order.payment.status = "failed";

        order.markModified("payment");

        await order.save();

        console.log("❌ Payment failed for order:", order.order_id);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed",
    });
  } catch (error) {
    console.error("🔥 Webhook error:", error);

    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
};