import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { createNotification } from '../../admin/controllers/notificationController.js';

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
    const { amount, currency = 'INR', orderId, paymentMethod } = req.body;
    console.log('Creating Razorpay order with:', { amount, currency, orderId, paymentMethod });
    
    if (!amount || !orderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: amount or orderId' 
      });
    }

    // Validate amount is a positive number
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount: must be a positive number'
      });
    }

    // Convert amount to paise (multiply by 100)
    const amountInPaise = Math.round(amount * 100);
    console.log('Amount in paise:', amountInPaise);
    
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: orderId.toString()
    });
    console.log('Razorpay order created:', razorpayOrder);

    // Validate payment method and ensure it's not lost
    const validPaymentMethod = paymentMethod || 'card';
    console.log('Using payment method:', validPaymentMethod);

    // Check if payment record already exists
    const existingPayment = await Payment.findOne({ orderId });
    
    if (existingPayment) {
      // Update existing payment record
      existingPayment.razorpayOrderId = razorpayOrder.id;
      existingPayment.amount = amount;
      existingPayment.currency = currency;
      
      if (paymentMethod && paymentMethod !== 'razorpay') {
        existingPayment.paymentMethod = validPaymentMethod;
      }
      
      await existingPayment.save();
      console.log('Updated existing payment record:', existingPayment);
    } else {
      // Create new payment record
      const payment = new Payment({
        orderId,
        userId: req.user._id,
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency,
        status: 'pending',
        paymentMethod: validPaymentMethod
      });
      await payment.save();
      console.log('Created new payment record:', payment);
    }

    // Update order with payment details
    await Order.findByIdAndUpdate(orderId, {
      'payment.method': 'razorpay',
      'payment.status': 'pending',
      'payment.razorpayOrderId': razorpayOrder.id,
      'payment.amount': amount
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentMethod: validPaymentMethod
      }
    });
  } catch (error) {
    console.error('Detailed error in createOrder:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status
    });

    // Handle specific Razorpay errors
    if (error.error) {
      return res.status(400).json({
        success: false,
        error: error.error.description || 'Payment initialization failed',
        details: error.error
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'Payment initialization failed',
      details: error.message 
    });
  }
};

/**
 * Verify payment
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_method, order_id } = req.body;
    
    console.log('Payment verification request received:', { 
      razorpay_order_id, 
      razorpay_payment_id,
      payment_method,
      order_id,
      hasSignature: !!razorpay_signature
    });

    // Validate all required fields
    const missingFields = [];
    if (!razorpay_order_id) missingFields.push('razorpay_order_id');
    if (!razorpay_payment_id) missingFields.push('razorpay_payment_id');
    if (!razorpay_signature) missingFields.push('razorpay_signature');
    if (!order_id) missingFields.push('order_id');

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required payment verification fields',
        missingFields
      });
    }
    
    // Verify payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    console.log('Signature verification:', {
      received: razorpay_signature,
      expected: expectedSignature,
      body: body
    });

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch:', {
        received: razorpay_signature,
        expected: expectedSignature
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid payment signature',
        details: {
          received: razorpay_signature,
          expected: expectedSignature
        }
      });
    }

    // Fetch payment details from Razorpay
    const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    console.log('Razorpay Payment Details:', JSON.stringify(razorpayPayment, null, 2));

    // Map Razorpay payment method to our payment method
    let paymentMethod = payment_method || 'card';
    
    if (razorpayPayment.method) {
      console.log(`Detected payment method from Razorpay: ${razorpayPayment.method}`);
      
      if (razorpayPayment.method === 'upi' || razorpayPayment.method === 'upi_intent') {
        paymentMethod = 'upi';
      } else if (razorpayPayment.method === 'netbanking') {
        paymentMethod = 'netbanking';
      } else if (razorpayPayment.method === 'wallet') {
        paymentMethod = 'wallet';
      } else if (razorpayPayment.method === 'emi') {
        paymentMethod = 'emi';
      } else if (razorpayPayment.method === 'card') {
        paymentMethod = 'card';
      }
    }

    console.log('Final Payment Method:', paymentMethod);

    // Find the payment record
    const existingPayment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!existingPayment) {
      console.error('Payment record not found for order ID:', razorpay_order_id);
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Extract payment details based on method
    const paymentDetails = {
      ...(paymentMethod === 'upi' && { 
        upi: { 
          vpa: razorpayPayment.vpa || 
               (razorpayPayment.upi && razorpayPayment.upi.vpa) || 
               (razorpayPayment.upi_intent && razorpayPayment.upi_intent.vpa) || 
               'unknown'
        } 
      }),
      ...(paymentMethod === 'netbanking' && { 
        bank: { 
          name: razorpayPayment.bank || 
                (razorpayPayment.netbanking && razorpayPayment.netbanking.bank_name) || 
                'unknown',
          ifsc: razorpayPayment.ifsc || 
                (razorpayPayment.netbanking && razorpayPayment.netbanking.ifsc) || 
                'unknown'
        } 
      }),
      ...(paymentMethod === 'wallet' && { 
        wallet: { 
          name: razorpayPayment.wallet || 
                (razorpayPayment.wallet && razorpayPayment.wallet.name) || 
                'unknown'
        } 
      }),
      ...(paymentMethod === 'card' && { 
        card: { 
          last4: (razorpayPayment.card && (razorpayPayment.card.last4 || razorpayPayment.card.last4_digits)) || 'unknown',
          network: (razorpayPayment.card && (razorpayPayment.card.network || razorpayPayment.card.card_network)) || 'unknown',
          issuer: (razorpayPayment.card && (razorpayPayment.card.issuer || razorpayPayment.card.issuer_name)) || 'unknown'
        }
      })
    };

    // Update payment record with actual payment details
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'completed',
        paymentMethod: paymentMethod,
        paymentDetails: paymentDetails
      },
      { new: true }
    );

    console.log('Updated payment record with actual details:', payment);

    // Update order payment status and order status
    const updatedOrder = await Order.findByIdAndUpdate(order_id, {
      'payment.status': 'completed',
      'payment.razorpayPaymentId': razorpay_payment_id,
      'payment.razorpaySignature': razorpay_signature,
      'payment.method': 'razorpay', 
      'payment.paymentMethod': paymentMethod,
      status: 'confirmed'
    }, { new: true });

    console.log('Updated order with payment details:', updatedOrder);

    return res.status(200).json({ 
      success: true, 
      data: payment,
      message: `Payment successful via ${paymentMethod}`
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Payment verification failed',
      details: error.message 
    });
  }
};

/**
 * Handle payment webhook
 */
