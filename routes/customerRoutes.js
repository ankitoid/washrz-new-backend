import express from "express";
import {
  addCustomer,
  addOrder,
  addPickup,
  addSchedulePickup,
  changeOrderStatus,
  completePickup,
  deletePickup,
  getAssignedPickups,
  getCancelPickups,
  getCustomers,
  getOrderTotalBill,
  getOrders,
  getOrdersByFilter,
  getPickups,
  getSchedulePickups,
} from "../controller/customerController.js";
const router = express.Router();

router.post("/addPickup", addPickup);
router.get("/getPickups", getPickups);
router.get("/getAssignedPickups", getAssignedPickups);
router.post("/addSchedulePickup", addSchedulePickup);
router.get("/getSchedulePickups", getSchedulePickups);
router.post("/addCustomer", addCustomer);
router.get("/getCustomers", getCustomers);
router.put("/deletePickup/:id", deletePickup);
router.put("/completePickup/:id", completePickup);

router.post("/addOrder", addOrder);
router.get("/getOrders", getOrders);
router.get("/getOrdersByFilter", getOrdersByFilter);
router.get("/getOrderBill/:number", getOrderTotalBill);
router.get("/getCancelPickups", getCancelPickups);
router.put("/changeOrderStatus/:id", changeOrderStatus);

export { router as default };
