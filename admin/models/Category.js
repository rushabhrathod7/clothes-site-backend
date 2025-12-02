// models/Category.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
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

// Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "Subcategory",
  localField: "_id",
  foreignField: "category",
});

// Pre-remove hook to handle cascade delete
categorySchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  // Remove all subcategories associated with this category
  await this.model('Subcategory').deleteMany({ category: this._id });
  next();
});

const Category = mongoose.model("Category", categorySchema);

export default Category;
