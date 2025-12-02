import Review from '../models/Review.js';
import Product from '../../admin/models/Product.js';
import User from '../models/User.js';
import cloudinary from '../../config/cloudinary.js';

// @desc    Create a new review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req, res) => {
  try {
    const { productId, rating, title, comment, userId: clerkUserId } = req.body;
    
    // Get user ID from request user or form data
    let userId = req.user?._id;

    // If we have a Clerk user ID but no MongoDB user ID, look it up
    if (!userId && clerkUserId) {
      const user = await User.findOne({ clerkId: clerkUserId });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      userId = user._id;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!productId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and rating are required',
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({ user: userId, product: productId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product. You can edit your existing review instead.',
        existingReviewId: existingReview._id
      });
    }

    // Handle image uploads if any
    let images = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map(file => 
          new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: 'ecommerce/reviews' },
              (error, result) => {
                if (error) return reject(error);
                resolve({
                  url: result.secure_url,
                  publicId: result.public_id,
                });
              }
            );
            uploadStream.end(file.buffer);
          })
        );
        images = await Promise.all(uploadPromises);
      } catch (error) {
        console.error('Error uploading images:', error);
        return res.status(500).json({
          success: false,
          message: 'Error uploading images',
          error: error.message,
        });
      }
    }

    // Create review
    const review = new Review({
      user: userId,
      product: productId,
      rating: Number(rating),
      title: title || '',
      comment: comment || '',
      images,
    });

    const savedReview = await review.save();

    // Update product rating
    await updateProductRating(productId);

    res.status(201).json({
      success: true,
      data: savedReview,
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log('Fetching reviews for product:', productId);

    // Find all reviews for the product and populate user details
    const reviews = await Review.find({ product: productId })
      .populate({
        path: 'user',
        select: 'firstName lastName email image clerkId',
        transform: (doc) => {
          if (!doc) return null;
          return {
            _id: doc._id,
            id: doc._id,
            clerkId: doc.clerkId,
            firstName: doc.firstName,
            lastName: doc.lastName,
            email: doc.email,
            image: doc.image,
            name: [doc.firstName, doc.lastName].filter(Boolean).join(' ') || 'Anonymous'
          };
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count of reviews for pagination
    const total = await Review.countDocuments({ product: productId });
    const totalPages = Math.ceil(total / limit);

    // Transform the reviews to include user ID and image URL
    const transformedReviews = reviews.map(review => {
      const reviewObj = { ...review };
      
      // Ensure we have the user ID in the root of the review
      if (review.user) {
        reviewObj.userId = review.user._id || review.user.id;
        reviewObj.userId = reviewObj.userId.toString(); // Ensure it's a string for comparison
      }
      
      // Ensure we have the user's image URL
      if (review.user?.image) {
        reviewObj.user.imageUrl = review.user.image;
      }
      
      // Ensure images is an array
      if (!Array.isArray(reviewObj.images)) {
        reviewObj.images = [];
      }
      
      console.log('Transformed review:', {
        _id: reviewObj._id,
        userId: reviewObj.userId,
        user: reviewObj.user,
        hasUser: !!reviewObj.user,
        userKeys: reviewObj.user ? Object.keys(reviewObj.user) : []
      });
      
      return reviewObj;
    });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      totalPages,
      currentPage: page,
      reviews: transformedReviews,
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product reviews',
      error: error.message,
    });
  }
};

// @desc    Get current user's reviews
// @route   GET /api/reviews/user/me
// @access  Private
export const getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    const reviews = await Review.find({ user: userId })
      .populate('product', 'name images price')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Review.countDocuments({ user: userId });

    res.json({
      success: true,
      data: reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalReviews: count,
    });
  } catch (error) {
    console.error('Error getting user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, userId: clerkUserId } = req.body;
    
    // Get the authenticated user's ID from the request
    let userId = req.user?._id;
    
    // If we have a Clerk user ID but no MongoDB user ID, look it up
    if (!userId && clerkUserId) {
      const user = await User.findOne({ clerkId: clerkUserId });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      userId = user._id;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check if the review belongs to the user
    const reviewUserId = review.user.toString();
    const currentUserId = userId.toString();
    
    // Also check if the user matches via Clerk ID if available
    const user = await User.findById(reviewUserId);
    const isOwner = reviewUserId === currentUserId || 
                  (user?.clerkId && user.clerkId === currentUserId);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review',
      });
    }

    // Handle image uploads if any
    let newImages = [...review.images];
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map(file => 
          new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: 'ecommerce/reviews' },
              (error, result) => {
                if (error) return reject(error);
                resolve({
                  url: result.secure_url,
                  publicId: result.public_id,
                });
              }
            );
            uploadStream.end(file.buffer);
          })
        );
        newImages = await Promise.all(uploadPromises);
      } catch (error) {
        console.error('Error uploading images:', error);
        return res.status(500).json({
          success: false,
          message: 'Error uploading images',
          error: error.message,
        });
      }
    }

    // Delete old images from Cloudinary if they're being replaced
    if (newImages.length > 0 && review.images.length > 0) {
      try {
        const deletePromises = review.images.map(img => 
          cloudinary.uploader.destroy(img.publicId)
        );
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error deleting old images:', error);
        // Continue even if deletion fails
      }
    }

    // Update review
    review.rating = rating !== undefined ? Number(rating) : review.rating;
    review.title = title || review.title;
    review.comment = comment || review.comment;
    review.images = newImages;

    const updatedReview = await review.save();

    // Update product rating
    await updateProductRating(review.product);

    res.json({
      success: true,
      data: updatedReview,
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check if the review belongs to the user or if user is admin
    if (review.user.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review',
      });
    }

    // Delete images from Cloudinary
    if (review.images && review.images.length > 0) {
      try {
        const deletePromises = review.images.map(img => 
          cloudinary.uploader.destroy(img.publicId)
        );
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error deleting images from Cloudinary:', error);
        // Continue with deletion even if image deletion fails
      }
    }

    const productId = review.product;
    await Review.findByIdAndDelete(id);

    // Update product rating
    await updateProductRating(productId);

    res.json({
      success: true,
      data: {},
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Helper function to update product rating
const updateProductRating = async (productId) => {
  try {
    const result = await Review.aggregate([
      { $match: { product: productId } },
      {
        $group: {
          _id: '$product',
          rating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (result.length > 0) {
      const { rating, count } = result[0];
      await Product.findByIdAndUpdate(productId, {
        rating: parseFloat(rating.toFixed(1)),
        numReviews: count,
      });
    }
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};
