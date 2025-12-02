// scripts/checkProducts.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function checkProducts() {
  try {
    console.log('Checking products collection...');
    
    // Count total products
    const count = await Product.countDocuments();
    console.log(`Total products in database: ${count}`);
    
    // Get all products
    const products = await Product.find()
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    console.log('\nProducts found:');
    console.log(JSON.stringify(products, null, 2));
    
    // Check if any products have missing required fields
    const invalidProducts = products.filter(product => {
      return !product.name || !product.price || !product.stock;
    });
    
    if (invalidProducts.length > 0) {
      console.log('\nProducts with missing required fields:');
      console.log(JSON.stringify(invalidProducts, null, 2));
    }
    
  } catch (error) {
    console.error('Error checking products:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the check
checkProducts(); 