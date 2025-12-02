import express from "express";
import {
  getAllProducts,
  getProduct,
  searchProducts,
} from "../../admin/controllers/productController.js";
import {
  getAllCategories,
  getCategory,
} from "../../admin/controllers/categoryController.js";
import {
  getAllSubcategories,
  getSubcategory,
} from "../../admin/controllers/subcategoryController.js";

const router = express.Router();

// Public product routes
router.get("/products", getAllProducts);
router.get("/products/search", searchProducts);
router.get("/products/:id", getProduct);

// Public category routes
router.get("/categories", getAllCategories);
router.get("/categories/:id", getCategory);

// Public subcategory routes
router.get("/subcategories", getAllSubcategories);
router.get("/subcategories/:id", getSubcategory);

export default router; 