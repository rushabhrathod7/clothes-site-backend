// controllers/categoryController.js
import Category from "../models/Category.js";
import Subcategory from "../models/Subcategory.js";
import cloudinary from "../../shared/config/cloudinary.js";

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    console.log('Fetching categories with query:', req.query);
    const categories = await Category.find()
      .populate({
        path: 'subcategories',
        select: 'name'
      });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

// Get a single category
export const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "subcategories"
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

// Create a new category
export const createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

// Update a category
export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // If there's a new image and an old image exists, delete the old one
    if (req.body.image && category.image && category.image.public_id !== req.body.image.public_id) {
      try {
        await cloudinary.uploader.destroy(category.image.public_id);
      } catch (cloudinaryError) {
        console.error("Failed to delete old image from cloudinary:", cloudinaryError);
        // Continue with update even if cloudinary delete fails
      }
    }

    // If image is explicitly set to null, delete the existing image
    if (req.body.image === null && category.image && category.image.public_id) {
      try {
        await cloudinary.uploader.destroy(category.image.public_id);
      } catch (cloudinaryError) {
        console.error("Failed to delete image from cloudinary:", cloudinaryError);
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedCategory,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// Delete a category
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Delete the category image from cloudinary if it exists
    if (category.image && category.image.public_id) {
      try {
        await cloudinary.uploader.destroy(category.image.public_id);
      } catch (cloudinaryError) {
        console.error("Failed to delete image from cloudinary:", cloudinaryError);
        // Continue with deletion even if cloudinary delete fails
      }
    }

    // Instead of category.remove()
    await Category.deleteOne({ _id: category._id });

    // If you want to maintain the cascading delete, you'll need to do it manually
    await Subcategory.deleteMany({ category: category._id });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};
