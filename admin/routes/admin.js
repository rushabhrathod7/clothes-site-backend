// routes/admin.js - Admin-specific routes after authentication

import express from "express";
import Admin from "../models/Admin.js";

const router = express.Router();

// Get all admins (superadmin only)
router.get("/admins", async (req, res) => {
  try {
    // Check if requester is superadmin
    if (req.admin.role !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Access denied. Superadmin privileges required" });
    }

    const admins = await Admin.find().select("-password");
    res.status(200).json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ message: "Server error while fetching admins" });
  }
});

// Update admin status (activate/deactivate) - superadmin only
router.put("/admins/:id/status", async (req, res) => {
  try {
    // Check if requester is superadmin
    if (req.admin.role !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Access denied. Superadmin privileges required" });
    }

    const { isActive } = req.body;
    const adminId = req.params.id;

    // Make sure superadmin is not trying to deactivate themselves
    if (adminId === req.admin.id) {
      return res
        .status(400)
        .json({ message: "You cannot modify your own account status" });
    }

    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { isActive: isActive },
      { new: true }
    ).select("-password");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(admin);
  } catch (error) {
    console.error("Error updating admin status:", error);
    res
      .status(500)
      .json({ message: "Server error while updating admin status" });
  }
});

// Dashboard statistics
router.get("/dashboard", async (req, res) => {
  try {
    // This is a placeholder for dashboard data
    // Normally you would aggregate data from your system
    const stats = {
      totalAdmins: await Admin.countDocuments(),
      activeAdmins: await Admin.countDocuments({ isActive: true }),
      lastLogin: req.admin.lastLogin,
      // Other stats would go here depending on your application
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching dashboard data" });
  }
});

export default router;
