import express from "express";
import {
  ADMIN_MIDDLEWARE,
  addItem,
  adminListCategories,
  cleanupMedia,
  createCategory,
  deleteCategory,
  deleteItem,
  getFullCatalog,
  getCategory,
  getItem,
  list,
  seedCatalog,
  updateCategory,
  updateItem,
  uploadItemMedia,
} from "../controller/catalogController.js";

const router = express.Router();

router.get("/", list);
router.get("/full", getFullCatalog);
router.get("/admin/categories", ...ADMIN_MIDDLEWARE, adminListCategories);
router.post("/cleanup-media", ...ADMIN_MIDDLEWARE, cleanupMedia);
router.post("/seed", ...ADMIN_MIDDLEWARE, seedCatalog);
router.post("/", ...ADMIN_MIDDLEWARE, createCategory);
router.patch("/:id", ...ADMIN_MIDDLEWARE, updateCategory);
router.delete("/:id", ...ADMIN_MIDDLEWARE, deleteCategory);
router.post("/:id/items", ...ADMIN_MIDDLEWARE, addItem);
router.post("/:id/items/:itemId/media", ...ADMIN_MIDDLEWARE, uploadItemMedia);
router.patch("/:id/items/:itemId", ...ADMIN_MIDDLEWARE, updateItem);
router.delete("/:id/items/:itemId", ...ADMIN_MIDDLEWARE, deleteItem);
router.get("/:slug/items/:itemId", getItem);
router.get("/:slug", getCategory);

export { router as default };
