import express from "express";
import  {getActivePickupOrOrder, getCustomerOrders, getCustomerSingleOrderDetails, getCustomerSinglePickupDetails, getCustomersPickups}  from "../controller/customerAppController.js";

const router = express.Router();

router.get("/getCustomerOrders/:phoneNumber", getCustomerOrders);
router.get("/getCustomerSingleOrderDetails/:order_id",getCustomerSingleOrderDetails)
router.get("/getCustomerPickups",getCustomersPickups)
router.get("/getCustomerSinglePickupDetails/:pickup_id",getCustomerSinglePickupDetails)

//check for active pickup or order status===>>

router.get("/getActivePickupOrOrder/:phone",getActivePickupOrOrder)

export { router as default };