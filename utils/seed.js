// utils/seed.js - Script to create initial superadmin user

import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../admin/models/Admin.js";

dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Check if any admin exists
    const adminCount = await Admin.countDocuments();

    if (adminCount === 0) {
      // Create superadmin
      const superAdmin = new Admin({
        username: "superadmin",
        email: "ecommercesite02@outlook.com",
        password: "Admin123!", // Will be hashed before saving
        role: "superadmin",
        isActive: true,
      });

      await superAdmin.save();
      console.log("Superadmin created successfully");
      console.log(`Email: ${superAdmin.email}`);
      console.log(`Password: ${superAdmin.password}`);
      console.log(
        "IMPORTANT: Change this password immediately after first login!"
      );
    } else {
      console.log("Admins already exist in the database. Seed skipped.");
    }

    // Disconnect from the database
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seed function
createSuperAdmin();
