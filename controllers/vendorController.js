const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Subscription = require('../models/Subscription');
const Payout = require('../models/Payout');
const nodemailer = require('nodemailer');

// Helper function to transform profilePic path to full URL
const transformProfilePic = (profilePic, req) => {
  if (!profilePic) return null;
  
  // If already a full URL, return as is
  if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
    return profilePic;
  }
  
  // Use dynamic protocol and host from request - works in both dev and production
  const backendUrl = `${req.protocol}://${req.get('host')}`;
  
  // Remove any double slashes
  let cleanPath = profilePic.replace(/\/+/g, '/');
  
  // If path starts with /uploads, prepend backend URL
  if (cleanPath.startsWith('/uploads/')) {
    return `${backendUrl}${cleanPath}`;
  }
  
  // For any other relative path, assume it's in uploads folder
  return `${backendUrl}/uploads/${cleanPath.replace(/^\/?uploads\//, '')}`;
};

// Helper function to transform kitchenPoster path to full URL (same as profilePic)
const transformKitchenPoster = (kitchenPoster, req) => {
  if (!kitchenPoster) return null;
  
  // If already a full URL, return as is
  if (kitchenPoster.startsWith('http://') || kitchenPoster.startsWith('https://')) {
    return kitchenPoster;
  }
  
  // Use dynamic protocol and host from request
  const backendUrl = `${req.protocol}://${req.get('host')}`;
  
  // Remove any double slashes
  let cleanPath = kitchenPoster.replace(/\/+/g, '/');
  
  // If path starts with /uploads, prepend backend URL
  if (cleanPath.startsWith('/uploads/')) {
    return `${backendUrl}${cleanPath}`;
  }
  
  // For any other relative path, assume it's in uploads folder
  return `${backendUrl}/uploads/${cleanPath.replace(/^\/?uploads\//, '')}`;
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
    // Don't throw - email failure shouldn't break the main flow
  }
};

// @desc    Get vendor profile
// @route   GET /api/vendor/me
const getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id }).populate('ownerId', '-password');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    
    // Transform profileImage and kitchenPoster to full URL
    const vendorObj = vendor.toObject();
    vendorObj.profileImage = transformProfilePic(vendor.profileImage, req);
    vendorObj.kitchenPoster = transformKitchenPoster(vendor.kitchenPoster, req);
    
    res.json(vendorObj);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update vendor profile
