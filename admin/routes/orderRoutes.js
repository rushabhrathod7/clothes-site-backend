import express from 'express';
import { 
    getAllOrders, 
    getOrderDetails, 
    updateOrderStatus,
    deleteOrder
} from '../controllers/orderController.js';
import { verifyAdminToken, authorize } from '../../middleware/auth.js';

const router = express.Router();

// All routes are protected and only accessible by admin
router.use(verifyAdminToken);
router.use(authorize('admin', 'superadmin'));

router.route('/')
    .get(getAllOrders);

router.route('/:id')
    .get(getOrderDetails)
    .patch(updateOrderStatus)
    .delete(deleteOrder);

export default router; 