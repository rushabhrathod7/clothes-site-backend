import jwt from 'jsonwebtoken';
import { Clerk } from '@clerk/clerk-sdk-node';
import Admin from '../admin/models/Admin.js';
import User from '../user/models/User.js';
import crypto from 'crypto';
import { Webhook } from 'svix';

// Initialize Clerk
const clerk = new Clerk({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

// Middleware to verify admin JWT token
export const verifyAdminToken = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    let token = req.cookies.admin_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    console.log('Auth headers:', {
      cookie: req.cookies.admin_token ? 'Present' : 'Not present',
      authHeader: req.headers.authorization ? 'Present' : 'Not present',
      token: token ? 'Present' : 'Not present'
    });

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
        error: 'NO_TOKEN',
      });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);
      
      const admin = await Admin.findById(decoded.id);
      console.log('Found admin:', admin ? 'Yes' : 'No');
      
      if (!admin || !admin.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or inactive account',
          error: 'INVALID_ACCOUNT',
        });
      }

      req.admin = {
        _id: admin._id,
        id: admin._id,
        role: admin.role || 'admin',
        email: admin.email,
        isActive: admin.isActive
      };

      console.log('Admin info set in request:', req.admin);
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Token verification failed',
        error: 'TOKEN_VERIFICATION_FAILED',
      });
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: 'AUTH_FAILED',
    });
  }
};

// Middleware to verify Clerk-authenticated user
export const verifyClerkAuth = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
        error: 'NO_TOKEN',
      });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      // Verify the JWT token using Clerk's SDK
      const { sub: clerkId } = await clerk.verifyToken(token);
      
      if (!clerkId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: 'INVALID_TOKEN',
        });
      }

      // Find or create user
      let user = await User.findOne({ clerkId });

      if (!user) {
        // Get user data from Clerk
        const clerkUser = await clerk.users.getUser(clerkId);
        
        // Create new user in MongoDB
        user = new User({
          clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          username: clerkUser.username || '',
          profileImageUrl: clerkUser.profileImageUrl || '',
          emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
          metadata: clerkUser.publicMetadata || {},
        });

        await user.save();
      }

      // Attach user to request
      req.user = {
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Token verification failed',
        error: 'TOKEN_VERIFICATION_FAILED',
      });
    }
  } catch (error) {
    console.error('Clerk auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: 'AUTH_FAILED',
    });
  }
};

// Middleware to check if admin is superadmin
export const isSuperAdmin = (req, res, next) => {
  if (req.admin?.role === 'superadmin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. Superadmin privileges required',
    error: 'SUPERADMIN_REQUIRED',
  });
};

// Middleware to verify Clerk webhook
export const verifyClerkWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['svix-signature'];
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];

    if (!signature || !svixId || !svixTimestamp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing webhook headers' 
      });
    }

    // Create a new Svix instance with your webhook secret
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    
    try {
      // Verify the webhook payload
      const evt = wh.verify(JSON.stringify(req.body), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': signature,
      });
      
      // Add the verified event to the request
      req.webhookEvent = evt;
      next();
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid webhook signature' 
      });
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Webhook verification failed' 
    });
  }
};

// Middleware to authorize based on role
export const authorize = (...roles) => {
    return (req, res, next) => {
        console.log('Authorization check:', {
            admin: req.admin,
            requiredRoles: roles,
            currentRole: req.admin?.role
        });

        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
                error: 'NOT_AUTHENTICATED'
            });
        }

        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: `Not authorized. Required roles: ${roles.join(', ')}`,
                error: 'NOT_AUTHORIZED'
            });
        }

        next();
    };
};

export const isAdmin = (req, res, next) => {
  if (req.admin && (req.admin.role === 'admin' || req.admin.role === 'superadmin')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Admin privileges required',
    error: 'ADMIN_REQUIRED',
  });
};
