// routes/subcategoryRoutes.js
import express from "express";
import {
  getAllSubcategories,
  getSubcategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from "../controllers/subcategoryController.js";
import { verifyAdminToken } from "../../middleware/auth.js";

// Import product routes to re-route
import productRouter from "./productRoutes.js";

const router = express.Router({ mergeParams: true });

// Re-route to product router
router.use("/:subcategoryId/products", productRouter);

// Public routes (no auth required)
router.get("/", getAllSubcategories);
router.get("/:id", getSubcategory);

// Protected routes (admin only)
router.post("/", verifyAdminToken, createSubcategory);
router.put("/:id", verifyAdminToken, updateSubcategory);
router.delete("/:id", verifyAdminToken, deleteSubcategory);

export default router;
