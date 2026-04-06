import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
        "pickup_assigned",
        "delivery_assigned",
        "order_update",
        "system",
      ],
      required: true,
    },

    data: {
      orderId: String,
      pickupId: String,
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
  {
    timestamps: true,
  }
);

notificationSchema.index({ riderId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);