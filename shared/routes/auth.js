// routes/auth.js - Authentication routes for admin users

import express from "express";
import jwt from "jsonwebtoken";
import Admin from "../../admin/models/Admin.js";
import { verifyAdminToken } from "../../middleware/auth.js";
import { sendPasswordResetEmail } from "../../utils/emailService.js";
import crypto from "crypto";

const router = express.Router();

// Register a new admin (protected - only existing admins can create new ones)
router.post("/register", verifyAdminToken, async (req, res) => {
  try {
    // Check if requester is superadmin for added security
    if (req.admin.role !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Only superadmins can create new admin accounts" });
    }

    const { username, email, password, role } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { username }],
    });
    if (existingAdmin) {
      return res
        .status(400)
        .json({ message: "User with that email or username already exists" });
    }

    // Create new admin
    const newAdmin = new Admin({
      username,
      email,
      password,
      role: role || "admin", // Default to 'admin' if no role provided
    });

    await newAdmin.save();

    res.status(201).json({ message: "Admin created successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if account is active
    if (!admin.isActive) {
      return res.status(403).json({
        message: "Account is disabled. Please contact system administrator",
      });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login time
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Set cookie with token
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Required for cross-site cookies
      maxAge: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
    });

    // Return user info (excluding password) and token
    const adminData = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
    };

    res.status(200).json({ 
      message: "Login successful", 
      admin: adminData,
      token: token // Include token in response
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Auth check route - simple endpoint to verify if a user is authenticated
router.get("/check", verifyAdminToken, async (req, res) => {
  try {
    // If verifyToken middleware passed, the user is authenticated
    // Return minimal info to confirm authentication
    res.status(200).json({ 
      authenticated: true,
      adminId: req.admin.id,
      role: req.admin.role
    });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ message: "Server error during auth check" });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.status(200).json({ message: "Logged out successfully" });
});

// Get current admin profile
router.get("/me", verifyAdminToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(admin);
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
});

// Change password
router.put("/change-password", verifyAdminToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Find admin
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Server error during password change" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(200).json({
        message:
          "If that email exists in our system, a password reset link has been sent",
      });
    }

    // ✅ Generate reset token on the instance
    const resetToken = admin.generatePasswordResetToken();

    // ✅ Save the changes to the database
    await admin.save();

    // ✅ Send password reset email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    await sendPasswordResetEmail(email, resetToken, frontendUrl);

    res.status(200).json({
      message:
        "If that email exists in our system, a password reset link has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res
      .status(500)
      .json({ message: "Server error during password reset request" });
  }
});

// Reset password route
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Hash the token to compare with stored token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find admin with valid token and non-expired token
    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Set new password and clear reset token fields
    admin.password = password;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;
    await admin.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
  // console.log("Received token:", resetToken);
  // console.log("Hashed received token:", resetPasswordToken);
  // console.log("Admin found with token:", Admin ? "Yes" : "No");
});

router.get("/verify", verifyAdminToken, verifyAdminToken);

export default router;
