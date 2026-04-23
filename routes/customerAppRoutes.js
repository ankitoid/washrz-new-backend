import express from "express";
import  {getCustomerOrders, getCustomerSingleOrderDetails, getCustomerSinglePickupDetails, getCustomersPickups}  from "../controller/customerAppController.js";

const router = express.Router();

router.get("/getCustomerOrders/:phoneNumber", getCustomerOrders);
router.get("/getCustomerSingleOrderDetails/:order_id",getCustomerSingleOrderDetails)
router.get("/getCustomerPickups",getCustomersPickups)
router.get("/getCustomerSinglePickupDetails/:pickup_id",getCustomerSinglePickupDetails)

export { router as default };