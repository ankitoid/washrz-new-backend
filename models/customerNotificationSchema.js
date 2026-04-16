import mongoose from "mongoose";

const customerNotificationSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "pickup_Created",
        "pickup_Assigned",
        "pickup_Rescheduled",
        "pickup_Completed",
        "out_for_Delivery",
        "order_Delivered",
        "system",
      ],
      required: true,
    },
    data: {
      pickupId: String,
      orderId: String,
      screen: String,
      extra: Object,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

customerNotificationSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model(
  "CustomerNotification",
  customerNotificationSchema,
);
