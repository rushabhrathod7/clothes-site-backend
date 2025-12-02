import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  profileImageUrl: {
    type: String,
    default: ''
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastSignIn: {
    type: Date,
    default: null
  },
  // User contact information
  phoneNumber: {
    type: String,
    default: ''
  },
  // User addresses
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'office', 'other'],
      default: 'home'
    },
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  // User preferences
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    newsletterSubscription: {
      type: Boolean,
      default: false
    }
  },
  // User statistics
  statistics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    lastOrderDate: {
      type: Date,
      default: null
    },
    // Payment statistics
    paymentMethods: [{
      type: {
        type: String,
        enum: ['card', 'netbanking', 'wallet', 'upi', 'emi']
      },
      lastUsed: Date,
      isDefault: {
        type: Boolean,
        default: false
      }
    }],
    totalRefunds: {
      type: Number,
      default: 0
    },
    totalRefundAmount: {
      type: Number,
      default: 0
    }
  },
  // Payment preferences
  paymentPreferences: {
    defaultPaymentMethod: {
      type: String,
      enum: ['card', 'netbanking', 'wallet', 'upi', 'emi'],
      default: 'card'
    },
    savePaymentMethods: {
      type: Boolean,
      default: true
    },
    autoSaveCards: {
      type: Boolean,
      default: false
    }
  },
  // Saved payment methods (for returning customers)
  savedPaymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'netbanking', 'wallet', 'upi', 'emi'],
      required: true
    },
    details: {
      card: {
        last4: String,
        network: String,
        issuer: String,
        expiryMonth: String,
        expiryYear: String
      },
      upi: {
        vpa: String
      },
      wallet: {
        name: String
      }
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // User reviews
  reviews: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // User orders
  orders: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    totalAmount: Number,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // User wishlist
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  // User cart
  cart: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: {
      type: Number,
      default: 1
    },
    addedAt: {
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
UserSchema.index({ 'orders.orderId': 1 });
UserSchema.index({ 'reviews.productId': 1 });

export default mongoose.model('User', UserSchema);