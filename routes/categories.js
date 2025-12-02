import express from "express";
import Category from "../models/Category.js";
import Subcategory from "../models/Subcategory.js";
import Product from "../models/Product.js";

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json({ data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// Get subcategories for a category
router.get('/:categoryId/subcategories', async (req, res) => {
  try {
    const subcategories = await Subcategory.find({ category: req.params.categoryId });
    res.json({ data: subcategories });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ message: 'Error fetching subcategories' });
  }
});

// Get products for a category
router.get('/:categoryId/products', async (req, res) => {
  try {
    const { page = 1, limit = 12, sort } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let sortObj = {};
    if (sort) {
      const [field, order] = sort.startsWith('-') ? [sort.slice(1), -1] : [sort, 1];
      sortObj[field] = order;
    }

    const products = await Product.find({ category: req.params.categoryId })
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments({ category: req.params.categoryId });

    res.json({
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ message: 'Error fetching category products' });
  }
});

// Get products for a subcategory
router.get('/:categoryId/subcategories/:subcategoryId/products', async (req, res) => {
  try {
    const { page = 1, limit = 12, sort } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let sortObj = {};
    if (sort) {
      const [field, order] = sort.startsWith('-') ? [sort.slice(1), -1] : [sort, 1];
      sortObj[field] = order;
    }

    const products = await Product.find({
      category: req.params.categoryId,
      subcategory: req.params.subcategoryId
    })
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments({
      category: req.params.categoryId,
      subcategory: req.params.subcategoryId
    });

    res.json({
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching subcategory products:', error);
    res.status(500).json({ message: 'Error fetching subcategory products' });
  }
});

export default router; 