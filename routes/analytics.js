import express from 'express';
import { verifyAdminToken, isAdmin } from '../middleware/auth.js';
import {
    getDashboardStats,
    getSalesData,
    getProductData,
    getUserData
} from '../controllers/analyticsController.js';

const router = express.Router();

// All routes are protected and require admin authentication
router.use(verifyAdminToken, isAdmin);

// Get dashboard statistics
router.get('/dashboard', getDashboardStats);

// Get sales data with optional period filter
router.get('/sales', getSalesData);

// Get product analytics
router.get('/products', getProductData);

// Get user analytics
router.get('/users', getUserData);

export default router; 