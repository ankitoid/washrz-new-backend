import express from "express";
import {getRevenue,getRevenueComparison} from "../controller/revenueController.js"
const router = express.Router();

router.get("/revenue", getRevenue);
router.get("/revenue/comparison", getRevenueComparison);

export default router;
