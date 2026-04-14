// routes/index.js

import express from "express";
import { copySlots, getSlots, resetSlots, saveSlots } from "../controller/adminSlotController.js";
import { checkService } from "../services/slots.service.js";
import { resolveZone } from "../models/slotController.js";

const router = express.Router();
// Location routes
router.get("/location/resolve",resolveZone);

// Admin slot management routes
router.post("/admin/slots", saveSlots);
router.get("/admin/slots", getSlots);
router.delete("/admin/slots/reset", resetSlots);
router.post("/admin/slots/copy", copySlots);

// Service check for app
router.post("/service/check", checkService);

export { router as default };