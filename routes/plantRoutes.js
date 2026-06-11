import express from "express";
import {
  addPlant,
  assignPickupRider,
  assignPlant,
  assignRider,
  deletePlant,
  getAllPlants,
  getRiderPlantDestination,
  getRiders,
} from "../controller/plantController.js";

const router = express.Router();

router.post("/addPlant", addPlant);
router.get("/getAllPlants", getAllPlants);
router.get("/rider/:riderId/destination", getRiderPlantDestination);
router.delete("/deletePlant/:id", deletePlant);
router.put("/assignPlant/:pickupId", assignPlant);
router.get("/getRiders", getRiders);
router.patch("/assignRider", assignRider);
router.patch("/assignPickupRider", assignPickupRider);

export { router as default };
