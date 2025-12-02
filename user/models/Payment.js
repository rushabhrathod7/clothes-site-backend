import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String,
    required: true,
    default: 'pending'
  },
  razorpaySignature: {
    type: String,
    required: true,
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['pending', 'card', 'netbanking', 'wallet', 'upi', 'emi'],
    required: true,
    default: 'pending'
  },
  paymentDetails: {
    card: {
      last4: String,
      network: String,
      issuer: String
    },
    bank: {
      name: String,
      ifsc: String
    },
    wallet: {
      name: String
    },
    upi: {
      vpa: String
    }
  },
  refunds: [{
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    },
    reason: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes for better query performance
PaymentSchema.index({ razorpayOrderId: 1 });
PaymentSchema.index({ razorpayPaymentId: 1 });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ status: 1 });

export default mongoose.model('Payment', PaymentSchema); 