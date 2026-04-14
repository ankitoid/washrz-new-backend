import express from "express";
import {
  generateQR,
  getQRStatus,
  cancelQR
} from "../controller/qrController.js";

const router = express.Router();

// Rider generates QR for payment
router.post("/generate", generateQR);

// Check QR status
router.get("/status/:qrId", getQRStatus);

// Cancel QR
router.post("/cancel/:qrId", cancelQR);

export default router;