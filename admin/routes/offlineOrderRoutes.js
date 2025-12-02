import express from 'express';
import {
  getAllOfflineOrders,
  createOfflineOrder,
  getOfflineOrderById,
  updateOfflineOrderStatus,
  deleteOfflineOrder
} from '../controllers/offlineOrderController.js';
import { verifyAdminToken, authorize } from '../../middleware/auth.js';

const router = express.Router();

// All routes are protected and require admin access
router.use(verifyAdminToken);
router.use(authorize('admin', 'superadmin'));

// Get all offline orders
router.get('/', getAllOfflineOrders);

// Create new offline order
router.post('/', createOfflineOrder);

// Get offline order by ID
router.get('/:id', getOfflineOrderById);

// Update offline order status
router.patch('/:id/status', updateOfflineOrderStatus);

// Delete offline order
router.delete('/:id', deleteOfflineOrder);

export default router; 