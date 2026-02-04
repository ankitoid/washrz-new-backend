import express from "express";
import { protect } from "../controller/authController.js";
import { registerPushToken, removePushToken, listMyTokens } from "../controller/pushTokenController.js";

const router = express.Router();

router.post("/",protect, registerPushToken);
router.delete("/",protect, removePushToken);
router.get("/",protect, listMyTokens);

export default router;