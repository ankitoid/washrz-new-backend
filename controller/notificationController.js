import mongoose from "mongoose";
import Notification from "../models/notificationSchema.js";
import Pickup from "../models/pickupSchema.js";
import Order from "../models/orderSchema.js";

/*
CREATE NOTIFICATION
Used internally when pickup or delivery assigned
*/
export const createNotification = async ({
  riderId,
  title,
  message,
  type,
  data,
}) => {
  try {
    if (!riderId) {
      console.log("Notification skipped: riderId missing");
      return null;
    }

    const notification = await Notification.create({
      riderId,
      title,
      message,
      type,
      data,
    });

    return notification;
  } catch (error) {
    console.error("Notification create error:", error);
  }
};

/*
GET RIDER NOTIFICATIONS
*/
export const getRiderNotifications = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!riderId) {
      return res.status(400).json({
        status: "error",
        message: "riderId is required",
      });
    }

    const notifications = await Notification.find({
      riderId: new mongoose.Types.ObjectId(riderId),
    }).sort({ createdAt: -1 });

    const filteredNotifications = [];

    for (const n of notifications) {

      // ✅ PICKUP → only assigned
      if (n.type === "pickup_assigned" && n.data?.pickupId) {

        const pickup = await Pickup.findById(n.data.pickupId);

        if (!pickup) continue;

        if (pickup.PickupStatus === "assigned") {
          filteredNotifications.push(n);
        }

        continue;
      }

      // ✅ DELIVERY → only "delivery rider assigned"
      if (n.type === "delivery_assigned" && n.data?.orderId) {

        const order = await Order.findById(n.data.orderId);

        if (!order) continue;

        if (order.status === "delivery rider assigned") {
          filteredNotifications.push(n);
        }

        continue;
      }
    }

    const unreadCount = filteredNotifications.filter(
      (n) => !n.isRead
    ).length;

    res.status(200).json({
      status: "success",
      unreadCount,
      total: filteredNotifications.length,
      data: filteredNotifications,
    });

  } catch (error) {
    console.error("getRiderNotifications error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};
/*
MARK SINGLE NOTIFICATION READ
*/
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: notification,
    });
  } catch (error) {
    console.error("markAsRead error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};

/*
MARK ALL AS READ (based on riderId)
*/
export const markAllAsRead = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!riderId) {
      return res.status(400).json({
        status: "error",
        message: "riderId is required",
      });
    }

    await Notification.updateMany(
      {
        riderId: new mongoose.Types.ObjectId(riderId),
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.status(200).json({
      status: "success",
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("markAllAsRead error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};

/*
DELETE SINGLE NOTIFICATION
*/
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("deleteNotification error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};

/*
CLEAR ALL NOTIFICATIONS FOR RIDER
*/
export const clearAllNotifications = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!riderId) {
      return res.status(400).json({
        status: "error",
        message: "riderId is required",
      });
    }

    await Notification.deleteMany({
      riderId: new mongoose.Types.ObjectId(riderId),
    });

    res.status(200).json({
      status: "success",
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error("clearAllNotifications error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};