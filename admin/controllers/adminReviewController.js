import Review from '../../user/models/Review.js';
import Product from '../models/Product.js';
import User from '../../user/models/User.js';
import cloudinary from '../../config/cloudinary.js';

/**
 * @desc    Get all reviews with pagination and filtering
 * @route   GET /api/admin/reviews
 * @access  Private/Admin
 */
export const getAllReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    if (req.query.productId) {
      filter.product = req.query.productId;
    }
    
    if (req.query.userId) {
      filter.user = req.query.userId;
    }
    
    if (req.query.rating) {
      filter.rating = parseInt(req.query.rating);
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Build search query if provided
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { comment: searchRegex }
      ];
    }
    
    // Determine sort order
    const sortOption = {};
    if (req.query.sort) {
      const sortField = req.query.sort.startsWith('-') 
        ? req.query.sort.substring(1) 
        : req.query.sort;
      
      const sortDirection = req.query.sort.startsWith('-') ? -1 : 1;
      sortOption[sortField] = sortDirection;
    } else {
      sortOption.createdAt = -1; // Default sort by newest first
    }
    
    // Get reviews with pagination
    const reviews = await Review.find(filter)
      .populate({
        path: 'user',
        select: 'firstName lastName email image clerkId',
        transform: (doc) => {
          if (!doc) return null;
          return {
            _id: doc._id,
            id: doc._id,
            clerkId: doc.clerkId,
            name: [doc.firstName, doc.lastName].filter(Boolean).join(' ') || 'Anonymous',
            email: doc.email,
            image: doc.image
          };
        }
      })
      .populate({
        path: 'product',
        select: 'name images price',
        transform: (doc) => {
          if (!doc) return null;
          return {
            _id: doc._id,
            id: doc._id,
            name: doc.name,
            image: doc.images && doc.images.length > 0 ? doc.images[0].url : null,
            price: doc.price
          };
        }
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const total = await Review.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      reviews,
      currentPage: page,
      totalPages,
      total
    });
  } catch (error) {
    console.error('Error getting all reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get a specific review by ID
 * @route   GET /api/admin/reviews/:id
 * @access  Private/Admin
 */
export const getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'firstName lastName email image clerkId',
        transform: (doc) => {
          if (!doc) return null;
          return {
            _id: doc._id,
            id: doc._id,
            clerkId: doc.clerkId,
            name: [doc.firstName, doc.lastName].filter(Boolean).join(' ') || 'Anonymous',
            email: doc.email,
            image: doc.image
          };
        }
      })
      .populate({
        path: 'product',
        select: 'name images price',
        transform: (doc) => {
          if (!doc) return null;
          return {
            _id: doc._id,
            id: doc._id,
            name: doc.name,
            image: doc.images && doc.images.length > 0 ? doc.images[0].url : null,
            price: doc.price
          };
        }
      });
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error getting review by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Update a review
 * @route   PUT /api/admin/reviews/:id
 * @access  Private/Admin
 */
export const updateReview = async (req, res) => {
  try {
    const { rating, title, comment, status } = req.body;
    
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Update review fields
    if (rating !== undefined) review.rating = Number(rating);
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (status !== undefined) review.status = status;
    
    // Save updated review
    const updatedReview = await review.save();
    
    // Update product rating
    await updateProductRating(review.product);
    
    res.status(200).json({
      success: true,
      data: updatedReview,
      message: 'Review updated successfully'
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a review
 * @route   DELETE /api/admin/reviews/:id
 * @access  Private/Admin
 */
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Delete images from Cloudinary if they exist
    if (review.images && review.images.length > 0) {
      try {
        const deletePromises = review.images
          .filter(img => img.publicId)
          .map(img => cloudinary.uploader.destroy(img.publicId));
        
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error deleting images from Cloudinary:', error);
        // Continue with deletion even if image deletion fails
      }
    }
    
    const productId = review.product;
    
    // Delete the review
    await review.remove();
    
    // Update product rating
    await updateProductRating(productId);
    
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all reviews for a specific product
 * @route   GET /api/admin/reviews/product/:productId
 * @access  Private/Admin
 */
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Get reviews for the product
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
            name: [doc.firstName, doc.lastName].filter(Boolean).join(' ') || 'Anonymous',
            email: doc.email,
            image: doc.image
          };
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const total = await Review.countDocuments({ product: productId });
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      reviews,
      currentPage: page,
      totalPages,
      total
    });
  } catch (error) {
    console.error('Error getting product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all reviews by a specific user
 * @route   GET /api/admin/reviews/user/:userId
 * @access  Private/Admin
 */
export const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get reviews by the user
    const reviews = await Review.find({ user: userId })
      .populate({
        path: 'product',
        select: 'name images price',
        transform: (doc) => {
          if (!doc) return null;
          return {
            _id: doc._id,
            id: doc._id,
            name: doc.name,
            image: doc.images && doc.images.length > 0 ? doc.images[0].url : null,
            price: doc.price
          };
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const total = await Review.countDocuments({ user: userId });
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      reviews,
      currentPage: page,
      totalPages,
      total
    });
  } catch (error) {
    console.error('Error getting user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Helper function to update product rating
 * @param {string} productId - ID of the product to update rating for
 */
const updateProductRating = async (productId) => {
  try {
    // Get all approved reviews for the product
    const reviews = await Review.find({ 
      product: productId,
      status: { $ne: 'rejected' } // Exclude rejected reviews
    });
    
    if (reviews.length === 0) {
      // No reviews, set rating to 0
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        numReviews: 0
      });
      return;
    }
    
    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    // Update product with new rating and review count
    await Product.findByIdAndUpdate(productId, {
      rating: averageRating,
      numReviews: reviews.length
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
    throw error;
  }
};
