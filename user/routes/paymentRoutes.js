// routes/paymentRoutes.js

import express from 'express';
import { verifyClerkAuth } from '../../middleware/auth.js';
import {
  createOrder,
  verifyPayment,
  handlePaymentWebhook,
  testRazorpayConfig
} from '../controllers/paymentController.js';

const router = express.Router();

// Test Razorpay configuration
router.get('/test-config', testRazorpayConfig);

// Create Razorpay order (user auth required)
router.post('/create-order', verifyClerkAuth, createOrder);

// Verify payment (user auth required)
router.post('/verify', verifyClerkAuth, verifyPayment);

// Payment webhook (no auth required but verified by signature)
router.post('/webhook', handlePaymentWebhook);

// For testing auth
router.get('/test-auth', verifyClerkAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    user: {
      id: req.user.id,
      email: req.user.email
    }
  });
});

export default router;