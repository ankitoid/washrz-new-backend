import express from "express";
import { protect } from "../controller/authController.js";
import { registerPushToken, removePushToken, listMyTokens } from "../controller/pushTokenController.js";

const router = express.Router();

router.post("/", registerPushToken);
router.delete("/", removePushToken);
router.get("/", listMyTokens);

export default router;