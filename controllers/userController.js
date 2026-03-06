const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Helper function to transform profilePic path to full URL
const transformProfilePic = (profilePic, protocol, host) => {
  if (!profilePic) return null;
  if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
    return profilePic;
  }
  return `${protocol}://${host}/${profilePic}`;
};

// Helper function to send email
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
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
      // Ensure path starts with /uploads/
      if (!normalized.startsWith('/uploads/')) {
        normalized = '/uploads/' + normalized.split('/uploads/').pop();
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

    const menus = await Menu.find({ date: { $gte: start, $lte: end }, isLive: true }).populate('vendorId');

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
        // Include vendor images for display
        profileImage: v.profileImage ? transformImageUrl(v.profileImage) : null,
        kitchenPoster: v.kitchenPoster ? transformImageUrl(v.kitchenPoster) : null
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

    const subscriptionStartDate = startDate ? new Date(startDate) : new Date();
    const subscriptionExpiryDate = new Date(subscriptionStartDate);
    subscriptionExpiryDate.setDate(subscriptionExpiryDate.getDate() + durationDays);

    const order = await Order.create({
      userId: req.user._id,
      vendorId,
      amount: numericAmount,
      deliverySlot,
      mealPreference: mealPref,
      paymentStatus: paymentMethod === 'Cash' ? 'Pending' : 'Paid',
      paymentMethod,
      planType: planType
    });

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
      approvalStatus: 'Approved',
      isOpen: true
    }).select('kitchenName address pincode menuPrice rating workingDays timings profileImage kitchenPoster weeklyPlan');

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
      weeklyPlan: vendor.weeklyPlan
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

module.exports = { getCurrentUser, updateUserProfile, updateUserProfilePic, changePassword, getMenus, getUserOrders, placeOrder, addReview, applyLeave, getUserSubscription, extendSubscription, getVendorStatus, getVendorReviews, getVendorRating, checkReviewEligibility, getApprovedVendors };
