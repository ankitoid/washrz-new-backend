import express from "express";
import {
  getRiderNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from "../controller/notificationController.js";


const router = express.Router();

//get notifications for rider
router.get("/:riderId",  getRiderNotifications);

//mark single read
router.patch("/read/:id", markAsRead);

//mark all read
router.patch("/read-all/:riderId",  markAllAsRead);

//delete one
router.delete("/:id",  deleteNotification);

//clear all
router.delete("/clear/:riderId",  clearAllNotifications);

export default router;