// models/Subcategory.js
import mongoose from "mongoose";

const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subcategory name is required"],
      trim: true,
      maxlength: [50, "Subcategory name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Add image field to store Cloudinary image data
    image: {
      public_id: String,
      url: String
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add compound index for unique subcategories within a category
subcategorySchema.index({ name: 1, category: 1 }, { unique: true });

// Virtual for products
subcategorySchema.virtual("products", {
  ref: "Product",
  localField: "_id",
  foreignField: "subcategory",
});

// Pre-remove hook to handle cascade delete
subcategorySchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    // Remove all products associated with this subcategory
    await this.model("Product").deleteMany({ subcategory: this._id });
    next();
  }
);

const Subcategory = mongoose.model("Subcategory", subcategorySchema);

export default Subcategory;
