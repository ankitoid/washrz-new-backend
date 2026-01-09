import express from "express";
import {
  deletePickup,
  getCancelMedia,
  getRescheduledOrders,
  getRescheduledPickups,
  getRiderDashboardData,
  getRiderPickups,
  rescheduleOrder,
  reschedulePickup,
  uploadCancelInfo,
  uploadDeliverImage,
  uploadFiles,
} from "../controller/riderController.js";

const router = express.Router();

router.post("/uploadFiles/:id", uploadFiles);
router.put("/reschedulePickup/:id", reschedulePickup);
router.get("/rescheduled-pickups", getRescheduledPickups);
router.get("/getriderpickups",getRiderPickups)
router.put("/deletePickup/:id", deletePickup);
router.post("/uploadCancelInfo/:id", uploadCancelInfo);
// router.get("/rescheduled-pickups", getRescheduledPickups);
router.put("/rescheduleorder/:id", rescheduleOrder);
router.get("/rescheduled-Orders", getRescheduledOrders);
router.get("/getCancelMedia/:pickupId", getCancelMedia);
router.post("/uploadDeliverImage/:id", uploadDeliverImage);
router.get("/rider-dashboard", getRiderDashboardData);

export { router as default };
