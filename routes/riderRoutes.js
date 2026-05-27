import express from "express";
import {
  addMoreIntransitImages,
  createFollowupPickup,
  deletePickup,
  getCancelMedia,
  getRescheduledOrders,
  getRescheduledPickups,
  getRiderDashboardData,
  getRiderPickups,
  getRiderTasksById,
  rescheduleOrder,
  reschedulePickup,
  uploadReadyForDeliveryImages,
  uploadCancelInfo,
  uploadDeliverImage,
  uploadFiles,
} from "../controller/riderController.js";

const router = express.Router();

// router.post("/uploadFiles/:id", uploadFiles);
router.put("/reschedulePickup/:id", reschedulePickup);
router.get("/rescheduled-pickups", getRescheduledPickups);
router.get("/getriderpickups",getRiderPickups)
router.put("/deletePickup/:id", deletePickup);
router.post("/uploadCancelInfo/:id", uploadCancelInfo);
// router.get("/rescheduled-pickups", getRescheduledPickups);
router.put("/rescheduleorder/:id", rescheduleOrder);
router.get("/rescheduled-Orders", getRescheduledOrders);
router.get("/getCancelMedia/:pickupId", getCancelMedia);
router.patch("/orders/:id/intransit-images", addMoreIntransitImages);
router.patch("/orders/:id/ready-for-delivery-images", uploadReadyForDeliveryImages);
router.post("/uploadDeliverImage/:id", uploadDeliverImage);
router.post("/orders/:orderId/followup-pickup", createFollowupPickup);
router.get("/rider-dashboard", getRiderDashboardData);
router.get("/rider-tasks/:riderId", getRiderTasksById);

export { router as default };
