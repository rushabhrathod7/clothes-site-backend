// controllers/productController.js
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Subcategory from "../models/Subcategory.js";
import cloudinary from "../../shared/config/cloudinary.js";
import mongoose from "mongoose";

// Get all products with filtering, sorting, and pagination
export const getAllProducts = async (req, res) => {
  try {
    console.log('Request headers:', req.headers);
    console.log('Query parameters:', req.query);

    // Start with empty filterOptions
    let filterOptions = {};

    // Handle category filter
    if (req.query.category) {
      filterOptions.category = req.query.category;
    }

    // Handle subcategory filter
    if (req.query.subcategory) {
      filterOptions.subcategory = req.query.subcategory;
    }

    // Handle price range filter
    if (req.query['price[gte]'] || req.query['price[lte]']) {
      const minPrice = Number(req.query['price[gte]']);
      const maxPrice = Number(req.query['price[lte]']);
      
      console.log('Price range received:', { minPrice, maxPrice });
      
      // Create price filter object
      const priceFilter = {};
      
      if (!isNaN(minPrice)) {
        priceFilter.$gte = minPrice;
      }
      
      if (!isNaN(maxPrice)) {
        priceFilter.$lte = maxPrice;
      }
      
      // Only add price filter if we have valid conditions
      if (Object.keys(priceFilter).length > 0) {
        filterOptions.price = priceFilter;
        console.log('Price filter applied:', priceFilter);
      }
    }

    // Handle status filter
    if (req.query.status === 'active') {
      filterOptions.isAvailable = true;
    }

    console.log('Final filter options:', JSON.stringify(filterOptions, null, 2));

    // Debug: Log all products in the database
    const allProducts = await Product.find({});
    console.log('All products in database:', allProducts.map(p => ({
      name: p.name,
      price: p.price,
      priceType: typeof p.price,
      isAvailable: p.isAvailable
    })));

    // Debug: Log the MongoDB query
    console.log('MongoDB query:', JSON.stringify(filterOptions, null, 2));

    // Get products with filters using a more explicit query
    const query = Product.find(filterOptions);
    const mongoQuery = query.getQuery();
    console.log('MongoDB query object:', mongoQuery);

    // Debug: Check if price filter is in the query
    if (mongoQuery.price) {
      console.log('Price filter in query:', mongoQuery.price);
    } else {
      console.log('No price filter in query');
    }

    // Execute the query
    const products = await query
      .sort(req.query.sort || { createdAt: -1 })
      .select('name description price images category subcategory isAvailable featured')
      .skip((parseInt(req.query.page) - 1) * parseInt(req.query.limit))
      .limit(parseInt(req.query.limit));

    // Debug: Log the filtered products
    console.log('Filtered products:', products.map(p => ({
      name: p.name,
      price: p.price,
      priceType: typeof p.price,
      isAvailable: p.isAvailable
    })));

    // Get total count for pagination
    const total = await Product.countDocuments(filterOptions);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parseInt(req.query.page),
        limit: parseInt(req.query.limit),
        totalPages: Math.ceil(total / parseInt(req.query.limit))
      }
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
};

// Get a single product
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("subcategory", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// Create a new product with image uploads
export const createProduct = async (req, res) => {
  try {
    // Get the product data from the request body
    const productData = { ...req.body };
    
    // Handle images directly from request body (new direct Cloudinary integration)
    // Images are now sent as part of the JSON data rather than files
    if (req.body.images) {
      // If images are sent as a string (happens when using FormData), parse them
      if (typeof req.body.images === 'string') {
        try {
          productData.images = JSON.parse(req.body.images);
        } catch (e) {
          productData.images = [];
        }
      }
    } else {
      productData.images = [];
    }

    // Create the product
    const product = await Product.create(productData);

    // Return the created product
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// Update a product
export const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Get the product data from the request body
    const productData = { ...req.body };
    
    // Find the product to update
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    
    // Handle images directly from request body (new direct Cloudinary integration)
    // Images are now sent as part of the JSON data rather than files
    if (req.body.images) {
      // If images are sent as a string (happens when using FormData), parse them
      if (typeof req.body.images === 'string') {
        try {
          productData.images = JSON.parse(req.body.images);
        } catch (e) {
          // Keep existing images if parsing fails
          productData.images = product.images;
        }
      }
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      productData,
      {
        new: true,
        runValidators: true,
      }
    );

    // Return the updated product
    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// Delete a product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete all product images from Cloudinary
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    // Delete the product
    await Product.deleteOne({ _id: product._id });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// Search products
export const searchProducts = async (req, res) => {
  try {
    if (!req.query.q) {
      return res.status(400).json({
        success: false,
        message: "Please provide a search query",
      });
    }

    const products = await Product.find({
      $text: { $search: req.query.q },
    })
      .populate("category", "name")
      .populate("subcategory", "name");

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search products",
      error: error.message,
    });
  }
};

// Upload product images
export const uploadProductImages = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "products",
        use_filename: true,
        unique_filename: true,
      });
      
      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);
    
    // Append new images to existing ones
    product.images = [...product.images, ...uploadedImages];
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to upload images",
      error: error.message,
    });
  }
};

// Delete product image
export const deleteProductImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const imageIndex = product.images.findIndex(img => img.public_id === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Delete image from Cloudinary
    await cloudinary.uploader.destroy(imageId);

    // Remove image from product
    product.images.splice(imageIndex, 1);
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
};