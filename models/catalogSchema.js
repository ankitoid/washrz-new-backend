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
    },
    originalName: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    size: {
      type: Number,
      min: 0,
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
    sacid: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
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
    _id: true,
  }
);

const catalogCategorySchema = new mongoose.Schema(
  {
    sacid: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
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
    coverImage: {
      type: String,
      trim: true,
    },
    items: {
      type: [catalogItemSchema],
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

catalogCategorySchema.index({ slug: 1 }, { unique: true });
catalogCategorySchema.index({ sacid: 1 }, { unique: true });
catalogCategorySchema.index({ label: 1, isActive: 1 });
catalogCategorySchema.index({ "items.sku": 1 });
catalogCategorySchema.index({ "items.sacid": 1 });

const Catalog = mongoose.model("Catalog", catalogCategorySchema);

export default Catalog;
