import multer from "multer";
import Catalog from "../models/catalogSchema.js";
import CatalogItem from "../models/catalogItemSchema.js";
import { protect, restrictTo } from "./authController.js";
import catalogSeed from "../config/catalogSeedData.js";
import {
  cleanupUnusedCatalogMedia,
  uploadCatalogFileToS3,
} from "../services/catalogMediaService.js";

const uploadCatalogMedia = multer({
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

const CATEGORY_POPULATE = {
  path: "category",
  select: "_id sacid label slug mainHeading mainDescription coverImage isActive sortOrder",
};

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

const mapCategoryList = (category, itemCount = 0) => ({
  _id: category._id,
  sacid: category.sacid,
  label: category.label,
  slug: category.slug,
  mainHeading: category.mainHeading,
  mainDescription: category.mainDescription,
  coverImage: category.coverImage,
  isActive: category.isActive,
  sortOrder: category.sortOrder,
  itemCount,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
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

const buildItemFilters = ({ search, type, minPrice, maxPrice, isActiveOnly }) => {
  const filter = {};

  if (isActiveOnly) {
    filter.isActive = isActiveOnly;
  }

  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch) {
    filter.$or = [
      { label: { $regex: normalizedSearch, $options: "i" } },
      { mainHeading: { $regex: normalizedSearch, $options: "i" } },
      { mainDescription: { $regex: normalizedSearch, $options: "i" } },
      { sku: { $regex: normalizedSearch, $options: "i" } },
      { sacid: { $regex: normalizedSearch, $options: "i" } },
    ];
  }

  const normalizedType = String(type || "").trim();
  if (normalizedType) {
    filter.type = { $regex: `^${normalizedType}$`, $options: "i" };
  }

  const priceFilter = {};
  if (Number.isFinite(minPrice)) {
    priceFilter.$gte = minPrice;
  }
  if (Number.isFinite(maxPrice)) {
    priceFilter.$lte = maxPrice;
  }
  if (Object.keys(priceFilter).length > 0) {
    filter.price = priceFilter;
  }


  return filter;
};

const getCategoryItemCounts = async (categoryIds, itemMatch = {}) => {
  if (categoryIds.length === 0) return new Map();

  const counts = await CatalogItem.aggregate([
    {
      $match: {
        ...itemMatch,
        category: { $in: categoryIds },
      },
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
  ]);

  return new Map(counts.map((entry) => [String(entry._id), entry.count]));
};

const getCategoryByIdOrFail = async (id) => {
  const category = await Catalog.findById(id);
  return category;
};

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
        { sacid: { $regex: search, $options: "i" } },
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

    const categoryIds = categories.map((category) => category._id);
    const itemCounts = await getCategoryItemCounts(categoryIds, { isActive: true });

    res.status(200).json({
      status: "success",
      data: categories.map((category) =>
        mapCategoryList(category, itemCounts.get(String(category._id)) || 0)
      ),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const getFullCatalog = async (req, res) => {
  try {
    const page = Math.max(toNumber(req.query.page, 1), 1);
    const limit = Math.min(Math.max(toNumber(req.query.limit, 10), 1), 100);
    
    // CHANGE 1: Replace includeInactive with isActive parameter
    // Default is null (no filter on isActive field)
    const isActive = req.query.isActive !== undefined 
      ? toBoolean(req.query.isActive, null) 
      : null;
    
    const minPrice =
      req.query.minPrice !== undefined ? toNumber(req.query.minPrice, NaN) : NaN;
    const maxPrice =
      req.query.maxPrice !== undefined ? toNumber(req.query.maxPrice, NaN) : NaN;

    // CHANGE 2: Remove isActiveOnly from buildItemFilters call
    const itemFilter = buildItemFilters({
      search: req.query.search,
      type: req.query.type,
      minPrice,
      maxPrice,
      // Remove this line: isActiveOnly: !includeInactive,
    });

    // CHANGE 3: Add isActive filter conditionally
    if (isActive !== null) {
      itemFilter.isActive = isActive;
    }
    // If isActive is null, don't add any isActive filter (return all items)

    const categorySlug = String(req.query.categorySlug || "").trim();
    if (categorySlug) {
      // CHANGE 4: Remove category active filtering
      const category = await Catalog.findOne({
        slug: categorySlug,
        // Remove this: ...(includeInactive ? {} : { isActive: true }),
      }).select("_id");

      if (!category) {
        return res.status(404).json({
          status: "error",
          message: "Catalog category not found.",
        });
      }

      itemFilter.category = category._id;
    } 
    // CHANGE 5: Remove the else block that filtered active categories
    // Delete this entire else block:
    // } else if (!includeInactive) {
    //   const activeCategoryIds = await Catalog.find({ isActive: true }).distinct("_id");
    //   itemFilter.category = { $in: activeCategoryIds };
    // }

    const [items, total] = await Promise.all([
      CatalogItem.find(itemFilter)
        .populate(CATEGORY_POPULATE)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CatalogItem.countDocuments(itemFilter),
    ]);

    res.status(200).json({
      status: "success",
      data: items,
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
    const minPrice =
      req.query.minPrice !== undefined ? toNumber(req.query.minPrice, NaN) : NaN;
    const maxPrice =
      req.query.maxPrice !== undefined ? toNumber(req.query.maxPrice, NaN) : NaN;

    const category = await Catalog.findOne({ slug, isActive: true }).lean();
    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    const isActiveStatus =  req.query.isActive


    const itemFilter = {
      ...buildItemFilters({
        search: req.query.search,
        type: req.query.type,
        minPrice,
        maxPrice,
        isActiveOnly: isActiveStatus,
      }),
      category: category._id,
    };

    const [items, totalItems] = await Promise.all([
      CatalogItem.find(itemFilter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CatalogItem.countDocuments(itemFilter),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        ...mapCategoryList(category, totalItems),
        items,
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

    const item = await CatalogItem.findById(itemId).populate(CATEGORY_POPULATE).lean();

    if (!item || !item.category || item.category.slug !== slug || item.isActive === false) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog item not found." });
    }

    if (item.category.isActive === false) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    res.status(200).json({
      status: "success",
      data: item,
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
        { sacid: { $regex: search, $options: "i" } },
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

    const categoryIds = categories.map((category) => category._id);
    const totalCounts = await getCategoryItemCounts(categoryIds);
    const activeCounts = await getCategoryItemCounts(categoryIds, { isActive: true });

    res.status(200).json({
      status: "success",
      data: categories.map((category) => ({
        ...mapCategoryList(category, activeCounts.get(String(category._id)) || 0),
        totalItems: totalCounts.get(String(category._id)) || 0,
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
      $or: [
        { slug: payload.slug },
        { label: payload.label },
        { sacid: payload.sacid },
      ],
    });

    if (existingCategory) {
      return res.status(409).json({
        status: "error",
        message: "Catalog category with the same sacid, label, or slug already exists.",
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
      $or: [
        { slug: payload.slug },
        { label: payload.label },
        { sacid: payload.sacid },
      ],
    });

    if (duplicateCategory) {
      return res.status(409).json({
        status: "error",
        message:
          "Another catalog category with the same sacid, label, or slug already exists.",
      });
    }

    Object.assign(category, payload);
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

    await CatalogItem.deleteMany({ category: id });

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
    const category = await getCategoryByIdOrFail(id);

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

    const duplicateItem = await CatalogItem.findOne({
      $or: [{ sku: payload.sku }],
    }).lean();

    if (duplicateItem) {
      return res.status(409).json({
        status: "error",
        message:
          "Catalog item with the same sku, sacid, or slug already exists.",
      });
    }

    const item = await CatalogItem.create({
      ...payload,
      category: category._id,
    });

    res.status(201).json({
      status: "success",
      message: "Catalog item created successfully.",
      data: item,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const updateItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const category = await getCategoryByIdOrFail(id);

    console.log('this is the value===>',id,itemId,category)

    if (!category) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog category not found." });
    }

    const item = await CatalogItem.findOne({ _id: itemId, category: id });
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

    console.log("this is the validationError==>>",validationError)

    if (validationError) {
      return res.status(400).json({ status: "error", message: validationError });
    }

    const duplicateItem = await CatalogItem.findOne({
      _id: { $ne: itemId },
      $or: [
        { sku: payload.sku },
        { sacid: payload.sacid },
        { category: id, slug: payload.slug },
      ],
    }).lean();


    if (duplicateItem) {
      return res.status(409).json({
        status: "error",
        message:
          "you can't update sku, sacid, or slug",
      });
    }

    Object.assign(item, payload, { category: category._id });
    await item.save();

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
    const item = await CatalogItem.findOneAndDelete({ _id: itemId, category: id });

    if (!item) {
      return res
        .status(404)
        .json({ status: "error", message: "Catalog item not found." });
    }

    res.status(200).json({
      status: "success",
      message: "Catalog item deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const uploadItemMedia = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const images = [...(req.files?.images || []), ...(req.files?.image || [])];
    const videos = [...(req.files?.videos || []), ...(req.files?.video || [])];

    if (images.length === 0 && videos.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one image or video file is required.",
      });
    }

    const item = await CatalogItem.findOne({ _id: itemId, category: id }).populate({
      path: "category",
      select: "slug label",
    });

    if (!item) {
      return res.status(404).json({
        status: "error",
        message: "Catalog item not found.",
      });
    }

    const categoryFolder = slugify(
      item.category?.slug || item.category?.label || String(id)
    );
    const itemFolder = slugify(item.slug || item.label || String(itemId));

    const imageFolder = `catalog-media/${categoryFolder}/${item.sku}/images`;
    const videoFolder = `catalog-media/${categoryFolder}/${item.sku}/videos`;

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
    await item.save();

    return res.status(200).json({
      status: "success",
      message: "Catalog media uploaded and attached successfully.",
      data: {
        itemId: item._id,
        category: item.category,
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
};

export const seedCatalog = async (req, res) => {
  try {
    let createdCategories = 0;
    let updatedCategories = 0;
    let upsertedItems = 0;

    for (const entry of catalogSeed) {
      let category = await Catalog.findOne({ slug: entry.slug });

      if (!category) {
        category = await Catalog.create({
          sacid: entry.sacid,
          label: entry.label,
          slug: entry.slug,
          mainHeading: entry.mainHeading,
          mainDescription: entry.mainDescription,
          coverImage: entry.coverImage || "",
          sortOrder: entry.sortOrder || 0,
          isActive: entry.isActive !== false,
        });
        createdCategories += 1;
      } else {
        Object.assign(category, {
          sacid: entry.sacid,
          label: entry.label,
          slug: entry.slug,
          mainHeading: entry.mainHeading,
          mainDescription: entry.mainDescription,
          coverImage: entry.coverImage || "",
          sortOrder: entry.sortOrder || 0,
          isActive: entry.isActive !== false,
        });
        await category.save();
        updatedCategories += 1;
      }

      const incomingSacids = entry.items.map((item) => item.sacid);

      for (const item of entry.items) {
        await CatalogItem.findOneAndUpdate(
          { sacid: item.sacid },
          {
            ...item,
            category: category._id,
            isActive: item.isActive !== false,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );
        upsertedItems += 1;
      }

      await CatalogItem.deleteMany({
        category: category._id,
        sacid: { $nin: incomingSacids },
      });
    }

    const [totalCategories, totalItems] = await Promise.all([
      Catalog.countDocuments(),
      CatalogItem.countDocuments(),
    ]);

    res.status(200).json({
      status: "success",
      message: "Catalog seed executed successfully.",
      data: {
        createdCategories,
        updatedCategories,
        upsertedItems,
        totalCategories,
        totalItems,
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

export { ADMIN_MIDDLEWARE, uploadCatalogMedia };
