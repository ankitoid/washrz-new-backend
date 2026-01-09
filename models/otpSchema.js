import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    Phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    Otp: {
      type: String,
      required: true,
    },
    Expire_At: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

const otp = mongoose.model("otp", otpSchema);
export default otp;