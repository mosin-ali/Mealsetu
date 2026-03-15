const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/emailUtils');

// Helper function to transform profilePic path to full URL
const transformProfilePic = (profilePic, protocol, host) => {
  if (!profilePic) return null;
  if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
    return profilePic;
  }
  // Fix double-slash bug: don't add extra / if profilePic already starts with /
  return `${protocol}://${host}${profilePic.startsWith('/') ? '' : '/'}${profilePic}`;
};


// @desc    Get user active subscription
// @route   GET /api/users/subscription
const getUserSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const subscription = await Subscription.findOne({ 
      userId: userId, 
      status: 'active' 
    }).populate('vendorId', 'kitchenName address');

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    const now = new Date();
    const expiryDate = new Date(subscription.expiryDate);
    const isExpired = expiryDate < now;

    res.json({
      subscription: subscription,
      isActive: !isExpired,
      isExpired: isExpired,
      daysRemaining: isExpired ? 0 : Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Error getting subscription', error: error.message });
  }
};

// @desc    Apply leave and extend subscription
// @route   POST /api/users/apply-leave
const applyLeave = async (req, res) => {
  try {
    const { leaveDate, leaveEndDate, mealType } = req.body;
    const userId = req.user._id;

    if (!leaveDate) {
      return res.status(400).json({ message: 'Leave date is required' });
    }

    const subscription = await Subscription.findOne({ 
      userId: userId, 
      status: 'active' 
    });

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    const now = new Date();
    const expiryDate = new Date(subscription.expiryDate);
    
    if (expiryDate < now) {
      return res.status(400).json({ message: 'Cannot apply leave - your subscription has expired. Please renew your subscription first.' });
    }

    const startDate = new Date(leaveDate);
    const endDate = leaveEndDate ? new Date(leaveEndDate) : startDate;
    const diffTime = Math.abs(endDate - startDate);
    const leaveDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const currentExpiry = new Date(subscription.expiryDate);
    currentExpiry.setDate(currentExpiry.getDate() + leaveDays);

    subscription.leaveDate = startDate;
    subscription.expiryDate = currentExpiry;
    await subscription.save();

    const user = await User.findById(userId);
    if (user) {
      user.expiryDate = currentExpiry;
      await user.save();

      const emailSubject = 'MealSetu - Subscription Extended Successfully';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Subscription Extended Successfully!</h1>
          <p>Dear ${user.name},</p>
          <p>Your leave request has been processed successfully.</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
            <p><strong>Leave Period:</strong> ${startDate.toLocaleDateString()} ${leaveEndDate ? 'to ' + endDate.toLocaleDateString() : ''}</p>
            <p><strong>Number of Days:</strong> ${leaveDays} day(s)</p>
            <p><strong>Meals to Skip:</strong> ${mealType === 'both' ? 'Lunch & Dinner' : mealType === 'lunch' ? 'Lunch Only' : 'Dinner Only'}</p>
            <p><strong>Previous Expiry:</strong> ${expiryDate.toLocaleDateString()}</p>
            <p><strong>New Expiry Date:</strong> ${currentExpiry.toLocaleDateString()}</p>
          </div>
          <p>Your subscription has been extended by ${leaveDays} day(s). Enjoy your break!</p>
          <hr/>
          <p style="color: #999; font-size: 12px;">Thank you for choosing MealSetu!</p>
        </div>
      `;

      try {
        await sendEmail(user.email, emailSubject, emailHtml);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    res.status(200).json({ 
      message: 'Subscription extended successfully',
      newExpiryDate: currentExpiry,
      leaveDays: leaveDays
    });

  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Error processing leave request', error: error.message });
  }
};

// @desc    Extend subscription (renew)
// @route   POST /api/users/extend-subscription
const extendSubscription = async (req, res) => {
  try {
    const { plan, vendorId, paymentMethod = 'Cash' } = req.body;
    const userId = req.user._id;

    if (!plan || !vendorId) {
      return res.status(400).json({ message: 'Plan and vendorId are required' });
    }

    // Determine payment status based on payment method
    const paymentStatus = paymentMethod === 'UPI' ? 'Paid' : 'Pending';

    let durationDays = 1;
    let planType = 'Trial';
    let amount = 80;

    switch (plan) {
      case 'WEEKLY':
        durationDays = 7;
        planType = 'Weekly';
        amount = 560;
        break;
      case 'MONTHLY':
        durationDays = 30;
        planType = 'Monthly';
        amount = 2000;
        break;
      case 'ONEDAY':
      default:
        durationDays = 1;
        planType = 'Trial';
        amount = 80;
        break;
    }

    // Calculate end date based on plan
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const user = await User.findById(userId);
    const vendor = await Vendor.findById(vendorId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    let subscriptionStartDate = new Date();
    let newExpiryDate;

    const existingSubscription = await Subscription.findOne({
      userId: userId,
      status: 'active'
    });

    if (existingSubscription) {
      const currentExpiry = new Date(existingSubscription.expiryDate);
      const now = new Date();
      
      if (currentExpiry < now) {
        subscriptionStartDate = now;
        newExpiryDate = new Date(now);
      } else {
        newExpiryDate = currentExpiry;
      }
      
      newExpiryDate.setDate(newExpiryDate.getDate() + durationDays);
      
      existingSubscription.planType = planType;
      existingSubscription.expiryDate = newExpiryDate;
      await existingSubscription.save();
    } else {
      newExpiryDate = new Date(subscriptionStartDate);
      newExpiryDate.setDate(newExpiryDate.getDate() + durationDays);

      await Subscription.create({
        userId: userId,
        vendorId,
        planType,
        startDate: subscriptionStartDate,
        expiryDate: newExpiryDate,
        status: 'active',
        customerName: user.name,
        contact: user.phone
      });
    }

    user.expiryDate = newExpiryDate;
    await user.save();

    const order = await Order.create({
      userId: userId,
      vendorId,
      amount: amount,
      deliverySlot: 'Lunch',
      mealPreference: 'Regular',
      paymentStatus: paymentStatus,
      paymentMethod: paymentMethod,
      planType: planType
    });

    try {
      const emailSubject = `MealSetu - ${planType} Subscription ${existingSubscription ? 'Extended' : 'Activated'}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">${existingSubscription ? 'Subscription Extended!' : 'Subscription Activated!'}</h1>
          <p>Dear ${user.name},</p>
          <p>Your subscription has been ${existingSubscription ? 'extended' : 'activated'}. Here are the details:</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
            <p><strong>Vendor:</strong> ${vendor.kitchenName}</p>
            <p><strong>Plan:</strong> ${planType}</p>
            <p><strong>Start Date:</strong> ${subscriptionStartDate.toLocaleDateString()}</p>
            <p><strong>Expiry Date:</strong> ${newExpiryDate.toLocaleDateString()}</p>
            <p><strong>Amount Paid:</strong> ₹${amount}</p>
          </div>
          <p>Enjoy your meals!</p>
          <hr/>
          <p style="color: #999; font-size: 12px;">Thank you for choosing MealSetu!</p>
        </div>
      `;
      await sendEmail(user.email, emailSubject, emailHtml);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    res.status(200).json({ 
      message: existingSubscription ? 'Subscription extended successfully' : 'Subscription activated successfully',
      subscription: {
        planType,
        startDate: subscriptionStartDate,
        expiryDate: newExpiryDate,
        status: 'active'
      },
      order,
      amount
    });

  } catch (error) {
    console.error('Extend subscription error:', error);
    res.status(500).json({ message: 'Error extending subscription', error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/users/me
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userObj = user.toObject();
    userObj.profilePic = transformProfilePic(user.profilePic, req.protocol, req.get('host'));
    
    res.json(userObj);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address, pincode, gender } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, address, pincode, gender },
      { new: true }
    ).select('-password');
    
    const userObj = user.toObject();
    userObj.profilePic = transformProfilePic(user.profilePic, req.protocol, req.get('host'));
    
    res.json(userObj);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user profile picture
// @route   PUT /api/users/:id/profile-pic
const updateUserProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Normalize path: convert Windows backslashes to forward slashes and ensure proper format
    const normalizePath = (filePath) => {
      if (!filePath) return null;
      // Replace backslashes with forward slashes (Windows path fix)
      let normalized = filePath.replace(/\\/g, '/');
      // Check if the result contains uploads/ anywhere
      if (normalized.includes('uploads/')) {
        // Extract everything from uploads/ onward and prepend a single /uploads/
        const parts = normalized.split('uploads/');
        normalized = '/uploads/' + parts[parts.length - 1];
      }
      return normalized;
    };

    const profilePicPath = normalizePath(req.file.path);
    const profilePicUrl = `${req.protocol}://${req.get('host')}${profilePicPath}`;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { profilePic: profilePicPath },
      { new: true }
    ).select('-password');

    res.json({
      ...user.toObject(),
      profilePic: profilePicUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Change password
// @route   POST /api/users/:id/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user orders
// @route   GET /api/users/orders
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).populate('vendorId', 'kitchenName address').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get All Menus for a specific date
// @route   GET /api/users/menus?date=2026-02-05
const getMenus = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);

    // Populate vendor with all relevant fields including kitchenPoster for image display
    const menus = await Menu.find({ date: { $gte: start, $lte: end }, isLive: true }).populate('vendorId', 'kitchenName address kitchenAddress menuPrice rating workingDays timings profileImage kitchenPoster fssaiNumber fssaiLicense trialEnabled trialFee');

    // Helper function to transform image paths to full URLs
    const transformImageUrl = (imagePath) => {
      if (!imagePath) return null;
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
      }
      // Use dynamic backend URL
      const backendUrl = `${req.protocol}://${req.get('host')}`;
      if (imagePath.startsWith('/uploads/')) {
        return `${backendUrl}${imagePath}`;
      }
      return `${backendUrl}/uploads/${imagePath.replace(/^\/?uploads\//, '')}`;
    };

    const mapped = menus.map(m => {
      const v = m.vendorId || {};
      return {
        _id: m._id,
        date: m.date,
        mainSabji: m.mainSabji,
        altSabji: m.altSabji,
        sweetItem: m.sweetItem,
        dietaryCategory: m.dietaryCategory,
        cycleType: m.cycleType,
        vendorId: v._id || null,
        kitchenName: v.kitchenName || 'Partner Kitchen',
        address: v.address || v.kitchenAddress || '',
        menuPrice: v.menuPrice || m.price || 80,
        rating: v.rating || 4.5,
        fssaiNumber: v.fssaiNumber || v.fssaiLicense || '',
        workingDays: v.workingDays || 'Mon - Sat',
        timings: v.timings || '11:00 AM - 09:00 PM',
        // Include vendor images for display - always include both profileImage and kitchenPoster
        profileImage: v.profileImage ? transformImageUrl(v.profileImage) : null,
        kitchenPoster: v.kitchenPoster ? transformImageUrl(v.kitchenPoster) : null,
        // Trial settings - explicitly check for true, default to false
        trialEnabled: v.trialEnabled === true,
        trialFee: v.trialFee || 0
      };
    });

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Place an Order or Create Subscription
// @route   POST /api/users/order
const placeOrder = async (req, res) => {
  // CONSOLE LOG: Debug Bug 2 - log every time this endpoint is hit
  console.log('=== PLACE ORDER API CALLED ===');
  console.log('userId:', req.user?._id);
  console.log('vendorId:', req.body?.vendorId);
  console.log('plan:', req.body?.plan);
  console.log('timestamp:', new Date().toISOString());
  console.log('================================');
  
  try {
    const { 
      vendorId, 
      items = [], 
      amount, 
      deliverySlot = 'Lunch', 
      mealPreference,
      plan = 'ONEDAY',
      startDate,
      altMainSubji = '',
      paymentMethod = 'Cash'
    } = req.body;

    if (!vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }
    if (amount == null) {
      return res.status(400).json({ message: 'amount is required' });
    }
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }
    const allowedPrefs = ['Regular', 'Jain'];
    const mealPref = allowedPrefs.includes(mealPreference) ? mealPreference : 'Regular';

    const user = await User.findById(req.user._id);
    const vendor = await Vendor.findById(vendorId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    let durationDays = 1;
    let planType = 'Trial';
    switch (plan) {
      case 'WEEKLY':
        durationDays = 7;
        planType = 'Weekly';
        break;
      case 'MONTHLY':
        durationDays = 30;
        planType = 'Monthly';
        break;
      case 'ONEDAY':
      default:
        durationDays = 1;
        planType = 'Trial';
        break;
    }

    // Check if user already has an active order in Order collection (NOT Subscription collection)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // BUG 2 FIX: Check Order collection for active order where status equals 'active'
    const activeOrder = await Order.findOne({
      userId: req.user._id,
      status: 'active',
      endDate: { $gte: now }
    });

    // CONSOLE LOG: Check if active order exists
    console.log('=== CHECKING FOR ACTIVE ORDER ===');
    console.log('activeOrder found:', activeOrder ? activeOrder._id : null);
    console.log('activeOrder endDate:', activeOrder?.endDate);
    console.log('===================================');

    let orderStatus;
    let subscriptionStartDate;
    let subscriptionExpiryDate;

    // BUG 2 FIX: Use exact logic as specified - check Order collection for active status
    if (activeOrder) {
      // User already has active order - create a pending order with sequential chaining
      orderStatus = 'pending';

      // Find existing pending orders to chain after (from Order collection)
      const existingPendingOrders = await Order.find({
        userId: req.user._id,
        $or: [
          { status: 'pending' },
          { offerStatus: 'pending' }
        ]
      }).sort({ scheduledEndDate: -1 });

      if (existingPendingOrders && existingPendingOrders.length > 0) {
        // Chain after the last pending order's scheduledEndDate + 1 day
        const mostRecentPendingOrder = existingPendingOrders[0];
        const lastScheduledEndDate = new Date(mostRecentPendingOrder.scheduledEndDate);
        subscriptionStartDate = new Date(lastScheduledEndDate.getTime() + 86400000); // Add 1 day
      } else {
        // Chain after active order's endDate + 1 day
        if (activeOrder.endDate) {
          const activeEndDate = new Date(activeOrder.endDate);
          subscriptionStartDate = new Date(activeEndDate.getTime() + 86400000); // Add 1 day
        } else {
          // Fallback to tomorrow
          subscriptionStartDate = new Date(now);
          subscriptionStartDate.setDate(subscriptionStartDate.getDate() + 1);
        }
      }

      // Calculate scheduledEndDate from scheduledStartDate based on planType
      subscriptionExpiryDate = new Date(subscriptionStartDate.getTime() + durationDays * 86400000);

      // CONSOLE LOG: Creating pending order with sequential dates
      console.log('=== CREATING PENDING ORDER ===');
      console.log('scheduledStartDate:', subscriptionStartDate);
      console.log('scheduledEndDate:', subscriptionExpiryDate);
      console.log('=================================');

      // Create the order with pending status
      const order = await Order.create({
        userId: req.user._id,
        vendorId,
        amount: numericAmount,
        deliverySlot,
        mealPreference: mealPref,
        paymentStatus: paymentMethod === 'Cash' ? 'Pending' : 'Paid',
        paymentMethod,
        planType: planType,
        status: 'pending',
        scheduledStartDate: subscriptionStartDate,
        scheduledEndDate: subscriptionExpiryDate,
        startDate: subscriptionStartDate,
        endDate: subscriptionExpiryDate
      });

      // CONSOLE LOG: After saving the new order - verify the saved values
      console.log('=== PLACE ORDER PENDING ORDER SAVED ===');
      console.log('orderId:', order._id);
      console.log('status:', order.status);
      console.log('scheduledStartDate:', order.scheduledStartDate);
      console.log('scheduledEndDate:', order.scheduledEndDate);
      console.log('=========================================');

      // Don't create a new subscription - the existing one continues
      // Only send confirmation email for the pending order
      try {
        const emailSubject = `MealSetu - ${planType} Subscription Queued!`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Order Queued!</h1>
            <p>Dear ${user.name},</p>
            <p>Your subscription has been queued. It will automatically activate after your current plan ends.</p>
            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
              <p><strong>Vendor:</strong> ${vendor.kitchenName}</p>
              <p><strong>Plan:</strong> ${planType}</p>
              <p><strong>Scheduled Start Date:</strong> ${subscriptionStartDate.toLocaleDateString()}</p>
              <p><strong>Scheduled End Date:</strong> ${subscriptionExpiryDate.toLocaleDateString()}</p>
              <p><strong>Amount Paid:</strong> ₹${numericAmount}</p>
              <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            </div>
            <p>Your current subscription is valid until ${activeOrder.endDate ? new Date(activeOrder.endDate).toLocaleDateString() : 'N/A'}.</p>
            <p>Enjoy your meals!</p>
            <hr/>
            <p style="color: #999; font-size: 12px;">Thank you for choosing MealSetu!</p>
          </div>
        `;
        await sendEmail(user.email, emailSubject, emailHtml);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }

      return res.status(201).json({ 
        order, 
        message: 'Order queued successfully. It will activate after your current plan ends.'
      });
    }

    // No active order - create order and subscription immediately (existing behavior)
    subscriptionStartDate = startDate ? new Date(startDate) : new Date();
    subscriptionExpiryDate = new Date(subscriptionStartDate);
    subscriptionExpiryDate.setDate(subscriptionExpiryDate.getDate() + durationDays);

    const order = await Order.create({
      userId: req.user._id,
      vendorId,
      amount: numericAmount,
      deliverySlot,
      mealPreference: mealPref,
      paymentStatus: paymentMethod === 'Cash' ? 'Pending' : 'Paid',
      paymentMethod,
      planType: planType,
      status: 'active',
      startDate: subscriptionStartDate,
      endDate: subscriptionExpiryDate
    });

    // CONSOLE LOG: After creating active order (no active plan existed)
    console.log('=== PLACE ORDER ACTIVE ORDER SAVED ===');
    console.log('orderId:', order._id);
    console.log('status:', order.status);
    console.log('startDate:', order.startDate);
    console.log('endDate:', order.endDate);
    console.log('======================================');

    const subscription = await Subscription.create({
      userId: req.user._id,
      vendorId,
      planType,
      startDate: subscriptionStartDate,
      expiryDate: subscriptionExpiryDate,
      status: 'active',
      customerName: user.name,
      contact: user.phone,
      dietaryPref: altMainSubji || mealPref
    });

    user.expiryDate = subscriptionExpiryDate;
    await user.save();

    try {
      const emailSubject = `MealSetu - ${planType} Subscription Confirmed`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Order Confirmed!</h1>
          <p>Dear ${user.name},</p>
          <p>Your subscription has been confirmed. Here are the details:</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
            <p><strong>Vendor:</strong> ${vendor.kitchenName}</p>
            <p><strong>Plan:</strong> ${planType}</p>
            <p><strong>Start Date:</strong> ${subscriptionStartDate.toLocaleDateString()}</p>
            <p><strong>Expiry Date:</strong> ${subscriptionExpiryDate.toLocaleDateString()}</p>
            <p><strong>Amount Paid:</strong> ₹${numericAmount}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          </div>
          <p>Enjoy your meals!</p>
          <hr/>
          <p style="color: #999; font-size: 12px;">Thank you for choosing MealSetu!</p>
        </div>
      `;
      await sendEmail(user.email, emailSubject, emailHtml);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    res.status(201).json({ 
      order, 
      subscription,
      message: 'Order placed and subscription created successfully'
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ message: 'Error placing order', error: error.message });
  }
};

// @desc    Add Review
// @route   POST /api/users/review
const addReview = async (req, res) => {
  try {
    const { vendorId, rating, comment, orderId } = req.body;

    // Get user info for caching
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has at least one order from this vendor (any status - not just delivered)
    const hasOrderedFromVendor = await Order.findOne({
      userId: req.user._id,
      vendorId: vendorId
    });

    if (!hasOrderedFromVendor) {
      return res.status(403).json({ 
        message: 'You must have placed an order from this vendor to leave a review' 
      });
    }

    // Create review with cached customer name
    const review = await Review.create({
      userId: req.user._id,
      vendorId,
      orderId: hasOrderedFromVendor._id, // Link to the order
      rating,
      comment,
      customerName: user.name || 'Anonymous' // Cache customer name
    });

    // Optionally: Update vendor's average rating in background
    // This will be calculated dynamically when fetching

    res.status(201).json(review);
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Error adding review' });
  }
};

// @desc    Get Vendor Reviews (Public - for users to view)
// @route   GET /api/users/vendor-reviews/:vendorId
const getVendorReviews = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Fetch reviews with user info populated, sorted by sentiment (5-star first, then 4-star, etc.)
    const reviews = await Review.find({ vendorId })
      .populate('userId', 'name')
      .sort({ rating: -1, createdAt: -1 }); // Sort by rating (desc), then by date (desc)

    // Format reviews for display
    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      user: review.customerName || review.userId?.name || 'Anonymous',
      rating: review.rating,
      stars: review.rating,
      comment: review.comment,
      date: new Date(review.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      createdAt: review.createdAt
    }));

    res.json(formattedReviews);
  } catch (error) {
    console.error('Get vendor reviews error:', error);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

// @desc    Get Vendor Rating (Public - dynamic average)
// @route   GET /api/users/vendor-rating/:vendorId
const getVendorRating = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Calculate average rating from reviews
    const ratingAgg = await Review.aggregate([
      { $match: { vendorId: require('mongoose').Types.ObjectId.createFromHexString(vendorId) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    const avgRating = ratingAgg.length > 0 ? Math.round(ratingAgg[0].avgRating * 10) / 10 : 0;
    const reviewCount = ratingAgg.length > 0 ? ratingAgg[0].count : 0;

    res.json({
      vendorId,
      rating: avgRating,
      reviewCount,
      hasReviews: reviewCount > 0
    });
  } catch (error) {
    console.error('Get vendor rating error:', error);
    res.status(500).json({ message: 'Error fetching vendor rating' });
  }
};

// @desc    Get Vendor Status (Open/Close) - Public endpoint
// @route   GET /api/users/vendor-status/:vendorId
const getVendorStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findById(vendorId);
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({
      vendorId: vendor._id,
      kitchenName: vendor.kitchenName,
      isOpen: vendor.isOpen,
      closureStartDate: vendor.closureStartDate,
      closureEndDate: vendor.closureEndDate
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get All Approved Vendors for User Side - Public endpoint
// @route   GET /api/users/vendors
const getApprovedVendors = async (req, res) => {
  try {
    // Fetch only approved and open vendors
    const vendors = await Vendor.find({ 
      isApproved: true
      // isOpen: true
    }).select('kitchenName address pincode menuPrice rating workingDays timings profileImage kitchenPoster weeklyPlan trialEnabled trialFee');

    // Transform vendor data for frontend display
    const transformedVendors = vendors.map(vendor => ({
      _id: vendor._id,
      vendorId: vendor._id,
      name: vendor.kitchenName,
      address: vendor.address,
      pincode: vendor.pincode,
      price: vendor.menuPrice || 80,
      rating: vendor.rating || 4.5,
      type: 'Regular',
      fssai: vendor.fssaiNumber || '',
      workingDays: vendor.workingDays || 'Mon - Sat',
      timings: vendor.timings || '11:00 AM - 09:00 PM',
      profileImage: vendor.profileImage ? transformProfilePic(vendor.profileImage, req.protocol, req.get('host')) : null,
      kitchenPoster: vendor.kitchenPoster ? transformProfilePic(vendor.kitchenPoster, req.protocol, req.get('host')) : null,
      weeklyPlan: vendor.weeklyPlan,
      // Trial settings - explicitly check for true, default to false
      trialEnabled: vendor.trialEnabled === true,
      trialFee: vendor.trialFee || 0
    }));

    res.json(transformedVendors);
  } catch (error) {
    console.error('Error fetching approved vendors:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Check if user can review a vendor
// @route   GET /api/users/review-eligibility/:vendorId
const checkReviewEligibility = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user._id;

    // Check if user has any order from this vendor (regardless of status)
    const anyOrder = await Order.findOne({
      userId: userId,
      vendorId: vendorId
    }).sort({ createdAt: -1 });

    // If user has any order, they can review
    if (anyOrder) {
      return res.json({
        canReview: true,
        hasOrdered: true,
        orderId: anyOrder._id,
        orderStatus: anyOrder.orderStatus,
        message: 'You can review this vendor!'
      });
    }

    // No order found
    return res.json({
      canReview: false,
      hasOrdered: false,
      orderId: null,
      orderStatus: null,
      message: 'You must have placed an order from this vendor to leave a review'
    });
  } catch (error) {
    console.error('Check review eligibility error:', error);
    res.status(500).json({ message: 'Error checking review eligibility' });
  }
};

// @desc    Get trial eligibility for a vendor
// @route   GET /api/users/trial-eligibility/:vendorId
const getTrialEligibility = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user._id;

    // Get user to check trial history
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get vendor to check trial settings
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Check if vendor has trials enabled
    if (!vendor.trialEnabled) {
      return res.json({
        eligible: false,
        reason: 'trial_not_available',
        message: 'This vendor does not offer trials'
      });
    }

    // Check if user has already used trial for this vendor
    const hasUsedTrial = user.trialHistory && user.trialHistory.some(
      trial => trial.vendorId && trial.vendorId.toString() === vendorId
    );

    if (hasUsedTrial) {
      return res.json({
        eligible: false,
        reason: 'trial_already_used',
        message: 'You have already used a trial for this vendor',
        trialFee: vendor.trialFee || 0
      });
    }

    // User is eligible for trial
    return res.json({
      eligible: true,
      trialFee: vendor.trialFee || 0,
      message: vendor.trialFee > 0 
        ? `Trial available for ₹${vendor.trialFee}` 
        : 'Free trial available'
    });
  } catch (error) {
    console.error('Get trial eligibility error:', error);
    res.status(500).json({ message: 'Error checking trial eligibility' });
  }
};

// @desc    Get active subscription status (for checking if user has active plan)
// @route   GET /api/users/subscription-status
const getActiveSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check for active subscription in Subscription collection
    const activeSubscription = await Subscription.findOne({ 
      userId: userId, 
      status: 'active',
      expiryDate: { $gt: today }
    }).populate('vendorId', 'kitchenName');

    if (activeSubscription) {
      return res.json({
        hasActivePlan: true,
        planType: activeSubscription.planType,
        startDate: activeSubscription.startDate,
        endDate: activeSubscription.expiryDate,
        vendorName: activeSubscription.vendorId?.kitchenName || 'Unknown Vendor'
      });
    }

    // Also check Order collection for any active orders with future endDate
    const activeOrder = await Order.findOne({
      userId: userId,
      endDate: { $gt: today }
    }).sort({ createdAt: -1 }).populate('vendorId', 'kitchenName');

    if (activeOrder) {
      return res.json({
        hasActivePlan: true,
        planType: activeOrder.planType,
        startDate: activeOrder.startDate,
        endDate: activeOrder.endDate,
        vendorName: activeOrder.vendorId?.kitchenName || 'Unknown Vendor'
      });
    }

    // No active plan found
    return res.json({
      hasActivePlan: false,
      planType: null,
      startDate: null,
      endDate: null,
      vendorName: null
    });
  } catch (error) {
    console.error('Get active subscription status error:', error);
    res.status(500).json({ message: 'Error checking subscription status', error: error.message });
  }
};

// @desc    Create a trial order
// @route   POST /api/users/trial
const createTrialOrder = async (req, res) => {
  try {
    const { vendorId, paymentMethod = 'Cash', mealPreference = 'Regular' } = req.body;
    
    console.log('Trial order request received:', { vendorId, paymentMethod, mealPreference, userId: req.user?._id });

    if (!vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }

    // Get user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Check if vendor has trials enabled
    if (!vendor.trialEnabled) {
      return res.status(400).json({ message: 'This vendor does not offer trials' });
    }

    // Check if user has already used trial for this vendor
    const hasUsedTrial = user.trialHistory && user.trialHistory.some(
      trial => trial.vendorId && trial.vendorId.toString() === vendorId
    );

    if (hasUsedTrial) {
      return res.status(403).json({ message: 'You have already used a trial for this vendor' });
    }

    // Calculate trial dates (2 days from now)
    const startDate = new Date();
    const endDate = new Date(Date.now() + 172800000); // 2 days in milliseconds

    const trialFee = vendor.trialFee || 0;

    // If trialFee > 0, require payment
    let paymentStatus = 'Pending';
    if (trialFee > 0) {
      paymentStatus = paymentMethod === 'UPI' ? 'Paid' : 'Pending';
    }

    console.log('Creating trial order with data:', {
      userId: req.user._id,
      vendorId,
      customerName: user.name,
      mealPreference,
      deliverySlot: 'Lunch',
      planType: 'Trial',
      amount: trialFee,
      paymentStatus,
      paymentMethod: trialFee > 0 ? paymentMethod : 'Free',
      startDate,
      endDate,
      orderStatus: 'Preparing'
    });

    // Create trial order with all required fields
    let order;
    try {
      order = await Order.create({
        userId: req.user._id,
        vendorId,
        customerName: user.name,
        mealPreference,
        deliverySlot: 'Lunch',
        planType: 'Trial',
        amount: trialFee,
        paymentStatus,
        paymentMethod: trialFee > 0 ? paymentMethod : 'Free',
        startDate,
        endDate,
        orderStatus: 'Preparing'
      });
      console.log('Trial order created successfully:', order._id);
    } catch (orderError) {
      console.error('Error creating trial order:', orderError.message);
      console.error('Error stack:', orderError.stack);
      return res.status(500).json({ message: 'Error creating trial order: ' + orderError.message, error: orderError.message });
    }

    // Create subscription for trial
    let subscription;
    try {
      subscription = await Subscription.create({
        userId: req.user._id,
        vendorId,
        planType: 'Trial',
        startDate,
        expiryDate: endDate,
        status: 'active',
        customerName: user.name,
        contact: user.phone,
        dietaryPref: mealPreference
      });
    } catch (subError) {
      console.error('Error creating trial subscription:', subError.message);
      console.error('Error stack:', subError.stack);
      // Order was created, but subscription failed - continue anyway
    }

    // Update user's trial history
    if (!user.trialHistory) {
      user.trialHistory = [];
    }
    user.trialHistory.push({
      vendorId,
      trialTakenAt: new Date()
    });
    await user.save();

    // Send trial confirmation email
    try {
      const emailSubject = 'MealSetu - Your 2-Day Free Trial is Activated!';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #16a34a;">🎉 Trial Activated!</h1>
          <p>Dear ${user.name},</p>
          <p>Your 2-day free trial from <strong>${vendor.kitchenName}</strong> has been activated!</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 10px;">
            <p><strong>🏠 Kitchen:</strong> ${vendor.kitchenName}</p>
            <p><strong>📅 Trial Start Date:</strong> ${startDate.toLocaleDateString('en-IN')}</p>
            <p><strong>📅 Trial End Date:</strong> ${endDate.toLocaleDateString('en-IN')}</p>
            <p><strong>💰 Trial Fee:</strong> ${trialFee > 0 ? `₹${trialFee}` : 'FREE'}</p>
            <p><strong>🍽️ Meal Preference:</strong> ${mealPreference}</p>
          </div>
          <p style="color: #dc2626; font-weight: bold;">⏰ Don't forget to subscribe to a paid plan before your trial ends!</p>
          <p>Visit your dashboard to explore weekly and monthly subscription plans.</p>
          <hr/>
          <p style="color: #999; font-size: 12px;">Thank you for choosing MealSetu!</p>
        </div>
      `;
      await sendEmail(user.email, emailSubject, emailHtml);
    } catch (emailError) {
      console.error('Failed to send trial confirmation email:', emailError);
    }

    res.status(201).json({
      message: 'Trial order created successfully',
      order,
      subscription,
      trialDetails: {
        vendorName: vendor.kitchenName,
        startDate,
        endDate,
        trialFee,
        isFree: trialFee === 0
      }
    });
  } catch (error) {
    console.error('Create trial order error:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Error creating trial order', error: error.message });
  }
};

// @desc    Get current user's active subscription order
// @route   GET /api/orders/my-subscription
const getMySubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find the most recent active order (where endDate > now OR status is active)
    const activeOrder = await Order.findOne({
      userId: userId,
      $or: [
        { endDate: { $gt: now } },
        { status: 'active' }
      ],
      status: { $ne: 'cancelled' }
    })
    .populate('vendorId', 'kitchenName')
    .sort({ createdAt: -1 });

    if (!activeOrder) {
      return res.json(null);
    }

    // Determine if the order is currently active based on endDate
    const isActive = activeOrder.endDate && new Date(activeOrder.endDate) > now;

    res.json({
      planType: activeOrder.planType,
      startDate: activeOrder.startDate,
      endDate: activeOrder.endDate,
      status: isActive ? 'active' : 'expired',
      vendorId: activeOrder.vendorId?._id,
      vendorName: activeOrder.vendorId?.kitchenName || 'Partner Kitchen',
      amount: activeOrder.amount,
      paymentMethod: activeOrder.paymentMethod,
      orderId: activeOrder._id
    });
  } catch (error) {
    console.error('Get my subscription error:', error);
    res.status(500).json({ message: 'Error getting subscription', error: error.message });
  }
};

// @desc    Get upcoming (pending) orders for current user
// @route   GET /api/orders/upcoming
const getUpcomingOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all orders with status 'pending' or scheduledStartDate in the future
    const upcomingOrders = await Order.find({
      userId: userId,
      $or: [
        { status: 'pending' },
        { offerStatus: 'pending' }
      ]
    })
    .populate('vendorId', 'kitchenName')
    .sort({ scheduledStartDate: 1 });

    const formattedOrders = upcomingOrders.map(order => ({
      _id: order._id,
      planType: order.planType,
      vendorId: order.vendorId?._id,
      vendorName: order.vendorId?.kitchenName || 'Partner Kitchen',
      scheduledStartDate: order.scheduledStartDate || order.scheduledActivationDate,
      scheduledEndDate: order.scheduledEndDate || order.endDate,
      amount: order.amount,
      status: order.status || order.offerStatus,
      isOfferOrder: order.isOfferOrder
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('Get upcoming orders error:', error);
    res.status(500).json({ message: 'Error getting upcoming orders', error: error.message });
  }
};

// @desc    Extend subscription (create pending order)
// @route   POST /api/orders/extend
const extendSubscriptionOrder = async (req, res) => {
  // CONSOLE LOG: Debug duplicate issue - log every time this endpoint is hit
  console.log('=== EXTEND SUBSCRIPTION API CALLED ===');
  console.log('userId:', req.user?._id);
  console.log('vendorId:', req.body?.vendorId);
  console.log('planType:', req.body?.plan);
  console.log('timestamp:', new Date().toISOString());
  console.log('=====================================');
  
  try {
    const { plan, vendorId, paymentMethod = 'Cash' } = req.body;
    const userId = req.user._id;

    if (!plan || !vendorId) {
      return res.status(400).json({ message: 'Plan and vendorId are required' });
    }

    // Determine duration and amount based on plan
    let durationDays = 7;
    let planType = 'Weekly';
    let amount = 560;

    switch (plan) {
      case 'WEEKLY':
        durationDays = 7;
        planType = 'Weekly';
        amount = 560;
        break;
      case 'MONTHLY':
        durationDays = 30;
        planType = 'Monthly';
        amount = 2000;
        break;
      case 'ONEDAY':
        durationDays = 1;
        planType = 'Trial';
        amount = 80;
        break;
      default:
        return res.status(400).json({ message: 'Invalid plan type' });
    }

    // STEP 0: DUPLICATE CHECK - Prevent creating duplicate pending orders
    // Check for any existing pending order with same userId, vendorId, planType created within last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const duplicateOrder = await Order.findOne({
      userId: userId,
      vendorId: vendorId,
      planType: planType,
      $or: [
        { status: 'pending' },
        { offerStatus: 'pending' }
      ],
      createdAt: { $gte: thirtySecondsAgo }
    });

    if (duplicateOrder) {
      return res.status(409).json({ 
        message: 'duplicate order detected' 
      });
    }

    // STEP 1: Query all existing pending orders for this user, sorted by scheduledEndDate descending
    // FIX: Check both status: 'pending' AND offerStatus: 'pending' to include all pending orders
    const existingPendingOrders = await Order.find({
      userId: userId,
      $or: [
        { status: 'pending' },
        { offerStatus: 'pending' }
      ]
    }).sort({ scheduledEndDate: -1 });

    let scheduledStartDate;
    
    if (existingPendingOrders && existingPendingOrders.length > 0) {
      // STEP 2: User has existing pending orders - take the most recent one's scheduledEndDate + 1 day
      const mostRecentPendingOrder = existingPendingOrders[0];
      const lastScheduledEndDate = new Date(mostRecentPendingOrder.scheduledEndDate);
      scheduledStartDate = new Date(lastScheduledEndDate.getTime() + 86400000); // Add 1 day (24 * 60 * 60 * 1000 ms)
    } else {
      // STEP 3: No pending orders - check for active subscription
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const activeSubscription = await Subscription.findOne({
        userId: userId,
        status: 'active',
        expiryDate: { $gte: now }
      });

      if (activeSubscription && activeSubscription.expiryDate) {
        // Use active subscription endDate + 1 day
        const activeEndDate = new Date(activeSubscription.expiryDate);
        scheduledStartDate = new Date(activeEndDate.getTime() + 86400000); // Add 1 day
      } else {
        // No active subscription either - start from tomorrow
        scheduledStartDate = new Date(now);
        scheduledStartDate.setDate(scheduledStartDate.getDate() + 1);
      }
    }

    // STEP 4: Calculate scheduledEndDate using the formula: scheduledStartDate.getTime() + durationDays * 86400000
    const scheduledEndDate = new Date(scheduledStartDate.getTime() + durationDays * 86400000);

    // Get user and vendor
    const user = await User.findById(userId);
    const vendor = await Vendor.findById(vendorId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Determine payment status based on payment method
    const paymentStatus = paymentMethod === 'UPI' ? 'Paid' : 'Pending';

    // Create the pending order
    const order = await Order.create({
      userId: userId,
      vendorId,
      customerName: user.name,
      amount: amount,
      deliverySlot: 'Lunch',
      mealPreference: 'Regular',
      paymentStatus: paymentStatus,
      paymentMethod: paymentMethod,
      planType: planType,
      status: 'pending',
      scheduledStartDate: scheduledStartDate,
      scheduledEndDate: scheduledEndDate,
      startDate: scheduledStartDate,
      endDate: scheduledEndDate
    });

    // CONSOLE LOG: After saving the new order - verify the saved values
    console.log('=== EXTEND SUBSCRIPTION ORDER SAVED ===');
    console.log('orderId:', order._id);
    console.log('status:', order.status);
    console.log('scheduledStartDate:', order.scheduledStartDate);
    console.log('scheduledEndDate:', order.scheduledEndDate);
    console.log('=========================================');

    // Send extension confirmation email (non-blocking)
    try {
      const emailSubject = 'MealSetu - Subscription Extended Successfully!';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">✅ Subscription Extended!</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Dear <strong>${user.name}</strong>,</p>
            <p style="font-size: 16px;">Your subscription has been <strong>successfully extended</strong>! Here are the details:</p>
            
            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #16a34a;">
              <h3 style="color: #16a34a; margin: 0 0 15px 0;">📋 Order Details</h3>
              <p style="margin: 8px 0;"><strong>🏪 Vendor:</strong> ${vendor.kitchenName}</p>
              <p style="margin: 8px 0;"><strong>📦 Plan Type:</strong> ${planType}</p>
              <p style="margin: 8px 0;"><strong>💰 Amount Paid:</strong> ₹${amount}</p>
              <p style="margin: 8px 0;"><strong>📅 Scheduled Start Date:</strong> ${scheduledStartDate.toLocaleDateString('en-IN')}</p>
              <p style="margin: 8px 0;"><strong>📅 Scheduled End Date:</strong> ${scheduledEndDate.toLocaleDateString('en-IN')}</p>
              <p style="margin: 8px 0;"><strong>⏱️ Duration:</strong> ${durationDays} days</p>
            </div>
            
            <p style="color: #555; font-size: 16px; background: #fef3c7; padding: 15px; border-radius: 8px;">
              ⏰ <strong>Note:</strong> Your new plan will automatically activate on <strong>${scheduledStartDate.toLocaleDateString('en-IN')}</strong>.
            </p>
            
            <p style="color: #555;">Thank you for choosing MealSetu!</p>
          </div>
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>MealSetu - Quality Food, Delivered with Care</p>
          </div>
        </div>
      `;
      await sendEmail(user.email, emailSubject, emailHtml);
    } catch (emailError) {
      console.error('Failed to send extension confirmation email:', emailError.message);
    }

    // Populate vendor info for response
    const populatedOrder = await Order.findById(order._id).populate('vendorId', 'kitchenName');

    res.status(201).json({
      message: 'Subscription extended successfully',
      order: {
        _id: populatedOrder._id,
        planType: populatedOrder.planType,
        vendorId: populatedOrder.vendorId._id,
        vendorName: populatedOrder.vendorId.kitchenName,
        scheduledStartDate: populatedOrder.scheduledStartDate,
        scheduledEndDate: populatedOrder.scheduledEndDate,
        amount: populatedOrder.amount,
        status: populatedOrder.status
      }
    });

  } catch (error) {
    console.error('Extend subscription order error:', error);
    res.status(500).json({ message: 'Error extending subscription', error: error.message });
  }
};

module.exports = {
  getUserSubscription,
  getActiveSubscriptionStatus,
  applyLeave,
  extendSubscription,
  getCurrentUser,
  updateUserProfile,
  updateUserProfilePic,
  changePassword,
  getUserOrders,
  getMenus,
  placeOrder,
  addReview,
  getVendorReviews,
  getVendorRating,
  getVendorStatus,
  getApprovedVendors,
  checkReviewEligibility,
  getTrialEligibility,
  createTrialOrder,
  getMySubscription,
  getUpcomingOrders,
  extendSubscriptionOrder
};
