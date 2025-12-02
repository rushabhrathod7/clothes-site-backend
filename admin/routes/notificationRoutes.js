import express from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController.js';
import { verifyAdminToken } from '../../middleware/auth.js';

const router = express.Router();

// Get all notifications
router.get('/', verifyAdminToken, getNotifications);

// Mark notification as read
router.patch('/:id/read', verifyAdminToken, markAsRead);

// Mark all notifications as read
router.patch('/read-all', verifyAdminToken, markAllAsRead);

export default router; 