import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../../admin/models/Product.js';
import { clerkClient } from '@clerk/clerk-sdk-node';

/**
 * Get all users with optional filtering
 */
export const getAllUsers = async (req, res) => {
  try {
    const { sortBy, order, limit, page, search } = req.query;
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    // Pagination
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page) || 1;
    const skip = (pageNumber - 1) * pageSize;

    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .select('-__v');

    const total = await User.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: total,
      page: pageNumber,
      pages: Math.ceil(total / pageSize),
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user by clerkId
 */
export const getUserByClerkId = async (req, res) => {
  try {
    const { clerkId } = req.params;
    
    const user = await User.findOne({ clerkId }).select('-__v');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user by clerkId:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user by ID with detailed information
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-__v')
      .populate({
        path: 'orders.orderId',
        select: 'orderNumber items totalAmount status createdAt'
      })
      .populate({
        path: 'reviews.productId',
        select: 'name slug images'
      })
      .populate({
        path: 'wishlist',
        select: 'name slug price images'
      })
      .populate({
        path: 'cart.productId',
        select: 'name slug price images stock'
      });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Update user metadata (custom fields)
 */
export const updateUserMetadata = async (req, res) => {
  try {
    const { clerkId } = req.params;
    const { metadata } = req.body;
    
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid metadata' });
    }
    
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update metadata (merge with existing)
    user.metadata = { ...user.metadata, ...metadata };
    user.updatedAt = new Date();
    
    await user.save();
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user metadata:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Delete user (admin only)
 */
export const deleteUser = async (req, res) => {
  try {
    const { clerkId } = req.params;
    
    const user = await User.findOneAndDelete({ clerkId });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Manual sync with Clerk (in case webhook failed)
 * This would typically be an admin-only endpoint
 */
export const syncUserFromClerk = async (req, res) => {
  try {
    const { clerkId } = req.params;
    
    // Fetch user data from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkId);
    
    if (!clerkUser) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found in Clerk' 
      });
    }
    
    // Update or create user
    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        username: clerkUser.username || '',
        profileImageUrl: clerkUser.profileImageUrl || '',
        emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
        metadata: clerkUser.publicMetadata || {},
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );
    
    console.log('Synced user from Clerk:', {
      clerkId,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      email: clerkUser.emailAddresses[0]?.emailAddress
    });
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error syncing user from Clerk:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Update user details
 */
export const updateUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated
    delete updates.clerkId;
    delete updates.email;
    delete updates.orders;
    delete updates.reviews;
    delete updates.statistics;
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user details:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Add or update user address
 */
export const updateUserAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.body;
    
    if (!address || !address.street || !address.city || !address.country) {
      return res.status(400).json({ success: false, error: 'Invalid address data' });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // If this is the first address or isDefault is true, set all others to false
    if (address.isDefault || user.addresses.length === 0) {
      user.addresses.forEach(addr => addr.isDefault = false);
      address.isDefault = true;
    }
    
    // If address._id exists, update existing address
    if (address._id) {
      const index = user.addresses.findIndex(a => a._id.toString() === address._id);
      if (index !== -1) {
        user.addresses[index] = { ...user.addresses[index], ...address };
      }
    } else {
      user.addresses.push(address);
    }
    
    await user.save();
    
    return res.status(200).json({ success: true, data: user.addresses });
  } catch (error) {
    console.error('Error updating user address:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user orders
 */
export const getUserOrders = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, sortBy, order, limit, page } = req.query;
    
    const query = { userId: id };
    if (status) {
      query.status = status;
    }
    
    const sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }
    
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page) || 1;
    const skip = (pageNumber - 1) * pageSize;
    
    const orders = await Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .populate('items.productId', 'name slug images');
    
    const total = await Order.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      count: total,
      page: pageNumber,
      pages: Math.ceil(total / pageSize),
      data: orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user reviews
 */
export const getUserReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { sortBy, order, limit, page } = req.query;
    
    const sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }
    
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page) || 1;
    const skip = (pageNumber - 1) * pageSize;
    
    const user = await User.findById(id)
      .select('reviews')
      .populate({
        path: 'reviews.productId',
        select: 'name slug images'
      });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const reviews = user.reviews
      .sort((a, b) => (order === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt))
      .slice(skip, skip + pageSize);
    
    return res.status(200).json({
      success: true,
      count: user.reviews.length,
      page: pageNumber,
      pages: Math.ceil(user.reviews.length / pageSize),
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await User.findOne({ email }).select('-__v');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Sync user with Clerk by MongoDB ID
 */
export const syncUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the user from our database
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found in database' 
      });
    }

    if (!user.clerkId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User does not have a Clerk ID' 
      });
    }
    
    // Fetch user data from Clerk
    const clerkUser = await clerkClient.users.getUser(user.clerkId);
    
    if (!clerkUser) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found in Clerk' 
      });
    }
    
    // Update user with Clerk data
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        email: clerkUser.emailAddresses[0]?.emailAddress || user.email,
        firstName: clerkUser.firstName || user.firstName,
        lastName: clerkUser.lastName || user.lastName,
        username: clerkUser.username || user.username,
        profileImageUrl: clerkUser.profileImageUrl || user.profileImageUrl,
        emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
        metadata: clerkUser.publicMetadata || user.metadata,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    console.log('Synced user from Clerk:', {
      id,
      clerkId: user.clerkId,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      email: clerkUser.emailAddresses[0]?.emailAddress
    });
    
    return res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error syncing user from Clerk:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Update user's name
 */
export const updateUserName = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName } = req.body;
    
    if (!firstName && !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one of firstName or lastName is required' 
      });
    }
    
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    console.log('Updated user name:', {
      id,
      firstName: user.firstName,
      lastName: user.lastName
    });
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user name:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};