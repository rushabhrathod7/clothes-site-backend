import express from 'express';
import { 
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getProductReviews,
  getUserReviews
} from '../controllers/adminReviewController.js';
import { verifyAdminToken } from '../../middleware/auth.js';

const router = express.Router();

// No need for additional middleware as verifyAdminToken is already applied in server.js
// for all routes under /api/admin

// Get all reviews with pagination and filtering
router.get('/', getAllReviews);

// Get a specific review by ID
router.get('/:id', getReviewById);

// Update a review
router.put('/:id', updateReview);

// Delete a review
router.delete('/:id', deleteReview);

// Get all reviews for a specific product
router.get('/product/:productId', getProductReviews);

// Get all reviews by a specific user
router.get('/user/:userId', getUserReviews);

export default router;
