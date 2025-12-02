// routes/productRoutes.js
import express from "express";
import multer from "multer";
import {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  uploadProductImages,
  deleteProductImage
} from "../controllers/productController.js";

const router = express.Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only images
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Public routes (no auth required)
router.get("/search", searchProducts);
router.get("/", getAllProducts);
router.get("/:id", getProduct);

// Protected routes (admin only)
router.post("/", upload.array('images', 5), createProduct);
router.put("/:id", upload.array('images', 5), updateProduct);
router.delete("/:id", deleteProduct);
router.post("/:id/images", upload.array('images', 5), uploadProductImages);
router.delete("/:id/images/:imageId", deleteProductImage);

export default router;