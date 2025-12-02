// models/Product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
      validate: {
        validator: function(v) {
          return typeof v === 'number' && !isNaN(v);
        },
        message: props => `${props.value} is not a valid price`
      },
      get: v => Number(v),
      set: v => Number(v),
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: [true, "Subcategory is required"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    newlyArrived: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    sku: {
      type: String,
      unique: true,
      required: [true, "SKU is required"],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

// Pre-save hook to ensure price is a number
productSchema.pre('save', function(next) {
  if (this.isModified('price')) {
    this.price = Number(this.price);
    if (isNaN(this.price)) {
      next(new Error('Price must be a valid number'));
    }
  }
  next();
});

// Add indexes for better query performance
productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isAvailable: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ newlyArrived: 1 });
productSchema.index({ rating: -1 });

// Virtual for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'productId',
  justOne: false,
  match: { isApproved: true }
});

// Update product rating when a review is saved or removed
productSchema.statics.updateRating = async function(productId) {
  const result = await this.model('Review').aggregate([
    {
      $match: { product: productId }
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        numReviews: { $sum: 1 }
      }
    }
  ]);

  if (result.length > 0) {
    await this.findByIdAndUpdate(productId, {
      rating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal place
      numReviews: result[0].numReviews
    });
  } else {
    await this.findByIdAndUpdate(productId, {
      rating: 0,
      numReviews: 0
    });
  }
};

const Product = mongoose.model("Product", productSchema);

export default Product;