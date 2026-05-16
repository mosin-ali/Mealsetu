const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/emailUtils');
const { computeSubscriptionDates, getPlanDurationDays, getMealSlotInfo } = require('../utils/mealTimingUtils');
const VendorPricing = require('../models/VendorPricing');
const JainMenu = require('../models/JainMenu');

// Helper function to transform profilePic path to full URL
const transformProfilePic = (profilePic, protocol, host) => {
  if (!profilePic) return null;
  if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
    return profilePic;
  }
  return `${protocol}://${host}${profilePic.startsWith('/') ? '' : '/'}${profilePic}`;
};

// Helper function to count user's pending plans
const getPendingPlansCount = async (userId) => {
  return await Order.countDocuments({
    userId: userId,
    $or: [
      { status: 'pending' },
      { offerStatus: 'pending' }
    ]
  });
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

    const pendingOrders = await Order.find({
      userId,
      status: 'pending'
    }).sort({ scheduledStartDate: 1 });

    const DURATION_MAP = { Weekly: 7, Monthly: 30, Trial: 1, Tiffin: 1 };
    let chainEnd = new Date(currentExpiry);

    for (const po of pendingOrders) {
      const dur = DURATION_MAP[po.planType] ?? 7;
      const newStart = new Date(chainEnd.getTime() + 86400000);
      const newEnd   = new Date(newStart.getTime() + dur * 86400000);
      po.scheduledStartDate = newStart;
      po.scheduledEndDate   = newEnd;
      po.startDate          = newStart;
      po.endDate            = newEnd;
      await po.save();
      chainEnd = newEnd;
    }

    const user = await User.findById(userId);
    if (user) {
      user.expiryDate = currentExpiry;
      await user.save();

      try {
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

    const paymentStatus = paymentMethod === 'UPI' ? 'Paid' : 'Pending';

    let durationDays = 1;
    let planType = 'Trial';
    let amount = 80;

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
        amount = 80;
        break;
    }

    // Dynamic pricing from VendorPricing collection
      const vendorPricingRecord = await VendorPricing.findOne({
        vendor_id: vendorId,
        plan_type: planType.toLowerCase(),
        is_active: true
      });

      if (vendorPricingRecord && vendorPricingRecord.price > 0) {
        amount = vendorPricingRecord.price;
      } else {
        // Fallback to vendor.pricing array
        const vendorForPricing = await Vendor.findById(vendorId);
        const pricingArray = Array.isArray(vendorForPricing?.pricing) ? vendorForPricing.pricing : [];
        const matchedPlan = pricingArray.find(
          p => (p.planType === planType.toLowerCase() || p.type === planType.toLowerCase()) && p.active
        );
        amount = matchedPlan?.price;
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          message: 'This vendor has not configured pricing yet. Please contact support.'
        });
      }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const user = await User.findById(userId);
    const vendor = await Vendor.findById(vendorId);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

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

    const normalizePath = (filePath) => {
      if (!filePath) return null;
      let normalized = filePath.replace(/\\/g, '/');
      if (normalized.includes('uploads/')) {
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
    const orders = await Order.find({ userId: req.user._id })
      .populate('vendorId', 'kitchenName address')
      .sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get All Menus for a specific date
// @route   GET /api/users/menus?date=2026-02-05
// const getMenus = async (req, res) => {
//   try {
//     const date = req.query.date ? new Date(req.query.date) : new Date();
//     const start = new Date(date);
//     start.setHours(0, 0, 0, 0);
//     const end = new Date(date);
//     end.setHours(23, 59, 59, 999);

//     const menus = await Menu.find({ date: { $gte: start, $lte: end }, isLive: true })
//       .populate(
//         'vendorId',
//         'kitchenName address kitchenAddress menuPrice rating workingDays timings profileImage kitchenPoster fssaiNumber fssaiLicense trialEnabled trialFee latitude longitude upiId offersJainMenu'
//       );  // Removed pricing from populate - fetch separately

//     const transformImageUrl = (imagePath) => {
//       if (!imagePath) return null;
//       if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
//       const backendUrl = `${req.protocol}://${req.get('host')}`;
//       if (imagePath.startsWith('/uploads/')) return `${backendUrl}${imagePath}`;
//       return `${backendUrl}/uploads/${imagePath.replace(/^\/?uploads\//, '')}`;
//     };

//     // ✅ OPTIMIZED: Single query for all vendor pricing using $in
//     const vendorIds = menus.map(m => m.vendorId?._id).filter(Boolean);
//     // ✅ PRICING
//     const pricingRecords = await VendorPricing.find({ 
//       vendor_id: { $in: vendorIds } 
//     });
//     // ✅ JAIN MENU
//     const jainMenuRecords = await JainMenu.find({ vendor_id: { $in: vendorIds } });
//     const jainMenuByVendor = {};
//     jainMenuRecords.forEach(record => {
//       if (!jainMenuByVendor[record.vendor_id.toString()]) jainMenuByVendor[record.vendor_id.toString()] = [];
//       jainMenuByVendor[record.vendor_id.toString()].push(record);
//     });

//     // Group pricing by vendor_id for O(1) lookup
//     const pricingByVendor = {};
//     pricingRecords.forEach(record => {
//       if (!pricingByVendor[record.vendor_id.toString()]) {
//         pricingByVendor[record.vendor_id.toString()] = [];
//       }
//       pricingByVendor[record.vendor_id.toString()].push({
//         type: record.plan_type,
//         price: record.price,
//         active: record.is_active
//       });
//     });

//     const mapped = await Promise.all(menus.map(async (m) => {
//       const v = m.vendorId || {};
      
//       // ✅ DYNAMIC PRICING FROM VendorPricing collection
//       const vendorPricing = pricingByVendor[v._id?.toString()] || [];
//       const activePricing = vendorPricing.filter(p => p.active && p.price > 0);
//       const jainMenu = jainMenuByVendor[v._id?.toString()] || [];
      
//       return {
//         _id: m._id,
//         date: m.date,
//         mainSabji: m.mainSabji,
//         altSabji: m.altSabji,
//         sweetItem: m.sweetItem,
//         dietaryCategory: m.dietaryCategory,
//         cycleType: m.cycleType,

//         vendorId: v._id || null,
//         kitchenName: v.kitchenName || 'Partner Kitchen',
//         address: v.address || v.kitchenAddress || '',
//         pincode: v.pincode || '',

//         pricing: activePricing,  // ✅ Frontend-expected array format
//         jainMenu,  // ✅ Array [{day: 'Monday', main_course: '...'}]
//         upiId: v.upiId || '',

//         menuPrice: v.menuPrice || 80,
//         rating: v.rating || 4.5,
//         fssaiNumber: v.fssaiNumber || v.fssaiLicense || '',
//         workingDays: v.workingDays || 'Mon - Sat',
//         timings: v.timings || '11:00 AM - 09:00 PM',

//         profileImage: v.profileImage ? transformImageUrl(v.profileImage) : null,
//         kitchenPoster: v.kitchenPoster ? transformImageUrl(v.kitchenPoster) : null,

//         trialEnabled: v.trialEnabled === true,
//         trialFee: v.trialFee || 0,
//         offersJainMenu: v.offersJainMenu || false,
//         upiId: v.upiId || null,
//         latitude: v.latitude,
//         longitude: v.longitude
//       };
//     }));

//     res.json(mapped);
//   } catch (error) {
//     console.error('getMenus error:', error);
//     res.status(500).json({ message: 'Server Error', error: error.message });
//   }
// };


const getMenus = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const menus = await Menu.find({
      date: { $gte: start, $lte: end },
      isLive: true
    }).populate(
      'vendorId',
      'kitchenName address kitchenAddress menuPrice rating workingDays timings profileImage kitchenPoster fssaiNumber fssaiLicense trialEnabled trialFee latitude longitude upiId offersJainMenu jainWeeklyPlan pricing'
    );

    const transformImageUrl = (imagePath) => {
      if (!imagePath) return null;
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;

      const backendUrl = `${req.protocol}://${req.get('host')}`;

      if (imagePath.startsWith('/uploads/')) {
        return `${backendUrl}${imagePath}`;
      }

      return `${backendUrl}/uploads/${imagePath.replace(/^\/?uploads\//, '')}`;
    };

    // 🔥 Get all vendor IDs
    const vendorIds = menus.map(m => m.vendorId?._id).filter(Boolean);

    // 🔥 Fetch pricing in one query
    const pricingRecords = await VendorPricing.find({
      vendor_id: { $in: vendorIds }
    });

    // 🔥 Group pricing by vendor
    const pricingByVendor = {};
    pricingRecords.forEach(record => {
      const vid = record.vendor_id.toString();

      if (!pricingByVendor[vid]) {
        pricingByVendor[vid] = [];
      }

      pricingByVendor[vid].push({
        type: record.plan_type,
        price: record.price,
        active: record.is_active
      });
    });

    // 🔥 Map menus
    const mapped = menus.map((m) => {
      const v = m.vendorId || {};

      const vendorPricing = pricingByVendor[v._id?.toString()] || [];

      const activePricing = vendorPricing.filter(
        p => p.active && p.price > 0
      );

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
        pincode: v.pincode || '',

        // ✅ PRICING FIX
        pricing: activePricing,

        menuPrice: v.menuPrice || 80,
        rating: v.rating || 4.5,

        fssaiNumber: v.fssaiNumber || v.fssaiLicense || '',
        workingDays: v.workingDays || 'Mon - Sat',
        timings: v.timings || '11:00 AM - 09:00 PM',

        profileImage: v.profileImage
          ? transformImageUrl(v.profileImage)
          : null,

        kitchenPoster: v.kitchenPoster
          ? transformImageUrl(v.kitchenPoster)
          : null,

        trialEnabled: v.trialEnabled === true,
        trialFee: v.trialFee || 0,
        offersJainMenu: v.offersJainMenu || false,
        jainWeeklyPlan: v.jainWeeklyPlan || {},

        latitude: v.latitude,
        longitude: v.longitude
      };
    });


    res.json(mapped);

  } catch (error) {
    console.error('getMenus error:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Place an Order or Create Subscription
// @route   POST /api/users/order
const placeOrder = async (req, res) => {
  // Get Socket.IO instance
  const io = req.app.get('io');
  try {
    console.log('=== PLACE ORDER API CALLED ===');
    console.log('userId:', req.user?._id);
    console.log('vendorId:', req.body?.vendorId);
    console.log('plan:', req.body?.plan);
    console.log('timestamp:', new Date().toISOString());
    console.log('================================');

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

    const mealPreferenceMap = {
      'regular': 'Regular',
      'jain': 'Jain',
      'Regular': 'Regular',
      'Jain': 'Jain'
    };
    const mealPref = mealPreferenceMap[mealPreference] || 'Regular';

    const user = await User.findById(req.user._id);
    const vendor = await Vendor.findById(vendorId);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

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

    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const activeOrder = await Order.findOne({
      userId: req.user._id,
      status: 'active',
      endDate: { $gte: now }
    });

    console.log('=== CHECKING FOR ACTIVE ORDER ===');
    console.log('activeOrder found:', activeOrder ? activeOrder._id : null);
    console.log('activeOrder endDate:', activeOrder?.endDate);
    console.log('===================================');

    let subscriptionStartDate;
    let subscriptionExpiryDate;

    if (activeOrder) {
      // Check pending plans limit (max 3)
      const pendingCount = await getPendingPlansCount(req.user._id);
      if (pendingCount >= 3) {
        return res.status(400).json({
          message: 'You have reached the maximum limit of 3 upcoming plan extensions.'
        });
      }

      // Find existing pending orders to chain after
      const existingPendingOrders = await Order.find({
        userId: req.user._id,
        $or: [{ status: 'pending' }, { offerStatus: 'pending' }]
      }).sort({ scheduledEndDate: -1 });

      if (existingPendingOrders && existingPendingOrders.length > 0) {
        const lastScheduledEndDate = new Date(existingPendingOrders[0].scheduledEndDate);
        subscriptionStartDate = new Date(lastScheduledEndDate.getTime() + 86400000);
      } else {
        if (activeOrder.endDate) {
          subscriptionStartDate = new Date(new Date(activeOrder.endDate).getTime() + 86400000);
        } else {
          subscriptionStartDate = new Date(now);
          subscriptionStartDate.setDate(subscriptionStartDate.getDate() + 1);
        }
      }

      subscriptionExpiryDate = new Date(subscriptionStartDate.getTime() + durationDays * 86400000);

      console.log('=== CREATING PENDING ORDER ===');
      console.log('scheduledStartDate:', subscriptionStartDate);
      console.log('scheduledEndDate:', subscriptionExpiryDate);
      console.log('=================================');

      const order = await Order.create({
        userId: req.user._id,
        vendorId,
        amount: numericAmount,
        deliverySlot,
        mealPreference: mealPref,
        paymentStatus: paymentMethod === 'Cash' ? 'Pending' : 'Paid',
        paymentMethod,
        planType,
        status: 'pending',
        scheduledStartDate: subscriptionStartDate,
        scheduledEndDate: subscriptionExpiryDate,
        startDate: subscriptionStartDate,
        endDate: subscriptionExpiryDate
      });

      console.log('=== PENDING ORDER SAVED ===');
      console.log('orderId:', order._id);
      console.log('status:', order.status);
      console.log('===========================');

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
              <p><strong>Amount:</strong> ₹${numericAmount}</p>
              <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            </div>
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

    // No active order — create active order immediately with smart meal timing
    ({ startDate: subscriptionStartDate, endDate: subscriptionExpiryDate } =
      computeSubscriptionDates(durationDays));

    const order = await Order.create({
      userId: req.user._id,
      vendorId,
      amount: numericAmount,
      deliverySlot,
      mealPreference: mealPref,
      paymentStatus: paymentMethod === 'Cash' ? 'Pending' : 'Paid',
      paymentMethod,
      planType,
      status: 'active',
      startDate: subscriptionStartDate,
      endDate: subscriptionExpiryDate
    });

    console.log('=== ACTIVE ORDER SAVED ===');
    console.log('orderId:', order._id);
    console.log('status:', order.status);
    console.log('==========================');

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

    // ===== REAL-TIME: Emit socket events for new order =====
    if (io) {
      // Notify vendor about new order
      io.to(`vendor_${vendorId}`).emit('newOrder', {
        order: order,
        message: 'New order received!'
      });
      // Notify admin about new order
      io.to('admin_room').emit('orderUpdate', {
        order: order,
        message: 'New order placed'
      });
      // Notify user their subscription is now active
      io.to(req.user._id.toString()).emit('subscription_updated', {
        type: 'order_placed',
        planType: order.planType
      });
      console.log('📡 Socket events emitted for new order');
    }

    try {
      const slotInfo = getMealSlotInfo(subscriptionStartDate, new Date());
      const endFormatted = new Date(subscriptionExpiryDate).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const emailSubject = `MealSetu — ${planType} Subscription Confirmed`;
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#f26522;padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:22px">✅ Subscription Confirmed!</h1>
          </div>
          <div style="padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
            <p>Dear ${user.name},</p>
            <p>Your <strong>${planType}</strong> plan from <strong>${vendor.kitchenName}</strong> is confirmed.</p>
            <div style="background:${slotInfo.badgeBg};border-left:4px solid ${slotInfo.badgeColor};border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0 0 6px 0;font-weight:700;color:${slotInfo.badgeColor};font-size:16px">${slotInfo.slotLabel}</p>
              <p style="margin:0 0 4px 0;color:#374151;font-size:14px">${slotInfo.startMessage}</p>
              <p style="margin:0;color:#64748b;font-size:13px">${slotInfo.mealMessage}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Plan</td>
                <td style="padding:10px 14px;color:#64748b">${planType}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#374151">Kitchen</td>
                <td style="padding:10px 14px;color:#64748b">${vendor.kitchenName}</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Valid Until</td>
                <td style="padding:10px 14px;color:#64748b">${endFormatted}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#374151">Amount</td>
                <td style="padding:10px 14px;color:#64748b">₹${numericAmount}</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Payment Method</td>
                <td style="padding:10px 14px;color:#64748b">${paymentMethod}</td>
              </tr>
            </table>
            <p style="color:#64748b;font-size:13px;text-align:center;margin-top:20px">Thank you for choosing MealSetu!</p>
          </div>
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

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hasOrderedFromVendor = await Order.findOne({
      userId: req.user._id,
      vendorId: vendorId
    });

    if (!hasOrderedFromVendor) {
      return res.status(403).json({
        message: 'You must have placed an order from this vendor to leave a review'
      });
    }

    const review = await Review.create({
      userId: req.user._id,
      vendorId,
      orderId: hasOrderedFromVendor._id,
      rating,
      comment,
      customerName: user.name || 'Anonymous'
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Error adding review' });
  }
};

// @desc    Get Vendor Reviews
// @route   GET /api/users/vendor-reviews/:vendorId
const getVendorReviews = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const reviews = await Review.find({ vendorId })
      .populate('userId', 'name')
      .sort({ rating: -1, createdAt: -1 });

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

// @desc    Get Vendor Rating
// @route   GET /api/users/vendor-rating/:vendorId
const getVendorRating = async (req, res) => {
  try {
    const { vendorId } = req.params;

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

// @desc    Get Vendor Status
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

// @desc    Get All Approved Vendors
// @route   GET /api/users/vendors
const getApprovedVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({
      isApproved: true
    }).select('kitchenName address pincode menuPrice rating workingDays timings profileImage kitchenPoster weeklyPlan trialEnabled trialFee latitude longitude upiId offersJainMenu jainWeeklyPlan _id jainWeeklyPlan offersJainMenu');

    const vendorIds = vendors.map(v => v._id);

    // ✅ PRICING - Single query
    const pricingRecords = await VendorPricing.find({ vendor_id: { $in: vendorIds } });
    const pricingByVendor = {};
    pricingRecords.forEach(record => {
      if (!pricingByVendor[record.vendor_id.toString()]) pricingByVendor[record.vendor_id.toString()] = [];
      pricingByVendor[record.vendor_id.toString()].push({
        type: record.plan_type,
        price: record.price,
        active: record.is_active
      });
    });

    // ✅ JAIN MENU - Single query for all vendors
    const jainMenuRecords = await JainMenu.find({ vendor_id: { $in: vendorIds } });
    const jainMenuByVendor = {};
    jainMenuRecords.forEach(record => {
      if (!jainMenuByVendor[record.vendor_id.toString()]) jainMenuByVendor[record.vendor_id.toString()] = [];
      jainMenuByVendor[record.vendor_id.toString()].push(record);
    });

    const transformedVendors = vendors.map(vendor => {
      const activePricing = (pricingByVendor[vendor._id.toString()] || []).filter(p => p.active && p.price > 0);
      const jainMenu = jainMenuByVendor[vendor._id.toString()] || [];
      
      return {
        _id: vendor._id,
        vendorId: vendor._id,
        name: vendor.kitchenName,
        address: vendor.address,
        pincode: vendor.pincode || '',
        price: vendor.menuPrice || 80,
        rating: vendor.rating || 4.5,
        type: 'Regular',
        fssai: vendor.fssaiNumber || '',
        workingDays: vendor.workingDays || 'Mon - Sat',
        timings: vendor.timings || '11:00 AM - 09:00 PM',
        profileImage: vendor.profileImage ? transformProfilePic(vendor.profileImage, req.protocol, req.get('host')) : null,
        kitchenPoster: vendor.kitchenPoster ? transformProfilePic(vendor.kitchenPoster, req.protocol, req.get('host')) : null,
        pricing: activePricing,
        offersJainMenu: vendor.offersJainMenu || false,
        jainWeeklyPlan: vendor.jainWeeklyPlan || {},
        upiId: vendor.upiId || null,
        weeklyPlan: vendor.weeklyPlan,
        trialEnabled: vendor.trialEnabled === true,
        trialFee: vendor.trialFee || 0
      };
    });

    res.json(transformedVendors);
  } catch (error) {
    console.error('Error fetching approved vendors:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Vendors By Pincode
// @route   GET /api/users/vendors-by-pincode
const getVendorsByPincode = async (req, res) => {
  try {
    const { pincode, userLat, userLon } = req.query;

    if (!pincode) {
      return res.status(400).json({ message: 'Pincode is required' });
    }

    const userLatitude = userLat ? parseFloat(userLat) : null;
    const userLongitude = userLon ? parseFloat(userLon) : null;

    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    }

    let vendors = await Vendor.find({
      isApproved: true,
      pincode: pincode
    }).select('kitchenName address pincode menuPrice rating workingDays timings profileImage kitchenPoster weeklyPlan trialEnabled trialFee latitude longitude upiId offersJainMenu jainWeeklyPlan _id jainWeeklyPlan offersJainMenu');

    let locationNote = '';

    if (vendors.length === 0) {
      const prefix3 = pincode.slice(0, 3);
    vendors = await Vendor.find({
        isApproved: true,
        $expr: { $regexMatch: { input: '$pincode', regex: `^${prefix3}` } }
      }).select('kitchenName address pincode menuPrice rating workingDays timings profileImage kitchenPoster weeklyPlan trialEnabled trialFee latitude longitude upiId offersJainMenu jainWeeklyPlan _id jainWeeklyPlan offersJainMenu');

      if (vendors.length === 0) {
    vendors = await Vendor.find({ isApproved: true })
      .select('kitchenName address pincode menuPrice rating workingDays timings profileImage kitchenPoster weeklyPlan trialEnabled trialFee latitude longitude upiId offersJainMenu jainWeeklyPlan _id jainWeeklyPlan offersJainMenu');
        locationNote = 'Showing all available vendors — no vendors found in your exact area yet';
      } else {
        locationNote = `Found ${vendors.length} vendors near ${pincode} (area match)`;
      }
    } else {
      locationNote = `Showing ${vendors.length} vendors in ${pincode}`;
    }

    // ✅ OPTIMIZED pricing fetch (same as getMenus/getApprovedVendors)
    const vendorIds = vendors.map(v => v._id);
    const pricingRecords = await VendorPricing.find({ vendor_id: { $in: vendorIds } });
    const pricingByVendor = {};
    pricingRecords.forEach(record => {
      if (!pricingByVendor[record.vendor_id.toString()]) {
        pricingByVendor[record.vendor_id.toString()] = [];
      }
      pricingByVendor[record.vendor_id.toString()].push({
        type: record.plan_type,
        price: record.price,
        active: record.is_active
      });
    });

    const transformedVendors = vendors.map(vendor => {
      const activePricing = (pricingByVendor[vendor._id.toString()] || []).filter(p => p.active && p.price > 0);
      let distanceKm = null;
      if (userLatitude && userLongitude && vendor.latitude && vendor.longitude) {
        distanceKm = haversineDistance(userLatitude, userLongitude, vendor.latitude, vendor.longitude);
      }

      return {
        _id: vendor._id,
        vendorId: vendor._id,
        name: vendor.kitchenName,
        address: vendor.address,
        pincode: vendor.pincode || '',
        price: vendor.menuPrice || 80,
        rating: vendor.rating || 4.5,
        type: 'Regular',
        fssai: vendor.fssaiNumber || '',
        workingDays: vendor.workingDays || 'Mon - Sat',
        timings: vendor.timings || '11:00 AM - 09:00 PM',
        profileImage: vendor.profileImage ? transformProfilePic(vendor.profileImage, req.protocol, req.get('host')) : null,
        kitchenPoster: vendor.kitchenPoster ? transformProfilePic(vendor.kitchenPoster, req.protocol, req.get('host')) : null,
        upiId: vendor.upiId || null,
        weeklyPlan: vendor.weeklyPlan,
        trialEnabled: vendor.trialEnabled === true,
        trialFee: vendor.trialFee || 0,
        offersJainMenu: vendor.offersJainMenu || false,
        jainWeeklyPlan: vendor.jainWeeklyPlan || {},
        pricing: activePricing,  // ✅ From VendorPricing collection
        distanceKm,
        latitude: vendor.latitude,
        longitude: vendor.longitude
      };
    });

    res.json({
      vendors: transformedVendors,
      locationNote,
      matchedBy: vendors.length > 0 ? 'pincode' : 'fallback',
      totalCount: transformedVendors.length
    });
  } catch (error) {
    console.error('Error in getVendorsByPincode:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Check review eligibility
// @route   GET /api/users/review-eligibility/:vendorId
const checkReviewEligibility = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user._id;

    const anyOrder = await Order.findOne({
      userId: userId,
      vendorId: vendorId
    }).sort({ createdAt: -1 });

    if (anyOrder) {
      return res.json({
        canReview: true,
        hasOrdered: true,
        orderId: anyOrder._id,
        orderStatus: anyOrder.orderStatus,
        message: 'You can review this vendor!'
      });
    }

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

// @desc    Get trial eligibility
// @route   GET /api/users/trial-eligibility/:vendorId
const getTrialEligibility = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    if (!vendor.trialEnabled) {
      return res.json({
        eligible: false,
        reason: 'trial_not_available',
        message: 'This vendor does not offer trials'
      });
    }

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

    return res.json({
      eligible: true,
      trialFee: vendor.trialFee || 0,
      message: vendor.trialFee > 0 ? `Trial available for ₹${vendor.trialFee}` : 'Free trial available'
    });
  } catch (error) {
    console.error('Get trial eligibility error:', error);
    res.status(500).json({ message: 'Error checking trial eligibility' });
  }
};

// @desc    Get active subscription status
// @route   GET /api/users/subscription-status
const getActiveSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const activeOrder = await Order.findOne({
      userId: userId,
      status: { $in: ['active', 'trial'] },
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

    if (!vendorId) return res.status(400).json({ message: 'vendorId is required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    if (!vendor.trialEnabled) {
      return res.status(400).json({ message: 'This vendor does not offer trials' });
    }

    const hasUsedTrial = user.trialHistory && user.trialHistory.some(
      trial => trial.vendorId && trial.vendorId.toString() === vendorId
    );

    if (hasUsedTrial) {
      return res.status(403).json({ message: 'You have already used a trial for this vendor' });
    }

    const trialFee = vendor.trialFee || 0;
    const { startDate, endDate, mealSlotToday } = computeSubscriptionDates(
      getPlanDurationDays('Trial')   // 2 days
    );

    let paymentStatus = 'Pending';
    if (trialFee === 0) {
      paymentStatus = 'Paid';    // free trial — no payment needed, mark as settled
    } else {
      paymentStatus = paymentMethod === 'UPI' ? 'Paid' : 'Pending';
    }

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
      return res.status(500).json({ message: 'Error creating trial order: ' + orderError.message });
    }

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
    }

    if (!user.trialHistory) user.trialHistory = [];
    user.trialHistory.push({ vendorId, trialTakenAt: new Date() });
    await user.save();

    try {
      const slotInfo = getMealSlotInfo(startDate, new Date());
      const endFormatted = new Date(endDate).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const emailSubject = 'MealSetu — Your 2-Day Trial is Activated!';
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#16a34a;padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:22px">🎉 Trial Activated!</h1>
          </div>
          <div style="padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
            <p>Dear ${user.name},</p>
            <p>Your 2-day trial from <strong>${vendor.kitchenName}</strong> has been activated!</p>
            <div style="background:${slotInfo.badgeBg};border-left:4px solid ${slotInfo.badgeColor};border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0 0 6px 0;font-weight:700;color:${slotInfo.badgeColor};font-size:16px">${slotInfo.slotLabel}</p>
              <p style="margin:0 0 4px 0;color:#374151;font-size:14px">${slotInfo.startMessage}</p>
              <p style="margin:0;color:#64748b;font-size:13px">${slotInfo.mealMessage}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Kitchen</td>
                <td style="padding:10px 14px;color:#64748b">${vendor.kitchenName}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#374151">Trial Ends</td>
                <td style="padding:10px 14px;color:#64748b">${endFormatted}</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Trial Fee</td>
                <td style="padding:10px 14px;color:#64748b">${trialFee > 0 ? `₹${trialFee}` : 'FREE'}</td>
              </tr>
            </table>
            <p style="color:#64748b;font-size:13px;text-align:center;margin-top:20px">Thank you for choosing MealSetu!</p>
          </div>
        </div>
      `;
      await sendEmail(user.email, emailSubject, emailHtml);
    } catch (emailError) {
      console.error('Failed to send trial confirmation email:', emailError);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('subscription_updated', {
        type: 'trial_started',
        message: 'Your trial is now active!'
      });
      io.to(`vendor_${vendorId}`).emit('new_order', {
        type: 'trial_order',
        message: 'New trial order received'
      });
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
    res.status(500).json({ message: 'Error creating trial order', error: error.message });
  }
};

// @desc    Get this user's cash payment orders
// @route   GET /api/users/my-cash-payments
const getMyCashPayments = async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.user._id,
      paymentMethod: 'Cash'
    })
      .populate('vendorId', 'kitchenName address')
      .sort({ orderDate: -1 });

    const mapped = orders.map(order => ({
      orderId: order._id,
      planType: order.planType,
      amount: order.amount,
      orderDate: order.orderDate,
      paymentStatus: order.paymentStatus,
      cashPaymentConfirmedAt: order.cashPaymentConfirmedAt || null,
      vendorName: order.vendorId?.kitchenName || 'Partner Kitchen',
      startDate: order.startDate,
      endDate: order.endDate
    }));

    res.json(mapped);
  } catch (error) {
    console.error('getMyCashPayments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user's active subscription order
// @route   GET /api/orders/my-subscription
// FIX 2: Fixed to properly return active orders where startDate has already started
const getMySubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const tomorrowMidnight = new Date(now);
    tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);

    const activeOrder = await Order.findOne({
      userId: userId,
      status: { $in: ['active', 'trial'] },
      startDate: { $lt: tomorrowMidnight },
      endDate: { $gte: now }
    })
      .populate('vendorId', 'kitchenName')
      .sort({ createdAt: -1 });

    if (!activeOrder) return res.json(null);

    // ✅ Fetch vendor pricing for frontend dynamic plan rendering
    const vendorPricingRecords = await VendorPricing.find({
      vendor_id: activeOrder.vendorId._id,
      is_active: true
    });

    const pricing = vendorPricingRecords
      .filter(p => p.price > 0)
      .map(p => ({ type: p.plan_type, price: p.price }));

    res.json({
      planType: activeOrder.planType,
      startDate: activeOrder.startDate,
      endDate: activeOrder.endDate,
      orderDate: activeOrder.orderDate,
      status: 'active',
      vendorId: activeOrder.vendorId?._id,
      vendorName: activeOrder.vendorId?.kitchenName || 'Partner Kitchen',
      amount: activeOrder.amount,
      paymentMethod: activeOrder.paymentMethod,
      paymentStatus: activeOrder.paymentStatus,
      cashPaymentConfirmedAt: activeOrder.cashPaymentConfirmedAt || null,
      orderId: activeOrder._id,
      pricing
    });
  } catch (error) {
    console.error('Get my subscription error:', error);
    res.status(500).json({ message: 'Error getting subscription', error: error.message });
  }
};

// @desc    Get upcoming (pending) orders
// @route   GET /api/orders/upcoming
// FIX 3: Add date filter so only truly future pending orders show as upcoming
const getUpcomingOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const upcomingOrders = await Order.find({
      userId: userId,
      status: 'pending',
      startDate: { $gte: now }
    })
      .populate('vendorId', 'kitchenName')
      .sort({ startDate: 1 });

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

// FIX 4: One-time fix for already broken orders in database
// This function finds orders stuck as pending where startDate <= today
// and activates them if user has no other active order
const fixStuckOrders = async () => {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    console.log('🔧 Running fixStuckOrders...');

    // Find orders stuck as pending where startDate <= today
    const stuckOrders = await Order.find({
      status: 'pending',
      startDate: { $lte: now }
    });

    console.log(`📋 Found ${stuckOrders.length} stuck orders to check`);

    for (const order of stuckOrders) {
      try {
        // Check if user already has an active order
        const hasActive = await Order.findOne({
          userId: order.userId,
          status: 'active',
          endDate: { $gte: now },
          _id: { $ne: order._id }
        });

        if (!hasActive) {
          // Activate this stuck order
          const startDate = new Date(now);
          const DURATION_MAP = { Weekly: 7, Monthly: 30, Trial: 1, Tiffin: 1 };
          const durationDays = DURATION_MAP[order.planType] ?? 7;
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + durationDays);

          order.status = 'active';
          order.startDate = startDate;
          order.endDate = endDate;
          await order.save();

          console.log('✅ Fixed stuck order:', order._id);
        }
      } catch (orderError) {
        console.error(`❌ Error fixing stuck order ${order._id}:`, orderError);
      }
    }

    console.log('✅ fixStuckOrders completed');
  } catch (error) {
    console.error('❌ fixStuckOrders error:', error);
  }
};

// API endpoint to manually trigger fixStuckOrders
const runFixStuckOrders = async (req, res) => {
  try {
    await fixStuckOrders();
    res.json({ message: 'Stuck orders fixed successfully' });
  } catch (error) {
    console.error('Error running fixStuckOrders:', error);
    res.status(500).json({ message: 'Error fixing stuck orders', error: error.message });
  }
};

// @desc    Extend subscription (create pending order)
// @route   POST /api/orders/extend
const extendSubscriptionOrder = async (req, res) => {
  console.log('=== EXTEND SUBSCRIPTION API CALLED ===');
  console.log('userId:', req.user._id);
  console.log('vendorId:', req.body?.vendorId);
  console.log('planType:', req.body?.plan);
  console.log('timestamp:', new Date().toISOString());
  console.log('=====================================');

  try {
    const userId = req.user._id;

    const pendingCount = await getPendingPlansCount(userId);
    if (pendingCount >= 3) {
      return res.status(400).json({
        message: 'You have reached the maximum limit of 3 upcoming plan extensions.'
      });
    }

    const { plan, vendorId, paymentMethod = 'Cash' } = req.body;

    if (!plan || !vendorId) {
      return res.status(400).json({ message: 'Plan and vendorId are required' });
    }

    let durationDays = 7;
    let planType = 'Weekly';
    let amount = 0;

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
        durationDays = 1;
        planType = 'Trial';
        amount = 80;
        break;
      default:
        return res.status(400).json({ message: 'Invalid plan type' });
    }

    // ✅ Dynamic pricing from VendorPricing (WEEKLY/MONTHLY) to avoid hardcoded amounts
    if (planType === 'Weekly' || planType === 'Monthly') {
      const pricingRecord = await VendorPricing.findOne({
        vendor_id: vendorId,
        plan_type: planType.toLowerCase(),
        is_active: true
      });

      if (!pricingRecord || pricingRecord.price <= 0) {
        return res.status(400).json({
          message: 'Pricing not configured for this vendor. Please contact support.'
        });
      }

      amount = pricingRecord.price;
    }

    // NOTE: ONEDAY/TRIAL amount is kept as existing behavior (₹80)


    // Duplicate check - prevent duplicate orders within 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const duplicateOrder = await Order.findOne({
      userId: userId,
      vendorId: vendorId,
      planType: planType,
      $or: [{ status: 'pending' }, { offerStatus: 'pending' }],
      createdAt: { $gte: thirtySecondsAgo }
    });

    if (duplicateOrder) {
      return res.status(409).json({ message: 'duplicate order detected' });
    }

    const existingPendingOrders = await Order.find({
      userId: userId,
      $or: [{ status: 'pending' }, { offerStatus: 'pending' }]
    }).sort({ scheduledEndDate: -1 });

    let scheduledStartDate;

    if (existingPendingOrders && existingPendingOrders.length > 0) {
      const lastScheduledEndDate = new Date(existingPendingOrders[0].scheduledEndDate);
      scheduledStartDate = new Date(lastScheduledEndDate.getTime() + 86400000);
    } else {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);

      const activeOrder = await Order.findOne({
        userId: userId,
        status: 'active',
        endDate: { $gte: now }
      });

      if (activeOrder && activeOrder.endDate) {
        const activeEnd = new Date(activeOrder.endDate);
        activeEnd.setUTCHours(0, 0, 0, 0);
        scheduledStartDate = new Date(activeEnd.getTime() + 86400000);
      } else {
        scheduledStartDate = new Date(now);
        scheduledStartDate.setUTCDate(scheduledStartDate.getUTCDate() + 1);
      }
    }

    const scheduledEndDate = new Date(scheduledStartDate.getTime() + durationDays * 86400000);

    const user = await User.findById(userId);
    const vendor = await Vendor.findById(vendorId);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const paymentStatus = paymentMethod === 'UPI' ? 'Paid' : 'Pending';

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

    console.log('=== EXTEND SUBSCRIPTION ORDER SAVED ===');
    console.log('orderId:', order._id);
    console.log('status:', order.status);
    console.log('scheduledStartDate:', order.scheduledStartDate);
    console.log('scheduledEndDate:', order.scheduledEndDate);
    console.log('=========================================');

    try {
      const emailSubject = 'MealSetu - Subscription Extended Successfully!';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #16a34a;">✅ Subscription Extended!</h1>
          <p>Dear ${user.name},</p>
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #16a34a;">
            <p><strong>Vendor:</strong> ${vendor.kitchenName}</p>
            <p><strong>Plan Type:</strong> ${planType}</p>
            <p><strong>Amount:</strong> ₹${amount}</p>
            <p><strong>Scheduled Start:</strong> ${scheduledStartDate.toLocaleDateString('en-IN')}</p>
            <p><strong>Scheduled End:</strong> ${scheduledEndDate.toLocaleDateString('en-IN')}</p>
            <p><strong>Duration:</strong> ${durationDays} days</p>
          </div>
          <hr/>
          <p style="color: #999; font-size: 12px;">Thank you for choosing MealSetu!</p>
        </div>
      `;
      await sendEmail(user.email, emailSubject, emailHtml);
    } catch (emailError) {
      console.error('Failed to send extension confirmation email:', emailError.message);
    }

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

// @desc    Check subscription payment status  
// @route   GET /api/users/orders/:orderId/payment-status
const checkSubscriptionPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate('vendorId', 'kitchenName upiId');
    if (!order) {
      return res.status(404).json({ paid: false, message: 'Order not found' });
    }

    const orderAgeSeconds = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 1000);

    // Timeout after 5 minutes (300 seconds)
    if (orderAgeSeconds > 300) {
      return res.json({ 
        paid: false, 
        timeout: true, 
        message: 'Payment not received. Please try again.' 
      });
    }

    // Verified by webhook or admin action
    if (order.paymentStatus === 'Verified') {
      return res.json({ paid: true, message: 'Payment verified' });
    }

    // Still within the 5-minute window — awaiting real payment confirmation
    return res.json({
      paid: false,
      timeout: false,
      message: 'Awaiting payment...'
    });

  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getVendorPricingForUser = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId)
      .select('kitchenName upiId');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const pricingRecords = await VendorPricing.find({
      vendor_id: vendorId,
      is_active: true
    });

    const pricing = pricingRecords
      .filter(p => p.price > 0)
      .map(p => ({ type: p.plan_type, price: p.price }));

    res.json({
      vendorId: vendor._id,
      vendorName: vendor.kitchenName,
      upiId: vendor.upiId || null,
      pricing
    });
  } catch (error) {
    console.error('Get vendor pricing error:', error);
    res.status(500).json({
      message: 'Error fetching vendor pricing',
      error: error.message
    });
  }
};

// @desc    Create Razorpay order for subscription payment
// @route   POST /api/users/payment/create-order
const createRazorpayOrder = async (req, res) => {
  try {
    const razorpay = require('../utils/razorpayUtils');
    const { amount, vendorId, plan, mealPreference } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `r_${Date.now()}`,
      notes: {
        userId:         req.user._id.toString(),
        vendorId:       vendorId,
        plan:           plan,
        mealPreference: mealPreference || 'Regular'
      }
    });

    res.json({
      orderId:  razorpayOrder.id,
      amount:   razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId:    process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ message: 'Payment initiation failed', error: error.message });
  }
};

// @desc    Verify Razorpay payment + activate subscription
// @route   POST /api/users/payment/verify
const verifyUserPayment = async (req, res) => {
  try {
    const crypto = require('crypto');
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      vendorId,
      plan,
      amount,
      mealPreference,
      deliverySlot
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    const PLAN_MAP = {
      'ONEDAY':  'Trial',   'Trial':   'Trial',   'trial':   'Trial',
      'WEEKLY':  'Weekly',  'Weekly':  'Weekly',  'weekly':  'Weekly',
      'MONTHLY': 'Monthly', 'Monthly': 'Monthly', 'monthly': 'Monthly'
    };
    const planType     = PLAN_MAP[plan] || 'Trial';
    const durationDays = getPlanDurationDays(planType);
    const { startDate, endDate } = computeSubscriptionDates(durationDays);

    const user   = await User.findById(req.user._id);
    const vendor = await Vendor.findById(vendorId);
    if (!user)   return res.status(404).json({ message: 'User not found' });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // Check for existing active order — new plan queues behind it
    const existingActiveOrder = await Order.findOne({
      userId:  req.user._id,
      status:  'active',
      endDate: { $gte: new Date() }
    });

    const lastPendingOrder = await Order.findOne({
      userId:  req.user._id,
      status:  'pending'
    }).sort({ endDate: -1 });

    const chainFromOrder = lastPendingOrder || existingActiveOrder;
    const orderStatus = existingActiveOrder ? 'pending' : 'active';

    let orderStartDate = startDate;
    let orderEndDate   = endDate;

    if (chainFromOrder) {
      const chainEnd   = new Date(chainFromOrder.endDate);
      chainEnd.setUTCHours(0, 0, 0, 0);
      orderStartDate   = new Date(chainEnd.getTime() + 86400000);
      orderEndDate     = new Date(orderStartDate);
      orderEndDate.setUTCDate(orderEndDate.getUTCDate() + durationDays);
    }

    const order = await Order.create({
      userId:             req.user._id,
      vendorId,
      amount:             Number(amount),
      deliverySlot:       deliverySlot || 'Lunch',
      mealPreference:     mealPreference || 'Regular',
      paymentStatus:      'Paid',
      paymentMethod:      'UPI',
      transactionId:      razorpay_payment_id,
      planType,
      status:             orderStatus,
      startDate:          orderStartDate,
      endDate:            orderEndDate,
      scheduledStartDate: orderStatus === 'pending' ? orderStartDate : null,
      scheduledEndDate:   orderStatus === 'pending' ? orderEndDate   : null
    });

    if (orderStatus === 'active') {
      await Subscription.create({
        userId:       req.user._id,
        vendorId,
        planType,
        startDate:    orderStartDate,
        expiryDate:   orderEndDate,
        status:       'active',
        customerName: user.name,
        contact:      user.phone
      });
      user.expiryDate = orderEndDate;
      await user.save();
    }

    try {
      const isQueued = orderStatus === 'pending';
      const slotInfo = !isQueued ? getMealSlotInfo(orderStartDate, new Date()) : null;
      const endFormatted = new Date(orderEndDate).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const startFormatted = new Date(orderStartDate).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      await sendEmail(
        user.email,
        `MealSetu — ${planType} Plan ${isQueued ? 'Queued' : 'Activated'}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#f26522;padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:22px">✅ Payment Successful!</h1>
          </div>
          <div style="padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
            <p>Dear ${user.name},</p>
            <p>Your <strong>${planType}</strong> plan from <strong>${vendor.kitchenName}</strong> is confirmed.</p>
            ${isQueued
              ? `<div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:16px;margin:16px 0">
                   <p style="margin:0 0 4px 0;font-weight:700;color:#1d4ed8;font-size:15px">📅 Plan Queued</p>
                   <p style="margin:0;color:#374151;font-size:14px">Your plan will activate automatically on <strong>${startFormatted}</strong> after your current plan ends.</p>
                 </div>`
              : `<div style="background:${slotInfo.badgeBg};border-left:4px solid ${slotInfo.badgeColor};border-radius:8px;padding:16px;margin:16px 0">
                   <p style="margin:0 0 6px 0;font-weight:700;color:${slotInfo.badgeColor};font-size:16px">${slotInfo.slotLabel}</p>
                   <p style="margin:0 0 4px 0;color:#374151;font-size:14px">${slotInfo.startMessage}</p>
                   <p style="margin:0;color:#64748b;font-size:13px">${slotInfo.mealMessage}</p>
                 </div>`
            }
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Plan</td>
                <td style="padding:10px 14px;color:#64748b">${planType}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#374151">Kitchen</td>
                <td style="padding:10px 14px;color:#64748b">${vendor.kitchenName}</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Valid Until</td>
                <td style="padding:10px 14px;color:#64748b">${endFormatted}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#374151">Amount Paid</td>
                <td style="padding:10px 14px;color:#64748b">₹${amount}</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;font-weight:600;color:#374151">Transaction ID</td>
                <td style="padding:10px 14px;color:#64748b">${razorpay_payment_id}</td>
              </tr>
            </table>
            <p style="color:#64748b;font-size:13px;text-align:center;margin-top:20px">Thank you for choosing MealSetu!</p>
          </div>
        </div>`
      );
    } catch (emailErr) {
      console.error('Email failed:', emailErr.message);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('subscription_updated', {
        type: 'payment_success',
        planType,
        message: orderStatus === 'pending'
          ? `${planType} plan queued after your current subscription.`
          : `Your ${planType} subscription is now active!`
      });
      io.to(`vendor_${vendorId}`).emit('new_order', {
        type: 'new_subscription',
        message: 'New subscription order received'
      });
    }

    res.json({
      success:       true,
      message:       orderStatus === 'pending'
        ? 'Payment successful! Plan queued after your current subscription.'
        : 'Payment successful! Subscription activated.',
      order,
      planType,
      isQueued:      orderStatus === 'pending',
      transactionId: razorpay_payment_id
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};

const checkCanAddPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const activeOrder = await Order.findOne({
      userId,
      status: 'active',
      endDate: { $gte: now }
    });

    if (!activeOrder) {
      return res.json({ canPurchase: true, reason: 'no_active_plan' });
    }

    const pendingCount = await Order.countDocuments({
      userId,
      $or: [{ status: 'pending' }, { offerStatus: 'pending' }]
    });

    if (pendingCount >= 3) {
      const earliestPlan = await Order.findOne({
        userId,
        status: 'pending'
      }).sort({ startDate: 1 });

      const earliestExpiry = earliestPlan
        ? earliestPlan.startDate.toISOString().split('T')[0]
        : null;

      return res.json({
        canPurchase: false,
        reason: 'limit_reached',
        message: earliestExpiry
          ? `You already have 3 upcoming plans. Your earliest plan starts on ${earliestExpiry}. Wait for a plan to expire before adding more.`
          : 'You have reached the maximum limit of 3 upcoming plan extensions. Wait for a plan to expire before adding more.',
        earliestExpiry
      });
    }

    return res.json({
      canPurchase: true,
      reason: 'has_active_plan',
      pendingCount,
      remaining: 3 - pendingCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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
  getVendorsByPincode,
  checkReviewEligibility,
  getTrialEligibility,
  createTrialOrder,
  getMyCashPayments,
  getMySubscription,
  getUpcomingOrders,
  extendSubscriptionOrder,
  checkSubscriptionPaymentStatus,
  getVendorPricingForUser,
  fixStuckOrders,
  runFixStuckOrders,
  createRazorpayOrder,
  verifyUserPayment,
  checkCanAddPlan
};
