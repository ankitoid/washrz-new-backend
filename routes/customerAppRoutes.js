import express from "express";
import  {getCustomerOrders, getCustomerSingleOrderDetails, getCustomersPickups}  from "../controller/customerAppController.js";

const router = express.Router();

router.get("/getCustomerOrders/:phoneNumber", getCustomerOrders);
router.get("/getCustomerSingleOrderDetails/:order_id",getCustomerSingleOrderDetails)
router.get("/getCustomerPickups",getCustomersPickups)

export { router as default };