export const handlePaymentWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Razorpay webhook:', payload);

    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = payload.event;
    console.log('Processing webhook event:', event);

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
        console.log('Unhandled webhook event:', event);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle payment captured event
 */
async function handlePaymentCaptured(payload) {
  try {
    const payment = payload.payload.payment.entity;
    const order = await Order.findOne({ 'payment.razorpayOrderId': payment.order_id });
    
    if (!order) {
      console.error('Order not found for payment:', payment.order_id);
      return;
    }

    // Create notification for successful payment
    await createNotification(
      'payment',
      `Payment of ₹${payment.amount / 100} received for order #${order.orderNumber}`,
      {
        paymentId: payment.id,
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: payment.amount / 100,
        status: 'success'
      }
    );

    // Update order and payment status
    await Order.findByIdAndUpdate(order._id, {
      'payment.status': 'completed',
      'payment.razorpayPaymentId': payment.id,
      'payment.details': payment
    });

    await Payment.findOneAndUpdate(
      { razorpayOrderId: payment.order_id },
      {
        status: 'completed',
        razorpayPaymentId: payment.id,
        paymentDetails: payment
      }
    );
  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(payload) {
  try {
    const payment = payload.payload.payment.entity;
    const order = await Order.findOne({ 'payment.razorpayOrderId': payment.order_id });
    
    if (!order) {
      console.error('Order not found for failed payment:', payment.order_id);
      return;
    }

    // Create notification for failed payment
    await createNotification(
      'payment',
      `Payment of ₹${payment.amount / 100} failed for order #${order.orderNumber}`,
      {
        paymentId: payment.id,
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: payment.amount / 100,
        status: 'failed',
        error: payment.error_description
      }
    );

    // Update order and payment status
    await Order.findByIdAndUpdate(order._id, {
      'payment.status': 'failed',
      'payment.error': payment.error_description
    });

    await Payment.findOneAndUpdate(
      { razorpayOrderId: payment.order_id },
      {
        status: 'failed',
        error: payment.error_description
      }
    );
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

/**
 * Handle refund created event
 */
async function handleRefundCreated(payload) {
  try {
    const refund = payload.payload.refund.entity;
    const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
    
    if (!payment) {
      console.error('Payment not found for refund:', refund.payment_id);
      return;
    }

    const order = await Order.findById(payment.orderId);
    if (!order) {
      console.error('Order not found for refund:', payment.orderId);
      return;
    }

    // Create notification for refund
    await createNotification(
      'payment',
      `Refund of ₹${refund.amount / 100} processed for order #${order.orderNumber}`,
      {
        paymentId: payment._id,
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: refund.amount / 100,
        status: 'refunded'
      }
    );

    // Update payment status
    await Payment.findByIdAndUpdate(payment._id, {
      status: 'refunded',
      refundDetails: refund
    });
  } catch (error) {
    console.error('Error handling refund created:', error);
  }
}

// Test Razorpay configuration
export const testRazorpayConfig = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay API keys are not configured',
        keyId: !!process.env.RAZORPAY_KEY_ID,
        keySecret: !!process.env.RAZORPAY_KEY_SECRET
      });
    }

    // Test Razorpay connection
    const testOrder = await razorpay.orders.create({
      amount: 100,
      currency: 'INR',
      receipt: 'test-order'
    });

    return res.status(200).json({
      success: true,
      message: 'Razorpay configuration is working',
      testOrder
    });
  } catch (error) {
    console.error('Razorpay test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Razorpay test failed',
      details: error.message
    });
  }
};