import express from "express";
import {
  addCustomer,
  addOrder,
  addPickup,
  addSchedulePickup,
  changeOrderStatus,
  completePickup,
  deleteOrderById,
  deletePickup,
  getAssignedPickups,
  getCancelPickups,
  getCustomers,
  getOrderByOrderId,
  getOrderTotalBill,
  getOrders,
  getOrdersByEmailAndDate,
  getOrdersByFilter,
  getPickupById,
  getPickups,
  getSchedulePickups,
  updateOrderById,
  updatePickupById,
  getOrdersByEmailAndDateRange
} from "../controller/customerController.js";
const router = express.Router();

router.post("/addPickup", addPickup);
router.get("/getPickups", getPickups);
router.get("/getAssignedPickups", getAssignedPickups);
router.post("/addSchedulePickup", addSchedulePickup);
router.get("/getSchedulePickups", getSchedulePickups);
router.post("/addCustomer", addCustomer);
router.get("/getCustomers", getCustomers);
router.patch("/deletePickup/:id", deletePickup);
router.put("/completePickup/:id", completePickup);
// router.post("/getpickupbyId/:id",)
router.route("/pickupbyId/:id").get(getPickupById).patch(updatePickupById)

router.post("/addOrder", addOrder);
router.get("/getOrders", getOrders);
router.get("/getOrdersByFilter", getOrdersByFilter);
router.get("/getOrderBill/:number", getOrderTotalBill);
router.get("/getCancelPickups", getCancelPickups);
router.put("/changeOrderStatus/:id", changeOrderStatus);

router.post("/get_order_by_id", getOrderByOrderId);
router.put("/update_order_by_id/:id", updateOrderById);
router.delete("/delete_order_by_id/:id", deleteOrderById);
router.get("/getOrdersByEmailAndDate", getOrdersByEmailAndDate);
router.get("/getOrdersByEmailAndDateRange", getOrdersByEmailAndDateRange);

export { router as default };
