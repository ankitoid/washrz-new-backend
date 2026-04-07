import CustomerNotification from "../models/customerNotificationSchema.js";

export const createCustomerNotification = async ({
  customerId,
  title,
  message,
  type,
  data,
}) => {
  try {
    if (!customerId) return null;

    return await CustomerNotification.create({
      customerId: String(customerId),
      title,
      message,
      type,
      data,
    });
  } catch (error) {
    console.error("Customer notification create error:", error);
    return null;
  }
};

export const getCustomerNotifications = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        status: "error",
        message: "customerId is required",
      });
    }

    const notifications = await CustomerNotification.find({
      customerId: String(customerId),
    }).sort({ createdAt: -1 });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.status(200).json({
      status: "success",
      unreadCount,
      total: notifications.length,
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

    const notification = await CustomerNotification.findByIdAndUpdate(
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

    await CustomerNotification.updateMany(
      { customerId: String(customerId), isRead: false },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.status(200).json({
      status: "success",
      message: "All customer notifications marked as read",
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

    const notification = await CustomerNotification.findByIdAndDelete(id);

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