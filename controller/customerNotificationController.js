import CustomerNotification from "../models/customerNotificationSchema.js";
import { emitToUser } from "../utills/socket.js";
import customerFcmService from "../services/customerFcmService.js";

export const createCustomerNotification = async ({
  customerId,
  title,
  message,
  type,
  data,
}) => {
  try {
    if (!customerId) return null;

    const notification = await CustomerNotification.create({
      customerId: String(customerId),
      title,
      message,
      type,
      data,
    });

    const unreadCount = await CustomerNotification.countDocuments({
      customerId: String(customerId),
      isRead: false,
    });

    emitToUser(String(customerId), "CUSTOMER_NOTIFICATION", {
      notification,
      unreadCount,
    });

    // Also send FCM push notification(ss)
    try {
      await customerFcmService.sendToCustomer(
        customerId,
        {
          title: title || "Notification",
          body: message || "",
        },
        {
          ...(data || {}),
          type: type || "notification",
        }
      );
    } catch (fcmError) {
      console.error("Failed to send FCM in createCustomerNotification:", fcmError);
    }

    return notification;
  } catch (error) {
    console.error("Customer notification create error:", error);
    return null;
  }
};

export const getCustomerNotifications = async (req, res) => {
  try {
    const { customerId } = req.params;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!customerId) {
      return res.status(400).json({
        status: "error",
        message: "customerId is required",
      });
    }

    const [notifications, total] = await Promise.all([
      CustomerNotification.find({
        customerId: String(customerId),
        isRead: false,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      CustomerNotification.countDocuments({
        customerId: String(customerId),
        isRead: false,
      }),
    ]);

    return res.status(200).json({
      status: "success",
      total,
      page,
      limit,
      data: notifications,
    });
  } catch (error) {
    console.error("getCustomerNotifications error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const markCustomerNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        status: "error",
        message: "customerId is required",
      });
    }

    const notification = await CustomerNotification.findOneAndUpdate(
      {
        _id: id,
        customerId: String(customerId),
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
    }

    const unreadCount = await CustomerNotification.countDocuments({
      customerId: String(customerId),
      isRead: false,
    });

    emitToUser(String(customerId), "CUSTOMER_NOTIFICATION_READ", {
      id,
      unreadCount,
    });

    return res.status(200).json({
      status: "success",
      data: notification,
    });
  } catch (error) {
    console.error("markCustomerNotificationAsRead error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const markAllCustomerNotificationsAsRead = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        status: "error",
        message: "customerId is required",
      });
    }

    const result = await CustomerNotification.updateMany(
      {
        customerId: String(customerId),
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    emitToUser(String(customerId), "CUSTOMER_NOTIFICATION_READ_ALL", {
      unreadCount: 0,
    });

    return res.status(200).json({
      status: "success",
      message: "All unread notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("markAllCustomerNotificationsAsRead error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const deleteCustomerNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({
        status: "error",
        message: "customerId is required",
      });
    }

    const notification = await CustomerNotification.findOneAndDelete({
      _id: id,
      customerId: String(customerId),
    });

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("deleteCustomerNotification error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const clearAllCustomerNotifications = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        status: "error",
        message: "customerId is required",
      });
    }

    await CustomerNotification.deleteMany({
      customerId: String(customerId),
    });

    return res.status(200).json({
      status: "success",
      message: "All customer notifications cleared",
    });
  } catch (error) {
    console.error("clearAllCustomerNotifications error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};