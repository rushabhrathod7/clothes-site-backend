// routes/categoryRoutes.js
import express from "express";
import {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { verifyAdminToken } from "../../middleware/auth.js";

// Import subcategory routes to re-route
import subcategoryRouter from "./subcategoryRoutes.js";
// Import product routes to re-route
import productRouter from "./productRoutes.js";

const router = express.Router();

// Re-route to subcategory router
router.use("/:categoryId/subcategories", subcategoryRouter);

// Add this line to re-route to product router
router.use("/:categoryId/products", productRouter);

// Public routes (no auth required)
router.get("/", getAllCategories);
router.get("/:id", getCategory);

// Protected routes (admin only)
router.post("/", verifyAdminToken, createCategory);
router.put("/:id", verifyAdminToken, updateCategory);
router.delete("/:id", verifyAdminToken, deleteCategory);

export default router;
