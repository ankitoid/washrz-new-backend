import express from "express";
import {
  deleteUser,
  getAllUsers,
  getMedia,
  getOrderById,
  getPickupById,
  getplantusers,
  getUser,
  login,
  logoutUser,
  protect,
  refreshToken,
  signup,
  updateOrderStatus,
  updateUserPassword,
  uploadFiles,
} from "../controller/authController.js";
import { getProfile } from "../controller/userController.js";
const router = express.Router();

router.post("/login", login);
router.post("/logout", logoutUser);
router.post("/register", signup);
router.get("/refresh", refreshToken);
router.get("/profile", protect, getProfile);
router.get("/getallusers", getAllUsers);
router.get("/getplantusers", getplantusers);
router.delete("/deleteuser/:id", deleteUser);
router.patch("/updateOrderStatus/:id", updateOrderStatus);
router.post("/uploadFiles/:id", uploadFiles);
router.get("/getOrderById/:id", getOrderById);
router.get("/getPickupById/:id", getPickupById);
router.get("/getMedia/:orderId", getMedia);
router.get("/getuser/:id",getUser);
router.patch("/updatepassword/:id",updateUserPassword)

export { router as default };
