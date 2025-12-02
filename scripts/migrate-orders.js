import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Order from '../user/models/Order.js';
import Product from '../admin/models/Product.js';

// Configure dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name');

async function migrateOrders() {
  try {
    console.log('Starting order migration...');
    
    // Get all orders to check their items
    const orders = await Order.find({}).lean();
    console.log(`Found ${orders.length} total orders`);
    
    let updatedCount = 0;
    let processedItems = 0;
    let itemsWithStringId = 0;
    let itemsWithNullId = 0;

    // Process each order
    for (const order of orders) {
      let orderUpdated = false;
      const orderUpdates = [];
      
      // Process each item in the order
      for (const [index, item] of order.items.entries()) {
        processedItems++;
        
        // Check if productId exists and is a string (not ObjectId)
        if (item.productId && typeof item.productId === 'string') {
          itemsWithStringId++;
          
          try {
            // Convert string ID to ObjectId
            const productId = new mongoose.Types.ObjectId(item.productId);
            
            // Check if the product exists
            const product = await Product.findById(productId);
            
            if (product) {
              console.log(`Updating order ${order._id} - item ${index}: ${item.name} (${item.productId})`);
              
              // Update the item with proper ObjectId
              orderUpdates.push({
                updateOne: {
                  filter: { _id: order._id, 'items._id': item._id },
                  update: { $set: { 'items.$.productId': productId } }
                }
              });
              
              orderUpdated = true;
            } else {
              console.log(`Product not found: ${item.productId} (${item.name})`);
            }
          } catch (error) {
            console.error(`Error processing product ID ${item.productId}:`, error.message);
          }
        } else if (!item.productId) {
          itemsWithNullId++;
          console.log(`Order ${order._id} has item without productId:`, item.name);
        }
      }
      
      // Bulk update the order if there are updates
      if (orderUpdates.length > 0) {
        try {
          await Order.bulkWrite(orderUpdates);
          updatedCount++;
          console.log(`Updated ${orderUpdates.length} items in order ${order._id}`);
        } catch (error) {
          console.error(`Error updating order ${order._id}:`, error.message);
        }
      }
    }

    console.log('\nMigration Summary:');
    console.log(`- Total orders processed: ${orders.length}`);
    console.log(`- Total items processed: ${processedItems}`);
    console.log(`- Items with string productId: ${itemsWithStringId}`);
    console.log(`- Items with null productId: ${itemsWithNullId}`);
    console.log(`- Orders updated: ${updatedCount}`);
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the migration
migrateOrders().catch(console.error);
