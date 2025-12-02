import OfflineOrder from '../models/OfflineOrder.js';
import Product from '../models/Product.js';
import { createNotification } from './notificationController.js';

// Get all offline orders
export const getAllOfflineOrders = async (req, res) => {
  try {
    const orders = await OfflineOrder.find()
      .populate('createdBy', 'firstName lastName')
      .populate('items.productId', 'name price images')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching offline orders:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch offline orders'
    });
  }
};

// Create new offline order
export const createOfflineOrder = async (req, res) => {
  try {
    const {
      customerName,
      phone,
      items,
      payment,
      subtotal,
      tax,
      total,
      notes
    } = req.body;

    // Validate required fields
    if (!customerName || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Customer name and phone are required'
      });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order must contain at least one item'
      });
    }

    // Validate payment
    if (!payment || !payment.method) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required'
      });
    }

    // Validate admin
    if (!req.admin || !req.admin.id) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    // Process items and validate products
    const processedItems = await Promise.all(items.map(async (item) => {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Update product stock
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });

      return {
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        price: item.price,
        variant: item.variant || null
      };
    }));

    // Create the offline order
    const order = new OfflineOrder({
      customerName,
      phone,
      items: processedItems,
      payment: {
        method: payment.method,
        status: 'completed',
        amount: total
      },
      subtotal,
      tax,
      total,
      notes,
      createdBy: req.admin._id
    });

    await order.save();

    // Create notification
    await createNotification(
      'order',
      `New offline sale created: ${order.orderNumber}`,
      {
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.total
      }
    );

    return res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error creating offline order:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create offline order'
    });
  }
};

// Get offline order by ID
export const getOfflineOrderById = async (req, res) => {
  try {
    const order = await OfflineOrder.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('items.productId', 'name price images');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Offline order not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching offline order:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch offline order'
    });
  }
};

// Update offline order status
export const updateOfflineOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await OfflineOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Offline order not found'
      });
    }

    order.status = status;
    order.payment.status = status;
    await order.save();

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error updating offline order status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update offline order status'
    });
  }
};

// Delete offline order
export const deleteOfflineOrder = async (req, res) => {
  try {
    const order = await OfflineOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Offline order not found'
      });
    }

    // Restore product stock
    await Promise.all(order.items.map(async (item) => {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }));

    await order.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Offline order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting offline order:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete offline order'
    });
  }
}; 