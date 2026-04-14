import express from "express";
import {
  registerCustomerPushToken,
  unregisterCustomerPushToken,
} from "../controller/customerPushTokenController.js";

const router = express.Router();

router.post("/register", registerCustomerPushToken);
router.post("/unregister", unregisterCustomerPushToken);

export default router;