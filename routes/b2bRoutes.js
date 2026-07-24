import express from "express";
import { createB2bRequest, getAllB2bRequests, updateB2bRequestStatus } from "../controller/b2bController.js";

const router = express.Router();

router.post("/submit", createB2bRequest);
router.get("/", getAllB2bRequests);
router.patch("/:id", updateB2bRequestStatus);

export default router;
