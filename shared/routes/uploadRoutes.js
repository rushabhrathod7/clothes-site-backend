// routes/uploadRoutes.js
import express from "express";
import multer from "multer";
import cloudinary from "../../config/cloudinary.js";
import { verifyAdminToken } from "../../middleware/auth.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up multer for temporary file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// Filter to only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

// Initialize multer with our config
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Route to upload a single image
router.post('/', verifyAdminToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Get folder from request or use default
    const folder = req.body.folder || 'misc';

    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: folder,
      use_filename: true,
      unique_filename: true,
    });

    // Clean up the temporary file
    fs.unlinkSync(req.file.path);

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        public_id: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format
      }
    });
  } catch (error) {
    // If there's a file, clean it up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// Route to delete an image
router.delete('/', verifyAdminToken, async (req, res) => {
  try {
    const { public_id } = req.body;
    
    if (!public_id) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }
    
    console.log('Attempting to delete Cloudinary image:', public_id);
    
    try {
      // Delete from cloudinary
      const result = await cloudinary.uploader.destroy(public_id);
      console.log('Cloudinary delete result:', result);
      
      if (result.result === 'ok') {
        return res.status(200).json({
          success: true,
          message: 'Image deleted successfully'
        });
      } else if (result.result === 'not found') {
        return res.status(404).json({
          success: false,
          message: 'Image not found in Cloudinary'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to delete image',
          details: result
        });
      }
    } catch (cloudinaryError) {
      console.error('Cloudinary deletion error:', cloudinaryError);
      
      // Check if the error is due to an invalid public_id format
      if (cloudinaryError.message.includes('Invalid public_id')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image ID format',
          error: cloudinaryError.message
        });
      }
      
      throw cloudinaryError; // Re-throw for general error handling
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting image',
      error: error.message
    });
  }
});

export default router; 