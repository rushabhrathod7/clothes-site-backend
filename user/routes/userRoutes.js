import express from 'express';
const router = express.Router();
import { 
  getAllUsers, 
  getUserByClerkId, 
  getUserById,
  getUserByEmail,
  updateUserMetadata,
  deleteUser,
  syncUserFromClerk,
  syncUserById,
  updateUserDetails,
  updateUserAddress,
  getUserOrders,
  getUserReviews,
  updateUserName
} from '../controllers/userController.js';
import { processWebhook } from '../../shared/controllers/webhookController.js';
import { verifyAdminToken, verifyClerkAuth, verifyClerkWebhook } from '../../middleware/auth.js';
// import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

// Webhook route (no auth required but verified by signature)
router.post('/webhook', verifyClerkWebhook, processWebhook);

// User routes (protected)
// router.get('/', requireAuth, requireAdmin, getAllUsers);
// router.get('/clerk/:clerkId', requireAuth, getUserByClerkId);
// router.get('/id/:id', requireAuth, getUserById);
// router.patch('/metadata/:clerkId', requireAuth, updateUserMetadata);
// router.delete('/:clerkId', requireAuth, requireAdmin, deleteUser);
// router.post('/sync/:clerkId', requireAuth, requireAdmin, syncUserFromClerk);

router.get('/', verifyAdminToken, getAllUsers);
router.get('/clerk/:clerkId', verifyClerkAuth, getUserByClerkId);
router.get('/email/:email', verifyAdminToken, getUserByEmail);
router.get('/id/:id', verifyClerkAuth, getUserById);
router.patch('/metadata/:clerkId', verifyClerkAuth, updateUserMetadata);
router.delete('/:clerkId', verifyAdminToken, deleteUser);
router.post('/sync/:clerkId', verifyAdminToken, syncUserFromClerk);
router.post('/sync/id/:id', verifyAdminToken, syncUserById);
router.patch('/:id/name', verifyAdminToken, updateUserName);

// New user routes
router.patch('/:id', verifyClerkAuth, updateUserDetails);
router.post('/:id/addresses', verifyClerkAuth, updateUserAddress);
router.get('/:id/orders', verifyClerkAuth, getUserOrders);
router.get('/:id/reviews', verifyClerkAuth, getUserReviews);

export default router;