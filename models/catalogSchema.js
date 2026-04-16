import mongoose from "mongoose";

const catalogCategorySchema = new mongoose.Schema(
  {
    sacid: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    mainHeading: {
      type: String,
      required: true,
      trim: true,
    },
    mainDescription: {
      type: String,
      required: true,
      trim: true,
    },
    coverImage: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

catalogCategorySchema.index({ sacid: 1 }, { unique: true });
catalogCategorySchema.index({ slug: 1 }, { unique: true });
catalogCategorySchema.index({ label: 1, isActive: 1 });

const Catalog = mongoose.model("Catalog", catalogCategorySchema);

export default Catalog;