// @route   PUT /api/vendor/me
const updateVendorProfile = async (req, res) => {
  try {
    const { kitchenName, address, pincode, phone } = req.body;
    const vendor = await Vendor.findOne({ ownerId: req.user._id });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    vendor.kitchenName = kitchenName || vendor.kitchenName;
    vendor.address = address || vendor.address;
    vendor.pincode = pincode || vendor.pincode;
    await vendor.save();

    // Also update user phone if provided
    if (phone) {
      await User.findByIdAndUpdate(req.user._id, { phone });
    }

    // Transform vendor to object and add profileImage with full URL
    const vendorObj = vendor.toObject();
    vendorObj.profileImage = transformProfilePic(vendor.profileImage, req);

    res.json(vendorObj);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get vendor menus
// @route   GET /api/vendor/menus
const getVendorMenus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    const menus = await Menu.find({ vendorId: vendor._id }).sort({ date: -1 });
    res.json(menus);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get vendor customers (unique users who ordered from this vendor) with total order count
// @route   GET /api/vendor/customers
const getVendorCustomers = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    // Use MongoDB aggregation to get unique customers with their total order counts
    const customerAggregation = await Order.aggregate([
      { $match: { vendorId: vendor._id } },
      {
        $group: {
          _id: '$userId',
          totalOrders: { $sum: 1 },
          customerName: { $first: '$customerName' }
        }
      },
      { $match: { _id: { $ne: null } } }
    ]);

    // Populate user details for each customer
    const customerIds = customerAggregation.map(c => c._id);
    const users = await User.find({ _id: { $in: customerIds } }).select('name email phone');
    
    // Map the aggregation results with populated user data
    const customers = customerAggregation.map(c => {
      const user = users.find(u => u._id.toString() === c._id.toString());
      return {
        _id: c._id,
        name: user?.name || c.customerName || 'Unknown',
        email: user?.email || '',
        phone: user?.phone || '',
        totalOrders: c.totalOrders
      };
    });

    res.json(customers);
  } catch (error) {
    console.error('Error fetching vendor customers:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get vendor complaints
// @route   GET /api/vendor/complaints
const getVendorComplaints = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const complaints = await Complaint.find({ vendorId: vendor._id }).populate('userId', 'name email').sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Respond / resolve a complaint
// @route   PUT /api/vendor/complaints/:id
const resolveComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    complaint.status = req.body.status || complaint.status;
    if (req.body.response) complaint.response = req.body.response;
    await complaint.save();
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Generate simple reports (orders count, earnings per day)
// @route   GET /api/vendor/reports
const getVendorReports = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    // Aggregate orders by date
    const agg = await Order.aggregate([
      { $match: { vendorId: vendor._id } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: '$orderDate' } }, totalOrders: { $sum: 1 }, totalEarnings: { $sum: '$amount' } } },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    res.json(agg.map(a => ({ date: a._id, orders: a.totalOrders, earnings: a.totalEarnings })));
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Vendor Reviews
// @route   GET /api/vendor/reviews
const getVendorReviews = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    
    // Fetch reviews with user info populated
    const reviews = await Review.find({ vendorId: vendor._id })
      .populate('userId', 'name')
      .sort({ rating: -1, createdAt: -1 }); // Sentiment-Based Priority: 5-star first, then 4-star, etc.

    // Format reviews for vendor display with all required fields
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
      createdAt: review.createdAt,
      orderId: review.orderId
    }));

    // Calculate average rating for vendor
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = reviews.length > 0 ? Math.round((totalRating / reviews.length) * 10) / 10 : 0;

    res.json({
      reviews: formattedReviews,
      averageRating: avgRating,
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Get vendor reviews error:', error);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

// @desc    Add a Daily Menu
// @route   POST /api/vendor/menu
const addMenu = async (req, res) => {
  try {
    // Ensure the logged-in user is actually a vendor owner
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const newMenu = await Menu.create({
      vendorId: vendor._id,
      ...req.body // date, mainSabji, altSabji, etc.
    });

    res.status(201).json(newMenu);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Vendor Orders
// @route   GET /api/vendor/orders
const getVendorOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    const orders = await Order.find({ vendorId: vendor._id }).populate('userId', 'name phone');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Vendor Orders with Date Filter (for PDF Report)
// @route   GET /api/vendor/orders/filtered
const getFilteredOrders = async (req, res) => {
  try {
    const { filter } = req.query; // 'daily', 'weekly', 'monthly'
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const now = new Date();
    let startDate;

    // Calculate start date based on filter
    if (filter === 'daily') {
      // Today's orders
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (filter === 'weekly') {
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'monthly') {
      // Last 30 days
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // No filter - return all orders
      startDate = new Date(0);
    }

    const orders = await Order.find({
      vendorId: vendor._id,
      orderDate: { $gte: startDate }
    })
      .populate('userId', 'name')
      .sort({ orderDate: -1 });

    // Format orders for PDF report with proper fallbacks - all dynamic fields
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order._id,
      username: order.userId?.name || order.customerName || 'Unknown',
      customerName: order.customerName || order.userId?.name || 'Unknown',
      amount: Number(order.amount) || 0,
      paymentMethod: order.paymentMethod || 'Cash', // Dynamic: shows user's actual selection
      planType: order.planType || 'Trial', // Dynamic: Trial, Monthly, Weekly based on user choice
      mealPreference: order.mealPreference || 'Regular', // Dynamic: Regular or Jain
      deliverySlot: order.deliverySlot || 'Lunch',
      orderDate: order.orderDate,
      paymentStatus: order.paymentStatus || 'Pending',
      transactionId: order.transactionId || 'N/A'
    }));

    res.json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update Order Status (e.g. to 'Delivered')
// @route   PUT /api/vendor/orders/:id
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.orderStatus = req.body.status;
    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Dashboard Stats (Total Revenue, Today's Orders, Active Subscribers, Payment Breakdown)
// @route   GET /api/vendor/dashboard-stats
const getDashboardStats = async (req, res) => {
  try {
    // First get the vendor ID
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    // Get start and end of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // MongoDB aggregation for Total Revenue (sum of all order amounts)
    const revenueAggregation = await Order.aggregate([
      { $match: { vendorId: vendor._id } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

    // MongoDB aggregation for Today's Orders (count of orders with today's date)
    const todayOrdersAggregation = await Order.aggregate([
      { 
        $match: { 
          vendorId: vendor._id,
          orderDate: { $gte: today, $lt: tomorrow }
        } 
      },
      { $count: 'todayOrders' }
    ]);
    const todayOrders = todayOrdersAggregation.length > 0 ? todayOrdersAggregation[0].todayOrders : 0;

    // MongoDB aggregation for Active Subscribers (subscriptions with status 'active')
    const activeSubscribersAggregation = await Subscription.aggregate([
      { 
        $match: { 
          vendorId: vendor._id,
          status: 'active'
        } 
      },
      { $count: 'activeSubscribers' }
    ]);
    const activeSubscribers = activeSubscribersAggregation.length > 0 ? activeSubscribersAggregation[0].activeSubscribers : 0;

    // Also get pending payout from Payout collection
    const pendingPayoutAggregation = await Payout.aggregate([
      { 
        $match: { 
          vendorId: vendor._id,
          status: 'Pending'
        } 
      },
      { $group: { _id: null, totalPending: { $sum: '$totalEarning' } } }
    ]);
    const pendingPayout = pendingPayoutAggregation.length > 0 ? pendingPayoutAggregation[0].totalPending : 0;

    // NEW: Get Cash Payments breakdown (amount + count)
    const cashPaymentsAggregation = await Order.aggregate([
      { 
        $match: { 
          vendorId: vendor._id,
          paymentMethod: 'Cash'
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalCashAmount: { $sum: '$amount' },
          cashCount: { $sum: 1 }
        } 
      }
    ]);
    const cashPaymentsTotal = cashPaymentsAggregation.length > 0 ? cashPaymentsAggregation[0].totalCashAmount : 0;
    const cashPaymentsCount = cashPaymentsAggregation.length > 0 ? cashPaymentsAggregation[0].cashCount : 0;

    // NEW: Get UPI Payments breakdown (amount + count)
    const upiPaymentsAggregation = await Order.aggregate([
      { 
        $match: { 
          vendorId: vendor._id,
          paymentMethod: 'UPI'
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalUPIAmount: { $sum: '$amount' },
          upiCount: { $sum: 1 }
        } 
      }
    ]);
    const upiPaymentsTotal = upiPaymentsAggregation.length > 0 ? upiPaymentsAggregation[0].totalUPIAmount : 0;
    const upiPaymentsCount = upiPaymentsAggregation.length > 0 ? upiPaymentsAggregation[0].upiCount : 0;

    res.json({
      totalRevenue,
      todayOrders,
      activeSubscribers,
      pendingPayout,
      cashPaymentsTotal,
      cashPaymentsCount,
      upiPaymentsTotal,
      upiPaymentsCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Save Weekly Menu Plan (Batch Save for all 7 days)
// @route   PUT /api/vendor/weekly-plan
const saveWeeklyPlan = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const { weeklyPlan } = req.body;
    
    // Validate the weeklyPlan structure
    if (!weeklyPlan || typeof weeklyPlan !== 'object') {
      return res.status(400).json({ message: 'Invalid weekly plan format' });
    }

    // Update vendor's weeklyPlan
    vendor.weeklyPlan = weeklyPlan;
    await vendor.save();

    res.json({ 
      message: 'Weekly plan saved successfully', 
      weeklyPlan: vendor.weeklyPlan 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Weekly Menu Plan
// @route   GET /api/vendor/weekly-plan
const getWeeklyPlan = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    res.json({ weeklyPlan: vendor.weeklyPlan });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Vendor's Weekly Plan (Public - for users to view)
// @route   GET /api/vendors/:vendorId/weekly-plan
const getVendorWeeklyPlan = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findById(vendorId);
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({ 
      weeklyPlan: vendor.weeklyPlan,
      kitchenName: vendor.kitchenName 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Shop Status (Open/Close)
// @route   GET /api/vendor/shop-status
const getShopStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    res.json({
      isOpen: vendor.isOpen,
      closureStartDate: vendor.closureStartDate,
      closureEndDate: vendor.closureEndDate
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Toggle Shop Status (Open/Close) - Also extends user subscriptions when reopening
// @route   PUT /api/vendor/shop-status
const toggleShopStatus = async (req, res) => {
  try {
    const { isOpen, closureEndDate } = req.body;
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const previousStatus = vendor.isOpen;
    vendor.isOpen = isOpen;

    if (isOpen === false) {
      // Closing the shop - record the closure start date
      vendor.closureStartDate = new Date();
      vendor.closureEndDate = closureEndDate ? new Date(closureEndDate) : null;
      await vendor.save();

      // Send email notification to all active subscribers about the closure
      try {
        const activeSubscriptions = await Subscription.find({
          vendorId: vendor._id,
          status: 'active'
        }).populate('userId', 'email name');

        // Get unique user emails
        const userEmails = new Map();
        activeSubscriptions.forEach(sub => {
          if (sub.userId && sub.userId.email) {
            userEmails.set(sub.userId._id.toString(), sub.userId);
          }
        });

        // Send closure notification email to each user
        for (const [_, user] of userEmails) {
          const closureEmailSubject = `MealSetu - ${vendor.kitchenName} is Temporarily Closed`;
          const closureEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #f26522;">Kitchen Temporarily Closed</h1>
              <p>Dear ${user.name},</p>
              <p>We regret to inform you that <strong>${vendor.kitchenName}</strong> is temporarily closed.</p>
              <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
                <p><strong>Kitchen:</strong> ${vendor.kitchenName}</p>
                <p><strong>Closed At:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Reason:</strong> Temporary Service Interruption</p>
              </div>
              <p>Your subscription has been paused during this period. When the kitchen reopens, your subscription will be automatically extended to compensate for the downtime.</p>
              <p>We apologize for any inconvenience caused. Thank you for your patience and support!</p>
              <hr/>
              <p style="color: #999; font-size: 12px;">MealSetu - Quality Food, Delivered with Care</p>
            </div>
          `;
          await sendEmail(user.email, closureEmailSubject, closureEmailHtml);
        }
      } catch (emailError) {
        console.error('Failed to send closure notification emails:', emailError);
        // Don't fail the request if email fails
      }

      return res.json({
        message: 'Kitchen closed successfully',
        isOpen: vendor.isOpen,
        closureStartDate: vendor.closureStartDate,
        closureEndDate: vendor.closureEndDate,
        subscriptionsExtended: 0
      });
    } else if (isOpen === true && previousStatus === false) {
      // Re-opening the shop - calculate closure duration and extend subscriptions
      if (!vendor.closureStartDate) {
        // No closure recorded, just reopen
        vendor.isOpen = true;
        vendor.closureStartDate = null;
        vendor.closureEndDate = null;
        await vendor.save();
        
        return res.json({
          message: 'Kitchen opened successfully',
          isOpen: vendor.isOpen,
          subscriptionsExtended: 0
        });
      }

      const closureStart = new Date(vendor.closureStartDate);
      const closureEnd = new Date();
      const diffTime = Math.abs(closureEnd - closureStart);
      const closureDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Extend subscriptions only if shop was closed for at least 1 day
      let subscriptionsExtended = 0;
      const extendedSubscriptions = [];
      
      if (closureDays >= 1) {
        // Find all active subscriptions for this vendor
        const activeSubscriptions = await Subscription.find({
          vendorId: vendor._id,
          status: 'active'
        }).populate('userId', 'email name');

        // Extend each subscription
        for (const subscription of activeSubscriptions) {
          const currentExpiry = new Date(subscription.expiryDate);
          const now = new Date();
          const previousExpiry = new Date(currentExpiry);
          
          // Only extend if subscription hasn't expired
          if (currentExpiry > now) {
            currentExpiry.setDate(currentExpiry.getDate() + closureDays);
            subscription.expiryDate = currentExpiry;
            await subscription.save();
            subscriptionsExtended++;
            
            // Store user info for email
            if (subscription.userId) {
              extendedSubscriptions.push({
                user: subscription.userId,
                previousExpiry: previousExpiry.toLocaleDateString(),
                newExpiry: currentExpiry.toLocaleDateString()
              });
            }
          }
        }

        // Send reopening notification emails with new expiry dates
        try {
          for (const extSub of extendedSubscriptions) {
            const reopenEmailSubject = `MealSetu - ${vendor.kitchenName} is Back in Service!`;
            const reopenEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #16a34a;">Great News! Kitchen is Back!</h1>
                <p>Dear ${extSub.user.name},</p>
                <p>We are happy to inform you that <strong>${vendor.kitchenName}</strong> is now back in service!</p>
                <div style="background-color: #dcfce7; padding: 20px; margin: 20px 0; border-radius: 10px;">
                  <p><strong>🎉 Kitchen Reopened:</strong> ${vendor.kitchenName}</p>
                  <p><strong>📅 Downtime Duration:</strong> ${closureDays} day(s)</p>
                  <hr style="border-color: #86efac; margin: 15px 0;"/>
                  <p style="color: #166534;"><strong>Your Subscription Has Been Extended!</strong></p>
                  <p><strong>Previous Expiry:</strong> ${extSub.previousExpiry}</p>
                  <p><strong style="color: #16a34a; font-size: 18px;">New Expiry Date: ${extSub.newExpiry}</strong></p>
                </div>
                <p>Your subscription has been automatically extended by <strong>${closureDays} day(s)</strong> to compensate for the temporary service interruption.</p>
                <p>You can now place your meal orders. Thank you for your patience and continued support!</p>
                <hr/>
                <p style="color: #999; font-size: 12px;">MealSetu - Quality Food, Delivered with Care</p>
              </div>
            `;
            await sendEmail(extSub.user.email, reopenEmailSubject, reopenEmailHtml);
          }
        } catch (emailError) {
          console.error('Failed to send reopening notification emails:', emailError);
          // Don't fail the request if email fails
        }
      }

      // Clear closure data
      vendor.closureStartDate = null;
      vendor.closureEndDate = null;
      await vendor.save();

      return res.json({
        message: `Kitchen opened successfully! ${subscriptionsExtended > 0 ? `${subscriptionsExtended} subscription(s) extended by ${closureDays} day(s)` : ''}`,
        isOpen: vendor.isOpen,
        closureDays: closureDays,
        subscriptionsExtended: subscriptionsExtended
      });
    } else {
      // No change in status
      await vendor.save();
      return res.json({
        message: 'Kitchen status unchanged',
        isOpen: vendor.isOpen
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update vendor profile picture
// @route   PUT /api/vendor/me/profile-pic
const updateVendorProfilePic = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    // Update the profileImage field with the file path
    vendor.profileImage = `/uploads/${req.file.filename}`;
    await vendor.save();

    // Return full URL for the profile image
    const profileImageUrl = transformProfilePic(vendor.profileImage, req);

    res.json({
      message: 'Profile picture updated successfully',
      profileImage: profileImageUrl
    });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update vendor kitchen poster/banner
// @route   PUT /api/vendor/me/kitchen-poster
const updateKitchenPoster = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    // Update the kitchenPoster field with the file path
    vendor.kitchenPoster = `/uploads/${req.file.filename}`;
    await vendor.save();

    // Return full URL for the kitchen poster
    const kitchenPosterUrl = transformKitchenPoster(vendor.kitchenPoster, req);

    res.json({
      message: 'Kitchen poster updated successfully',
      kitchenPoster: kitchenPosterUrl
    });
  } catch (error) {
    console.error('Error updating kitchen poster:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getVendorProfile,
  updateVendorProfile,
  updateVendorProfilePic,
  updateKitchenPoster,
  getVendorMenus,
  addMenu,
  getVendorOrders,
  getFilteredOrders,
  updateOrderStatus,
  getVendorReviews,
  getVendorCustomers,
  getVendorComplaints,
  resolveComplaint,
  getVendorReports,
  getDashboardStats,
  saveWeeklyPlan,
  getWeeklyPlan,
  getVendorWeeklyPlan,
  toggleShopStatus,
  getShopStatus
};
