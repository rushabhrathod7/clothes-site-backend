import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a Razorpay order
 */
export const createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', orderId } = req.body;
    
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency,
      receipt: orderId
    });

    // Create payment record
    const payment = new Payment({
      orderId,
      userId: req.user._id,
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency,
      status: 'pending'
    });

    await payment.save();

    return res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      }
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({ success: false, error: 'Payment initialization failed' });
  }
};

/**
 * Verify payment and update order status
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    // Verify payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'completed'
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Update order status
    await Order.findByIdAndUpdate(payment.orderId, {
      status: 'confirmed',
      paymentStatus: 'paid'
    });

    // Update user statistics
    await User.findByIdAndUpdate(payment.userId, {
      $inc: {
        'statistics.totalOrders': 1,
        'statistics.totalSpent': payment.amount
      },
      $set: {
        'statistics.lastOrderDate': new Date()
      }
    });

    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

/**
 * Handle payment webhook
 */
export const handlePaymentWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;

    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;
      case 'refund.created':
        await handleRefundCreated(payload);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling payment webhook:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
};

/**
 * Handle payment captured event
 */
async function handlePaymentCaptured(payload) {
  const { payment } = payload;
  await Payment.findOneAndUpdate(
    { razorpayPaymentId: payment.id },
    { status: 'completed' }
  );
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(payload) {
  const { payment } = payload;
  await Payment.findOneAndUpdate(
    { razorpayPaymentId: payment.id },
    { status: 'failed' }
  );
}

/**
 * Handle refund created event
 */
async function handleRefundCreated(payload) {
  const { refund } = payload;
  const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
  
  if (payment) {
    payment.refunds.push({
      amount: refund.amount / 100, // Convert from paise to rupees
      status: 'processed',
      reason: refund.reason || 'Customer request'
    });
    
    await payment.save();
    
    // Update user statistics
    await User.findByIdAndUpdate(payment.userId, {
      $inc: {
        'statistics.totalRefunds': 1,
        'statistics.totalRefundAmount': refund.amount / 100
      }
    });
  }
} 