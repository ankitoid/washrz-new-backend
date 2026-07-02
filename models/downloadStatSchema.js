import mongoose from "mongoose";

const downloadStatSchema = new mongoose.Schema(
  {
    date: {
      type: Date, // Normalized to midnight UTC
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios"],
      required: true,
      index: true,
    },
    downloads: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to guarantee one record per day per platform
downloadStatSchema.index({ date: 1, platform: 1 }, { unique: true });

export default mongoose.model("DownloadStat", downloadStatSchema);
