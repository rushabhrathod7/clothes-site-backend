// controllers/orderController.js

import Order from '../models/Order.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import mongoose from 'mongoose';

/**
 * Create a new order
 */
export const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, billingAddress, payment, subtotal, shippingCost, tax, total } = req.body;
    
    // Verify that req.user exists and has _id
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication failed or user not found'
      });
    }
    
    // Validate that items exist and is an array
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('Invalid items in request:', items);
      return res.status(400).json({
        success: false,
        error: 'Order must contain at least one item'
      });
    }

    // Generate order number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `ORD-${year}${month}${day}-${random}`;
    
    // Create new order
    const order = new Order({
      userId: req.user._id, // Ensure this is a valid MongoDB ObjectId
      orderNumber,
      items: await Promise.all(items.map(async (item) => {
        // Ensure productId is provided
        if (!item.productId) {
          throw new Error(`Missing productId for item: ${item.name}`);
        }
        
        // If we have a productId, try to get the product to include its details
        const product = await mongoose.model('Product').findById(item.productId).select('name price images').lean();
        
        if (!product) {
          throw new Error(`Product not found with ID: ${item.productId}`);
        }
        
        // Use product details to ensure consistency
        return {
          ...item,
          name: product.name, // Ensure name matches the product
          price: item.price || product.price, // Use provided price or fallback to product price
          image: product.images?.[0]?.url || null // Include product image if available
        };
      })),
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      payment: {
        ...payment,
        method: payment.method || 'cod'
      },
      subtotal,
      shippingCost,
      tax,
      total,
      status: 'pending'
    });

    // Validate the order before saving
    const validationError = order.validateSync();
    if (validationError) {
      console.error('Order validation error:', validationError);
      return res.status(400).json({ 
        success: false,
        error: validationError.message
      });
    }

    await order.save();

    // If payment method is online, create payment record
    if (payment.method === 'razorpay') {
      // Store the actual selected payment method from the frontend
      // This preserves the initial payment method selection (card, upi, etc.)
      const selectedPaymentMethod = req.body.selectedPaymentMethod || 'card';
      
      const paymentRecord = new Payment({
        orderId: order._id,
        userId: req.user._id,
        amount: total,
        status: 'pending',
        // We're initializing with the user's selected payment method
        razorpayOrderId: 'pending', // Will be updated later
        razorpayPaymentId: 'pending', // Will be updated later
        razorpaySignature: 'pending', // Will be updated later
        paymentMethod: selectedPaymentMethod // Using the provided payment method instead of 'pending'
      });
      await paymentRecord.save();
      
      console.log('Created initial payment record with method:', selectedPaymentMethod);
    }

    // Update user's orders array
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        orders: {
          orderId: order._id,
          status: 'pending',
          totalAmount: total,
          createdAt: new Date()
        }
      },
      $inc: {
        'statistics.totalOrders': 1,
        'statistics.totalSpent': total
      },
      $set: {
        'statistics.lastOrderDate': new Date()
      }
    });

    return res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ success: false, error: error.message || 'Order creation failed' });
  }
};

/**
 * Get all orders (admin only)
 */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
};

/**
 * Get order by ID
 */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'name email');
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check if user is authorized to view this order
    if (order.userId.toString() !== req.user._id.toString() && req.admin?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to view this order' });
    }

    // Also fetch payment details if they exist
    const payment = await Payment.findOne({ orderId: order._id });
    
    return res.status(200).json({
      success: true,
      data: {
        order,
        payment
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
};

/**
 * Update order status (admin only)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Update user's order status
    await User.findOneAndUpdate(
      { _id: order.userId, 'orders.orderId': order._id },
      { $set: { 'orders.$.status': status } }
    );

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
};

/**
 * Update payment status
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { status, paymentMethod } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        'payment.status': status,
        ...(paymentMethod && { 'payment.method': paymentMethod })
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // If payment is completed, update order status
    if (status === 'completed') {
      await Order.findByIdAndUpdate(req.params.id, { status: 'confirmed' });
      
      // Update payment record if it exists
      const updateData = { status: 'completed' };
      if (paymentMethod) {
        updateData.paymentMethod = paymentMethod;
      }
      
      await Payment.findOneAndUpdate(
        { orderId: order._id },
        updateData
      );
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update payment status' });
  }
};

/**
 * Get user's orders
 */
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    
    // Fetch corresponding payment details for each order
    const ordersWithPayments = await Promise.all(orders.map(async (order) => {
      const payment = await Payment.findOne({ orderId: order._id });
      return {
        order,
        payment
      };
    }));
    
    return res.status(200).json({
      success: true,
      data: ordersWithPayments
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch user orders' });
  }
};

/**
 * Cancel order
 */
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check if user is authorized to cancel this order
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this order' });
    }

    // Check if order can be cancelled
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      return res.status(400).json({ success: false, error: 'Order cannot be cancelled at this stage' });
    }

    // Update order status
    order.status = 'cancelled';
    await order.save();

    // Update user's order status
    await User.findOneAndUpdate(
      { _id: order.userId, 'orders.orderId': order._id },
      { $set: { 'orders.$.status': 'cancelled' } }
    );

    // If payment was made, initiate refund
    if (order.payment.status === 'completed') {
      // Add refund logic here
      // This would typically involve calling the payment gateway's refund API
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
};

/**
 * Check if user has purchased a product
 */
export const hasPurchasedProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Find orders where the user has purchased the product
    const order = await Order.findOne({
      userId: req.user._id,
      'items.productId': productId,
      status: { $in: ['confirmed', 'delivered', 'completed'] }
    });

    return res.status(200).json({
      success: true,
      hasPurchased: !!order
    });
  } catch (error) {
    console.error('Error checking purchase status:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check purchase status' 
    });
  }
};