import User from '../../user/models/User.js';

/**
 * Process Clerk webhooks to sync user data with MongoDB
 */
export const processWebhook = async (req, res) => {
  try {
    console.log('Received webhook request:', {
      headers: req.headers,
      body: req.body
    });

    // Get the webhook payload
    const payload = req.body;
    const { type, data } = payload;
    
    console.log(`Processing webhook event: ${type}`, {
      eventId: req.headers['svix-id'],
      timestamp: req.headers['svix-timestamp']
    });
    
    // Process different webhook events
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      case 'session.created':
        await handleSessionCreated(data);
        break;
      default:
        console.log(`Unhandled webhook event: ${type}`);
    }

    console.log(`Successfully processed webhook event: ${type}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', {
      error: error.message,
      stack: error.stack,
      eventType: req.body?.type,
      eventId: req.headers['svix-id']
    });
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Handle user.created event
 */
async function handleUserCreated(data) {
  try {
    console.log('Received user.created webhook data:', JSON.stringify(data, null, 2));
    
    // Check if user already exists
    const existingUser = await User.findOne({ clerkId: data.id });
    if (existingUser) {
      console.log(`User with clerkId ${data.id} already exists`);
      return;
    }

    // Create new user in MongoDB
    const newUser = new User({
      clerkId: data.id,
      email: data.email_addresses[0]?.email_address || '',
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      username: data.username || '',
      profileImageUrl: data.profile_image_url || '',
      emailVerified: data.email_addresses[0]?.verification?.status === 'verified',
      metadata: data.public_metadata || {},
    });

    await newUser.save();
    console.log(`User created: ${data.id}`);
  } catch (error) {
    console.error('Error handling user.created webhook:', error);
    throw error;
  }
}

/**
 * Handle user.updated event
 */
async function handleUserUpdated(data) {
  try {
    console.log('Received user.updated webhook data:', JSON.stringify(data, null, 2));
    
    // Find and update the user
    const updatedUser = await User.findOneAndUpdate(
      { clerkId: data.id },
      {
        email: data.email_addresses[0]?.email_address || '',
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        username: data.username || '',
        profileImageUrl: data.profile_image_url || '',
        emailVerified: data.email_addresses[0]?.verification?.status === 'verified',
        metadata: data.public_metadata || {},
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    console.log(`User updated: ${data.id}`);
    return updatedUser;
  } catch (error) {
    console.error('Error handling user.updated webhook:', error);
    throw error;
  }
}

/**
 * Handle user.deleted event
 */
async function handleUserDeleted(data) {
  try {
    // Delete the user from MongoDB
    await User.findOneAndDelete({ clerkId: data.id });
    console.log(`User deleted: ${data.id}`);
  } catch (error) {
    console.error('Error handling user.deleted webhook:', error);
    throw error;
  }
}

/**
 * Handle session.created event to track last sign in
 */
async function handleSessionCreated(data) {
  try {
    if (!data.user_id) {
      console.log('No user_id in session.created webhook data');
      return;
    }
    
    console.log('Processing session.created webhook for user:', data.user_id);
    
    // Update last sign in date
    const updatedUser = await User.findOneAndUpdate(
      { clerkId: data.user_id },
      { 
        lastSignIn: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedUser) {
      console.log(`User not found for clerkId: ${data.user_id}`);
      return;
    }
    
    console.log(`Updated lastSignIn for user: ${data.user_id}`, {
      lastSignIn: updatedUser.lastSignIn,
      email: updatedUser.email
    });
  } catch (error) {
    console.error('Error handling session.created webhook:', error);
    throw error;
  }
}