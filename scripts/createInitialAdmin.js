import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../admin/models/Admin.js";

// Load environment variables
dotenv.config();

const createInitialAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      "mongodb+srv://rhushabh:rush7411@cluster0.pbrupta.mongodb.net/ecommerce?appName=ecommerceApp"
    );
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: "admin@example.com" });
    if (existingAdmin) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    // Create new admin
    const admin = new Admin({
      username: "admin",
      email: "admin@example.com",
      password: "admin123", // This will be hashed by the model
      role: "superadmin",
      isActive: true,
    });

    await admin.save();
    console.log("Initial admin user created successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error creating initial admin:", error);
    process.exit(1);
  }
};

createInitialAdmin();
