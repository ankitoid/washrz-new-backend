import mongoose from "mongoose";

const catalogProcessSchema = new mongoose.Schema(
  {
    step: {
      type: Number,
      required: true,
      min: 1,
    },
    heading: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const catalogMediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      trim: true,
      default: "",
    },
    originalName: {
      type: String,
      trim: true,
      default: "",
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
    },
    size: {
      type: Number,
      min: 0,
      default: 0,
    },
    kind: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
  },
  { _id: false }
);

const catalogItemSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Catalog",
      required: true,
      index: true,
    },
    sacid: {
      type: String,
      required: true,
      trim: true,
      // unique: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
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
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    displayPrice: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      enum: ["kg", "pc", "service", "set"],
      default: "pc",
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    process: {
      type: [catalogProcessSchema],
      default: [],
    },
    images: {
      type: [catalogMediaSchema],
      default: [],
    },
    videos: {
      type: [catalogMediaSchema],
      default: [],
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

// catalogItemSchema.index({ category: 1, slug: 1 }, { unique: true });
catalogItemSchema.index({ category: 1, sortOrder: 1, createdAt: -1 });
catalogItemSchema.index({ category: 1, isActive: 1 });
catalogItemSchema.index({ label: 1, mainHeading: 1, mainDescription: 1 });

const CatalogItem = mongoose.model("CatalogItem", catalogItemSchema);

export default CatalogItem;
