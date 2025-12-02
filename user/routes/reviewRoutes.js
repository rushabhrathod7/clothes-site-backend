import express from 'express';
import { verifyClerkAuth } from '../../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  getUserReviews
} from '../controllers/reviewController.js';

const router = express.Router();

// Configure multer for memory storage (we'll handle the file in the controller)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpe?g|png|webp/;
    const mimetypes = /^image\/(jpe?g|png|webp)$/;
    
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = mimetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images only! Please upload only images (jpg, jpeg, png, webp)'));
    }
  }
});

// Create a new review (with image upload support)
router.post(
  '/',
  verifyClerkAuth,
  upload.array('images', 5), // Max 5 images per review
  createReview
);

// Get reviews for a product
router.get('/product/:productId', getProductReviews);

// Get current user's reviews
router.get('/user/me', verifyClerkAuth, getUserReviews);

// Update a review (with image upload support)
router.put(
  '/:id',
  verifyClerkAuth,
  upload.array('images', 5), // Max 5 images per review
  updateReview
);

// Delete a review
router.delete('/:id', verifyClerkAuth, deleteReview);

export default router;
