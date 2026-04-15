import multer from "multer";
import Catalog from "../models/catalogSchema.js";
import { protect, restrictTo } from "./authController.js";
import catalogSeed from "../config/catalogSeedData.js";
import {
  cleanupUnusedCatalogMedia,
  uploadCatalogFileToS3,
} from "../services/catalogMediaService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 20,
  },
}).fields([
  { name: "image", maxCount: 10 },
  { name: "images", maxCount: 10 },
  { name: "video", maxCount: 10 },
  { name: "videos", maxCount: 10 },
]);

const ADMIN_MIDDLEWARE = [protect, restrictTo("admin", "plant-manager")];

const slugify = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseProcess = (process = []) => {
  if (!Array.isArray(process)) return [];

  return process.map((entry, index) => ({
    step: toNumber(entry.step, index + 1),
    heading: String(entry.heading || "").trim(),
    description: String(entry.description || "").trim(),
  }));
};

const normalizeMedia = (media = [], expectedKind) => {
  if (!Array.isArray(media)) return [];

  return media
    .filter((entry) => entry && entry.url)
    .map((entry) => ({
      url: entry.url,
      key: entry.key || "",
      originalName: entry.originalName || "",
      mimeType: entry.mimeType || "",
      size: toNumber(entry.size, 0),
      kind: expectedKind,
    }));
};

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

const buildCategoryPayload = (body = {}) => ({
  sacid: String(body.sacid || "").trim(),
  label: String(body.label || "").trim(),
  slug: slugify(body.slug || body.label || ""),
  mainHeading: String(body.mainHeading || body.label || "").trim(),
  mainDescription: String(body.mainDescription || "").trim(),
  coverImage: String(body.coverImage || "").trim(),
  isActive: toBoolean(body.isActive, true),
  sortOrder: toNumber(body.sortOrder, 0),
});

const buildItemPayload = (body = {}, fallbackLabel = "") => {
  const label = String(body.label || fallbackLabel || "").trim();

  return {
    sacid: String(body.sacid || "").trim(),
    sku: String(body.sku || "").trim(),
    slug: slugify(body.slug || body.sku || label),
    label,
    mainHeading: String(body.mainHeading || label).trim(),
    mainDescription: String(body.mainDescription || "").trim(),
    price: toNumber(body.price, NaN),
    displayPrice: String(body.displayPrice || "").trim(),
    unit: String(body.unit || "pc").trim(),
    type: String(body.type || "").trim(),
    process: parseProcess(body.process),
    images: normalizeMedia(body.images, "image"),
    videos: normalizeMedia(body.videos, "video"),
    isActive: toBoolean(body.isActive, true),
    sortOrder: toNumber(body.sortOrder, 0),
  };
};

const validateCategoryPayload = (payload) => {
  if (!payload.sacid) return "Category sacid is required.";
  if (!payload.label) return "Category label is required.";
  if (!payload.slug) return "Category slug is required.";
  if (!payload.mainHeading) return "Category mainHeading is required.";
  if (!payload.mainDescription) return "Category mainDescription is required.";
  return null;
};

const validateItemPayload = (payload) => {
  if (!payload.sacid) return "Item sacid is required.";
  if (!payload.sku) return "Item sku is required.";
  if (!payload.label) return "Item label is required.";
  if (!payload.mainHeading) return "Item mainHeading is required.";
  if (!payload.mainDescription) return "Item mainDescription is required.";
  if (!Number.isFinite(payload.price)) return "Item price is required.";
  if (!payload.type) return "Item type is required.";

  for (const [index, step] of payload.process.entries()) {
    if (!step.heading || !step.description) {
      return `Process entry ${index + 1} must include heading and description.`;
    }
  }

  return null;
};

const getPublishedItems = (items = []) =>
  items.filter((item) => item.isActive !== false);

const mapCategoryList = (category) => ({
  _id: category._id,
  sacid: category.sacid,
  label: category.label,
  slug: category.slug,
  mainHeading: category.mainHeading,
  mainDescription: category.mainDescription,
  coverImage: category.coverImage,
  isActive: category.isActive,
  sortOrder: category.sortOrder,
  itemCount: getPublishedItems(category.items).length,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
  items: category.items
});

