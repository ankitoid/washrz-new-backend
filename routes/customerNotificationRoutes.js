import express from "express";
import {
  getCustomerNotifications,
  markCustomerNotificationAsRead,
  markAllCustomerNotificationsAsRead,
  deleteCustomerNotification,
  clearAllCustomerNotifications,
} from "../controller/customerNotificationController.js";

const router = express.Router();

router.get("/:customerId", getCustomerNotifications);
router.patch("/read/:id", markCustomerNotificationAsRead);
router.patch("/read-all/:customerId", markAllCustomerNotificationsAsRead);
router.delete("/:id", deleteCustomerNotification);
router.delete("/clear/:customerId", clearAllCustomerNotifications);

export default router;