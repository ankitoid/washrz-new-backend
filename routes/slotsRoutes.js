// routes/index.js

// import express from "express";
// import { copySlots, CreateZone, getSlots, resetSlots, saveSlots, SearchZones } from "../controller/adminSlotController.js";
// import { checkService } from "../services/slots.service.js";
// import {resolveZone} from "../models/slotController.js";

// const router = express.Router();
// // Location routes
// router.get("/location/resolve",resolveZone);

// // Admin slot management routes
// router.post("/admin/slots", saveSlots);
// router.get("/admin/slots", getSlots);
// router.delete("/admin/slots/reset", resetSlots);
// router.post("/admin/slots/copy", copySlots);

// // Service check for app
// router.post("/service/check", checkService);

// // create zones
// router.get("/admin/zones/create",CreateZone)
// router.get("/admin/zones/search", SearchZones);

// export { router as default };

import express from "express";
import { checkService, copySlots, CreateZone, deleteZone, generateSlotsConfig, getAllZones, getConfiguredDates, getSlots, getZoneSlots, resetSlots, resolveZone, saveSlots, SearchZones, setIsDelay } from "../controller/adminSlotController.js";


const router = express.Router();

// // Zone routes
// router.get("/zones", getAllZones);
// router.get("/zones/search", SearchZones);
// router.post("/zones/create", CreateZone);
// router.get("/location/resolve", resolveZone);

// // Slot management routes
// router.get("/admin/slots", getSlots);
// router.post("/admin/slots", saveSlots);
// router.post("/admin/slots/copy", copySlots);
// router.delete("/admin/slots/reset", resetSlots);

// // Service check
// router.post("/service/check", checkService);



// Zone management routes
router.get("/zones", getAllZones);
router.post("/zones/isDelay", setIsDelay);
router.get("/zones/search", SearchZones);
router.post("/zones/create", CreateZone);
router.get("/location/resolve", resolveZone);

// Slot management routes
router.get("/admin/slots", getSlots);
router.post("/admin/slots", saveSlots);
router.post("/admin/slots/generate", generateSlotsConfig);
router.post("/admin/slots/copy", copySlots);
router.delete("/admin/slots/reset", resetSlots);
router.get("/admin/slots/dates", getConfiguredDates);

// Zone specific slot routes
router.get("/admin/slots/zone/:zoneId", getZoneSlots);

// Service check for mobile app
router.post("/service/check", checkService);

// delete zone
router.delete("/admin/slots/:zoneId", deleteZone);


export default router;