export const list = async (req, res) => {
  try {
    const page = Math.max(toNumber(req.query.page, 1), 1);
    const limit = Math.min(Math.max(toNumber(req.query.limit, 10), 1), 100);
    const search = String(req.query.search || "").trim();

    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { label: { $regex: search, $options: "i" } },
        { mainHeading: { $regex: search, $options: "i" } },
        { mainDescription: { $regex: search, $options: "i" } },
      ];
    }

    const [categories, total] = await Promise.all([
      Catalog.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Catalog.countDocuments(filter),
    ]);

    res.status(200).json({
      status: "success",
      data: categories.map(mapCategoryList),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const getCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = Math.max(toNumber(req.query.page, 1), 1);
    const limit = Math.min(Math.max(toNumber(req.query.limit, 10), 1), 100);
    const search = String(req.query.search || "").trim().toLowerCase();
    const type = String(req.query.type || "").trim().toLowerCase();
    const minPrice =
      req.query.minPrice !== undefined ? toNumber(req.query.minPrice, NaN) : null;
    const maxPrice =
      req.query.maxPrice !== undefined ? toNumber(req.query.maxPrice, NaN) : null;

    const category = await Catalog.findOne({ slug, isActive: true }).lean();
    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    let items = getPublishedItems(category.items || []);

    if (search) {
      items = items.filter((item) =>
        [item.label, item.mainHeading, item.mainDescription, item.sku, item.sacid]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(search))
      );
    }

    if (type) {
      items = items.filter(
        (item) => String(item.type || "").toLowerCase() === type
      );
    }

    if (Number.isFinite(minPrice)) {
      items = items.filter((item) => Number(item.price) >= minPrice);
    }

    if (Number.isFinite(maxPrice)) {
      items = items.filter((item) => Number(item.price) <= maxPrice);
    }

    items.sort((a, b) => {
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      return a.label.localeCompare(b.label);
    });

    const totalItems = items.length;
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    res.status(200).json({
      status: "success",
      data: {
        _id: category._id,
        sacid: category.sacid,
        label: category.label,
        slug: category.slug,
        mainHeading: category.mainHeading,
        mainDescription: category.mainDescription,
        coverImage: category.coverImage,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        items: paginatedItems,
      },
      pagination: buildPagination(page, limit, totalItems),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const getItem = async (req, res) => {
  try {
    const { slug, itemId } = req.params;

    const category = await Catalog.findOne({ slug, isActive: true }).lean();
    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    const item = (category.items || []).find(
      (entry) => String(entry._id) === itemId && entry.isActive !== false
    );

    if (!item) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog item not found." });
    }

    res.status(200).json({
      status: "success",
      data: {
        category: {
          _id: category._id,
          label: category.label,
          slug: category.slug,
        },
        item,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const adminListCategories = async (req, res) => {
  try {
    const page = Math.max(toNumber(req.query.page, 1), 1);
    const limit = Math.min(Math.max(toNumber(req.query.limit, 10), 1), 100);
    const includeInactive = toBoolean(req.query.includeInactive, false);
    const search = String(req.query.search || "").trim();

    const filter = includeInactive ? {} : { isActive: true };
    if (search) {
      filter.$or = [
        { label: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { "items.label": { $regex: search, $options: "i" } },
        { "items.sku": { $regex: search, $options: "i" } },
        { "items.sacid": { $regex: search, $options: "i" } },
      ];
    }

    const [categories, total] = await Promise.all([
      Catalog.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Catalog.countDocuments(filter),
    ]);

    res.status(200).json({
      status: "success",
      data: categories.map((category) => ({
        ...mapCategoryList(category),
        totalItems: category.items?.length || 0,
      })),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const payload = buildCategoryPayload(req.body);
    const validationError = validateCategoryPayload(payload);

    if (validationError) {
      return res.status(400).json({ status: "error", message: validationError });
    }

    const existingCategory = await Catalog.findOne({
      $or: [{ slug: payload.slug }, { label: payload.label }],
    });

    if (existingCategory) {
      return res.status(409).json({
        status: "error",
        message: "Catalog category with the same label or slug already exists.",
      });
    }

    const category = await Catalog.create(payload);

    res.status(201).json({
      status: "success",
      message: "Catalog category created successfully.",
      data: category,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Catalog.findById(id);

    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    const payload = buildCategoryPayload({
      ...category.toObject(),
      ...req.body,
    });

    const validationError = validateCategoryPayload(payload);
    if (validationError) {
      return res.status(400).json({ status: "error", message: validationError });
    }

    const duplicateCategory = await Catalog.findOne({
      _id: { $ne: id },
      $or: [{ slug: payload.slug }, { label: payload.label }],
    });

    if (duplicateCategory) {
      return res.status(409).json({
        status: "error",
        message:
          "Another catalog category with the same label or slug already exists.",
      });
    }

    category.label = payload.label;
    category.sacid = payload.sacid;
    category.slug = payload.slug;
    category.mainHeading = payload.mainHeading;
    category.mainDescription = payload.mainDescription;
    category.coverImage = payload.coverImage;
    category.isActive = payload.isActive;
    category.sortOrder = payload.sortOrder;

    await category.save();

    res.status(200).json({
      status: "success",
      message: "Catalog category updated successfully.",
      data: category,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Catalog.findByIdAndDelete(id);

    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    res.status(200).json({
      status: "success",
      message: "Catalog category deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const addItem = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Catalog.findById(id);

    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    const payload = buildItemPayload(req.body);
    const validationError = validateItemPayload(payload);

    if (validationError) {
      return res.status(400).json({ status: "error", message: validationError });
    }

    const duplicateItem = category.items.find(
      (item) =>
        item.sku.toLowerCase() === payload.sku.toLowerCase() ||
        (payload.sacid &&
          item.sacid?.toLowerCase() === payload.sacid.toLowerCase()) ||
        item.slug.toLowerCase() === payload.slug.toLowerCase()
    );

    if (duplicateItem) {
      return res.status(409).json({
        status: "error",
        message:
          "Catalog item with the same sku, sacid, or slug already exists in this category.",
      });
    }

    category.items.push(payload);
    await category.save();

    const newItem = category.items[category.items.length - 1];

    res.status(201).json({
      status: "success",
      message: "Catalog item created successfully.",
      data: newItem,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const updateItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const category = await Catalog.findById(id);

    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    const item = category.items.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog item not found." });
    }

    const payload = buildItemPayload({
      ...item.toObject(),
      ...req.body,
    });
    const validationError = validateItemPayload(payload);

    if (validationError) {
      return res.status(400).json({ status: "error", message: validationError });
    }

    const duplicateItem = category.items.find(
      (entry) =>
        String(entry._id) !== itemId &&
        (entry.sku.toLowerCase() === payload.sku.toLowerCase() ||
          (payload.sacid &&
            entry.sacid?.toLowerCase() === payload.sacid.toLowerCase()) ||
          entry.slug.toLowerCase() === payload.slug.toLowerCase())
    );

    if (duplicateItem) {
      return res.status(409).json({
        status: "error",
        message:
          "Another item with the same sku, sacid, or slug already exists in this category.",
      });
    }

    Object.assign(item, payload);
    await category.save();

    res.status(200).json({
      status: "success",
      message: "Catalog item updated successfully.",
      data: item,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const category = await Catalog.findById(id);

    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    const item = category.items.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog item not found." });
    }

    category.items.pull({ _id: itemId });
    await category.save();

    res.status(200).json({
      status: "success",
      message: "Catalog item deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const uploadItemMedia = async (req, res) => {
  console.log()
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ status: "error", message: err.message });
    }

    console.log("this is the files:: ",  req.params, req.files?.images)

    try {
      const { id, itemId } = req.params;
      const images = [
        ...(req.files?.images || []),
        ...(req.files?.image || []),
      ];
      const videos = [
        ...(req.files?.videos || []),
        ...(req.files?.video || []),
      ];

      if (images.length === 0 && videos.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "At least one image or video file is required.",
        });
      }

      const category = await Catalog.findById(id);
      if (!category) {
        return res.status(404).json({
          status: "error",
          message: "Catalog category not found.",
        });
      }

      const item = category.items.id(itemId);
      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "Catalog item not found.",
        });
      }

      const categoryFolder = slugify(
        category.slug || category.label || String(category._id)
      );
      const itemFolder = slugify(item.slug || item.label || String(itemId));

      const imageFolder = `catalog-photos/${categoryFolder}/${itemFolder}/images`;
      const videoFolder = `catalog-photos/${categoryFolder}/${itemFolder}/videos`;

      const uploadedImages = [];
      for (const file of images) {
        const uploaded = await uploadCatalogFileToS3(file, imageFolder);
        uploadedImages.push(uploaded);
      }

      const uploadedVideos = [];
      for (const file of videos) {
        const uploaded = await uploadCatalogFileToS3(file, videoFolder);
        uploadedVideos.push(uploaded);
      }

      item.images.push(...uploadedImages);
      item.videos.push(...uploadedVideos);
      await category.save();

      return res.status(200).json({
        status: "success",
        message: "Catalog media uploaded and attached successfully.",
        data: {
          itemId: item._id,
          category: {
            id: category._id,
            slug: category.slug,
            label: category.label,
          },
          itemPaths: {
            imageFolder,
            videoFolder,
          },
          images: uploadedImages,
          videos: uploadedVideos,
          item,
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  });
};

export const seedCatalog = async (req, res) => {
  try {
    let created = 0;
    let updated = 0;

    for (const entry of catalogSeed) {
      const existingCategory = await Catalog.findOne({ slug: entry.slug });

      if (existingCategory) {
        existingCategory.label = entry.label;
        existingCategory.mainHeading = entry.mainHeading;
        existingCategory.mainDescription = entry.mainDescription;
        existingCategory.coverImage = entry.coverImage || "";
        existingCategory.sortOrder = entry.sortOrder || 0;
        existingCategory.isActive = true;
        existingCategory.items = entry.items;
        await existingCategory.save();
        updated += 1;
      } else {
        await Catalog.create(entry);
        created += 1;
      }
    }

    const totalCategories = await Catalog.countDocuments();

    res.status(200).json({
      status: "success",
      message: "Catalog seed executed successfully.",
      data: {
        created,
        updated,
        totalCategories,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const cleanupMedia = async (req, res) => {
  try {
    const olderThanHours = Math.max(toNumber(req.body.olderThanHours, 24), 1);
    const dryRun = toBoolean(req.body.dryRun, true);

    const result = await cleanupUnusedCatalogMedia({
      prefix: "catalog-photos/",
      olderThanHours,
      dryRun,
    });

    res.status(200).json({
      status: "success",
      message: dryRun
        ? "Catalog media cleanup dry run completed."
        : "Catalog media cleanup completed.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export { ADMIN_MIDDLEWARE };
