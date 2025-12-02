import express from 'express';
import { verifyAdminToken } from '../../middleware/auth.js';
import Payment from '../../user/models/Payment.js';
import Order from '../../user/models/Order.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get all payments with filters
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const { search, startDate, endDate, status } = req.query;
    
    // Build query
    const query = {};
    
    // Search by orderId (ObjectId), orderNumber, or razorpayOrderId
    if (search) {
      const or = [];
      
      // Search by orderId if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(search)) {
        or.push({ orderId: new mongoose.Types.ObjectId(search) });
      }
      
      // Search by razorpayOrderId
      or.push({ razorpayOrderId: { $regex: search, $options: 'i' } });
      
      // Search by orderNumber using aggregation
      const orders = await Order.find({ orderNumber: { $regex: search, $options: 'i' } });
      if (orders.length > 0) {
        or.push({ orderId: { $in: orders.map(order => order._id) } });
      }
      
      query.$or = or;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Get payments with pagination and populate order details
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({
        path: 'orderId',
        select: 'orderNumber'
      });
    
    // Transform the response to include orderNumber
    const transformedPayments = payments.map(payment => ({
      ...payment.toObject(),
      orderNumber: payment.orderId?.orderNumber || 'N/A'
    }));
    
    res.status(200).json(transformedPayments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Error fetching payments' });
  }
});

// Export payments to CSV
router.get('/export', verifyAdminToken, async (req, res) => {
  try {
    const { search, startDate, endDate, status } = req.query;
    
    // Build query (same as above)
    const query = {};
    if (search) {
      const or = [];
      
      // Search by orderId if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(search)) {
        or.push({ orderId: new mongoose.Types.ObjectId(search) });
      }
      
      // Search by razorpayOrderId
      or.push({ razorpayOrderId: { $regex: search, $options: 'i' } });
      
      // Search by orderNumber using aggregation
      const orders = await Order.find({ orderNumber: { $regex: search, $options: 'i' } });
      if (orders.length > 0) {
        or.push({ orderId: { $in: orders.map(order => order._id) } });
      }
      
      query.$or = or;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Get payments with populated order details
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: 'orderId',
        select: 'orderNumber'
      });
    
    // Convert to CSV
    const headers = ['Order Number', 'Razorpay Order ID', 'Amount', 'Status', 'Payment Method', 'Date'];
    const rows = payments.map(payment => [
      payment.orderId?.orderNumber || 'N/A',
      payment.razorpayOrderId,
      payment.amount,
      payment.status,
      payment.paymentMethod,
      new Date(payment.createdAt).toISOString()
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv');
    
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting payments:', error);
    res.status(500).json({ message: 'Error exporting payments' });
  }
});

export default router; 