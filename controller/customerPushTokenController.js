import mongoose from "mongoose";
import CustomerPushToken from "../models/customerPushTokenModel.js";

export const registerCustomerPushToken = async (req, res) => {
  try {
    const { customerId, token, platform, deviceId } = req.body;

    if (!customerId || !token) {
      return res.status(400).json({
        status: "error",
        message: "customerId and token are required",
      });
    }

    const doc = await CustomerPushToken.findOneAndUpdate(
      { token },
      {
        customerId: String(customerId),
        token,
        platform: platform || "android",
        deviceId: deviceId || null,
        isActive: true,
        lastSeenAt: new Date(),
        deactivationReason: null,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      status: "success",
      message: "Customer push token saved",
      data: doc,
    });
  } catch (error) {
    console.error("registerCustomerPushToken error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const unregisterCustomerPushToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "token is required",
      });
    }

    await CustomerPushToken.findOneAndUpdate(
      { token },
      {
        isActive: false,
        lastSeenAt: new Date(),
        deactivationReason: "manual logout",
      }
    );

    return res.status(200).json({
      status: "success",
      message: "Customer push token deactivated",
    });
  } catch (error) {
    console.error("unregisterCustomerPushToken error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};