import mongoose from 'mongoose';

const OfflineOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    variant: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  }],
  payment: {
    method: {
      type: String,
      enum: ['cash', 'card', 'upi'],
      required: true
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'cancelled'],
      default: 'completed'
    },
    amount: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled'],
    default: 'completed'
  },
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
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
OfflineOrderSchema.index({ orderNumber: 1 }, { unique: true });
OfflineOrderSchema.index({ customerName: 1 });
OfflineOrderSchema.index({ phone: 1 });
OfflineOrderSchema.index({ createdAt: -1 });
OfflineOrderSchema.index({ status: 1 });

// Pre-save middleware to generate order number
OfflineOrderSchema.pre('validate', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `POS-${year}${month}${day}-${random}`;
  }
  next();
});

export default mongoose.model('OfflineOrder', OfflineOrderSchema); 