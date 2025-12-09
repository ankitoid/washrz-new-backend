import express from "express";
import { getProfile } from "../controller/userController";
const router = express.Router();

router.get("/profile", getProfile);

export { router as default };
