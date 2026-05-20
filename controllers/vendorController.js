const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Subscription = require('../models/Subscription');
const Payout = require('../models/Payout');
const Commission = require('../models/Commission');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { computeSubscriptionDates, getPlanDurationDays } = require('../utils/mealTimingUtils');
const { calculateMissedMeals, calculatePlannedClosureMeals } = require('../utils/mealSlotCalculator');

const VendorPricing = require('../models/VendorPricing');
const CommissionSetting = require('../models/CommissionSetting');
const JainMenu = require('../models/JainMenu');
const { sendEmail } = require('../utils/emailUtils');

// Helper function to transform profilePic path to full URL
const transformProfilePic = (profilePic, req) => {
  if (!profilePic) return null;
  if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
    return profilePic;
  }
  const backendUrl = `${req.protocol}://${req.get('host')}`;
  let cleanPath = profilePic.replace(/\/+/g, '/');
  if (cleanPath.startsWith('/uploads/')) {
    return `${backendUrl}${cleanPath}`;
  }
  return `${backendUrl}/uploads/${cleanPath.replace(/^\/?uploads\//, '')}`;
};

// Helper function to transform kitchenPoster path to full URL
const transformKitchenPoster = (kitchenPoster, req) => {
  if (!kitchenPoster) return null;
  if (kitchenPoster.startsWith('http://') || kitchenPoster.startsWith('https://')) {
    return kitchenPoster;
  }
  const backendUrl = `${req.protocol}://${req.get('host')}`;
  let cleanPath = kitchenPoster.replace(/\/+/g, '/');
  if (cleanPath.startsWith('/uploads/')) {
    return `${backendUrl}${cleanPath}`;
  }
  return `${backendUrl}/uploads/${cleanPath.replace(/^\/?uploads\//, '')}`;
};

// @desc    Get vendor profile
// @route   GET /api/vendor/me
const getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id })
      .populate('ownerId', '-password');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
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
    const { kitchenName, address, pincode, phone, upiId } = req.body;
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    vendor.kitchenName = kitchenName || vendor.kitchenName;
    vendor.address = address || vendor.address;
    vendor.pincode = pincode || vendor.pincode;
    vendor.upiId = upiId || vendor.upiId;
    
    // Auto-geocode address to lat/lng using Nominatim
    if (address && pincode) {
      try {
        const fullAddress = `${address}, ${pincode}, India`;
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullAddress)}&format=json&limit=1`,
          {
            headers: { 
              'User-Agent': 'MealSetu/1.0'
            }
          }
        );
        const geoData = await geoRes.json();
        if (geoData && geoData[0]) {
          vendor.latitude = parseFloat(geoData[0].lat);
          vendor.longitude = parseFloat(geoData[0].lon);
        }
      } catch (geoError) {
        console.log('Geocoding failed, continuing without coordinates:', geoError.message);
        // Silently fail - set null (default)
      }
    }
    
    await vendor.save();
    if (phone) {
      await User.findByIdAndUpdate(req.user._id, { phone });
    }
    const vendorObj = vendor.toObject();
    vendorObj.profileImage = transformProfilePic(vendor.profileImage, req);
    vendorObj.kitchenPoster = transformKitchenPoster(vendor.kitchenPoster, req);
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

// @desc    Get vendor customers
// @route   GET /api/vendor/customers
const getVendorCustomers = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const customerAggregation = await Order.aggregate([
      { $match: { vendorId: vendor._id, userId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$userId',
          totalOrders: { $sum: 1 },
          customerName: { $first: '$customerName' }
        }
      },
      { $match: { _id: { $ne: null } } }
    ]);

    const customerIds = customerAggregation.map(c => c._id);
    const users = await User.find({ _id: { $in: customerIds } })
      .select('name email phone');

    const customers = customerAggregation
      .map(c => {
        const user = users.find(u => u._id.toString() === c._id?.toString());
        if (!user) return null;
        return {
          _id: c._id,
          name: user.name || c.customerName || 'Unknown',
          email: user.email || '',
          phone: user.phone || '',
          totalOrders: c.totalOrders,
          isManual: false
        };
      })
      .filter(Boolean);

    // Manual customers: group by phone to deduplicate legacy fake-userId orders
    const manualOrders = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          isManualOrder: true,
          manualCustomerPhone: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$manualCustomerPhone',
          name: { $first: '$manualCustomerName' },
          phone: { $first: '$manualCustomerPhone' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    manualOrders.forEach(mo => {
      const alreadyExists = customers.some(
        c => c.phone?.replace(/\D/g, '') === mo.phone?.replace(/\D/g, '')
      );
      if (!alreadyExists) {
        customers.push({
          _id: `manual_${mo._id}`,
          name: mo.name || 'Offline Customer',
          email: '—',
          phone: mo.phone,
          totalOrders: mo.totalOrders,
          isManual: true
        });
      }
    });

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get vendor complaints
// @route   GET /api/vendor/complaints
const getVendorComplaints = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });
    const complaints = await Complaint.find({ vendorId: vendor._id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Resolve a complaint
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

// @desc    Generate reports
// @route   GET /api/vendor/reports
const getVendorReports = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const agg = await Order.aggregate([
      { $match: { vendorId: vendor._id } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: '$orderDate' } },
          totalOrders: { $sum: 1 },
          totalEarnings: { $sum: '$amount' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    res.json(agg.map(a => ({
      date: a._id,
      orders: a.totalOrders,
      earnings: a.totalEarnings
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Vendor Reviews
// @route   GET /api/vendor/reviews
const getVendorReviews = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    const reviews = await Review.find({ vendorId: vendor._id })
      .populate('userId', 'name')
      .sort({ rating: -1, createdAt: -1 });

    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      user: review.customerName || review.userId?.name || 'Anonymous',
      rating: review.rating,
      stars: review.rating,
      comment: review.comment,
      date: new Date(review.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      }),
      createdAt: review.createdAt,
      orderId: review.orderId
    }));

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = reviews.length > 0
      ? Math.round((totalRating / reviews.length) * 10) / 10
      : 0;

    res.json({
      reviews: formattedReviews,
      averageRating: avgRating,
      totalReviews: reviews.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

// @desc    Add a Daily Menu
// @route   POST /api/vendor/menu
const addMenu = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });
    const newMenu = await Menu.create({ vendorId: vendor._id, ...req.body });
    res.status(201).json(newMenu);
  } catch (error) {
    console.error('Pricing save error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Vendor Orders
// @route   GET /api/vendor/orders
const getVendorOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    const orders = await Order.find({ vendorId: vendor._id })
      .populate('userId', 'name phone email');
    
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      customerName:
        order.manualCustomerName
        || order.userId?.name
        || order.customerName
        || 'Unknown',
      phone:
        order.manualCustomerPhone
        || order.userId?.phone
        || 'N/A',
      mealPreference: order.mealPreference,
      orderDate: order.orderDate,
      planType: order.planType,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      isManualOrder: order.isManualOrder || false
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Vendor Orders with Date Filter
// @route   GET /api/vendor/orders/filtered
const getFilteredOrders = async (req, res) => {
  try {
    const { filter } = req.query;
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const now = new Date();
    let startDate;

    if (filter === 'daily') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (filter === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'monthly') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(0);
    }

    const orders = await Order.find({
      vendorId: vendor._id,
      orderDate: { $gte: startDate }
    }).populate('userId', 'name').sort({ orderDate: -1 });

    const formattedOrders = orders.map(order => {
      const resolvedName =
        order.manualCustomerName ||
        order.userId?.name ||
        order.customerName ||
        'Unknown';
      return {
      _id: order._id,
      orderId: order._id,
      username: resolvedName,
      customerName: resolvedName,
      amount: Number(order.amount) || 0,
      paymentMethod: order.paymentMethod || 'Cash',
      planType: order.planType || 'Trial',
      mealPreference: order.mealPreference || 'Regular',
      deliverySlot: order.deliverySlot || 'Lunch',
      orderDate: order.orderDate,
      paymentStatus: order.paymentStatus || 'Pending',
      transactionId: order.transactionId || 'N/A'
      };
    });

    res.json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update Order Status
// @route   PUT /api/vendor/orders/:id
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const previousStatus = order.orderStatus;
    order.orderStatus = req.body.status;
    await order.save();
    
    // Emit Socket.IO events for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Notify customer about order status change
      if (order.userId) {
        const customerId = order.userId.toString();
        io.to(customerId).emit('orderStatusUpdate', {
          orderId: order._id,
          status: order.orderStatus,
          previousStatus: previousStatus,
          message: getStatusUpdateMessage(order.orderStatus)
        });
      }
      
      // Notify admin about order update
      io.to('admin_room').emit('orderUpdate', {
        order: order,
        action: 'status_change',
        previousStatus: previousStatus
      });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// Helper function to get status update message
const getStatusUpdateMessage = (status) => {
  const messages = {
    'Preparing': 'Your order is being prepared!',
    'Ready': 'Your order is ready for pickup!',
    'Out for Delivery': 'Your order is out for delivery!',
    'Delivered': 'Your order has been delivered! Enjoy your meal!',
    'Cancelled': 'Your order has been cancelled.'
  };
  return messages[status] || `Order status updated to ${status}`;
};

// @desc    Get Dashboard Stats
// @route   GET /api/vendor/dashboard-stats
const getDashboardStats = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const revenueAgg = await Order.aggregate([
      { $match: { vendorId: vendor._id } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    const todayOrdersAgg = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          orderDate: { $gte: today, $lt: tomorrow }
        }
      },
      { $count: 'todayOrders' }
    ]);
    const todayOrders = todayOrdersAgg[0]?.todayOrders || 0;

    const activeSubscribersAgg = await Subscription.aggregate([
      { $match: { vendorId: vendor._id, status: 'active' } },
      { $count: 'activeSubscribers' }
    ]);
    const activeSubscribers = activeSubscribersAgg[0]?.activeSubscribers || 0;

    const pendingCommissions = await Commission.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: { $in: ['pending', 'overdue'] }
        }
      },
      { $group: { _id: null, totalPending: { $sum: '$commission_amount' } } }
    ]);
    const pendingPayout = pendingCommissions[0]?.totalPending || 0;

    const cashAgg = await Order.aggregate([
      { $match: { vendorId: vendor._id, paymentMethod: 'Cash' } },
      {
        $group: {
          _id: null,
          totalCashAmount: { $sum: '$amount' },
          cashCount: { $sum: 1 }
        }
      }
    ]);
    const cashPaymentsTotal = cashAgg[0]?.totalCashAmount || 0;
    const cashPaymentsCount = cashAgg[0]?.cashCount || 0;

    const upiAgg = await Order.aggregate([
      { $match: { vendorId: vendor._id, paymentMethod: 'UPI' } },
      {
        $group: {
          _id: null,
          totalUPIAmount: { $sum: '$amount' },
          upiCount: { $sum: 1 }
        }
      }
    ]);
    const upiPaymentsTotal = upiAgg[0]?.totalUPIAmount || 0;
    const upiPaymentsCount = upiAgg[0]?.upiCount || 0;

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

// @desc    Save Weekly Menu Plan
// @route   PUT /api/vendor/weekly-plan
const saveWeeklyPlan = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    const { weeklyPlan } = req.body;
    if (!weeklyPlan || typeof weeklyPlan !== 'object') {
      return res.status(400).json({ message: 'Invalid weekly plan format' });
    }
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

// NEW MANUAL CUSTOMER FUNCTIONS - ADDED
// @desc    Add Manual Customer
// @route   POST /api/vendor/manual-customer
const addManualCustomer = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const { name, phone, planType, startDate, paymentMethod, amount, deliveryPincode, mealPreference, deliverySlot } = req.body;

    const planTypeMapped = planType === 'trial' ? 'Trial' : planType === 'weekly' ? 'Weekly' : planType === 'monthly' ? 'Monthly' : 'Tiffin';

    const requestedStart = new Date(startDate);
    requestedStart.setUTCHours(0, 0, 0, 0);

    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

    let startDateObj, endDateObj;
    if (requestedStart.getTime() === todayMidnight.getTime()) {
      // Starting today — apply smart meal timing
      const computed = computeSubscriptionDates(getPlanDurationDays(planTypeMapped));
      startDateObj = computed.startDate;
      endDateObj   = computed.endDate;
    } else {
      // Future date — use exactly as requested, normal duration
      startDateObj = requestedStart;
      endDateObj = new Date(startDateObj);
      endDateObj.setUTCDate(endDateObj.getUTCDate() + getPlanDurationDays(planTypeMapped));
    }

    // STEP 1 — Find or create a real User for this manual customer
    let customerId;
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      customerId = existingUser._id;
    } else {
      const newUser = await User.create({
        name,
        phone,
        email: `offline_${phone}@mealsetu.internal`,
        password: await bcrypt.hash(Math.random().toString(36).slice(2), 10),
        role: 'user',
        address: deliveryPincode ? `Pincode: ${deliveryPincode}` : 'Offline Customer',
        pincode: deliveryPincode || '',
        isManualCustomer: true
      });
      customerId = newUser._id;
    }

    // STEP 2 — Create Order using the real userId
    const newOrder = new Order({
      userId: customerId,
      vendorId: vendor._id,
      customerName: name,
      manualCustomerName: name,
      manualCustomerPhone: phone,
      manualCustomerPincode: deliveryPincode,
      planType: planTypeMapped,
      startDate: startDateObj,
      endDate: endDateObj,
      status: 'active',
      amount: parseFloat(amount),
      paymentStatus: 'Paid',
      paymentMethod: paymentMethod || 'Cash',
      orderStatus: 'Delivered',
      mealPreference: mealPreference || 'Regular',
      deliverySlot: 'Lunch', // stored for schema compliance only; full-day plan
      source: 'manual',
      isManualOrder: true
    });

    await newOrder.save();

    res.status(201).json({
      message: 'Manual customer added successfully',
      order: newOrder
    });
  } catch (error) {
    console.error('Add manual customer error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Manual Customers
// @route   GET /api/vendor/manual-customers
const getManualCustomers = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const manualOrders = await Order.find({
      vendorId: vendor._id,
      isManualOrder: true
    }).sort({ createdAt: -1 }).select('-__v');

    res.json(manualOrders);
  } catch (error) {
    console.error('Get manual customers error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Calculate Manual Order Amount
// @route   GET /api/vendor/manual-customer/calculate
const calculateManualOrderAmount = async (req, res) => {
  try {
    const { planType, startDate } = req.query;
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    let days = 0;
    if (planType === 'trial') {
      // 🔥 BUG FIX: Trial uses trialFee OR daily plan price OR 80
      const dailyPricing = await VendorPricing.findOne({
        vendor_id: vendor._id,
        plan_type: 'daily',
        is_active: true
      });
      
      const trialPrice = vendor.trialFee || (dailyPricing?.price || 80);
      const source = vendor.trialFee ? 'trial_fee' : dailyPricing ? 'daily_plan' : 'default';
      
      console.log(`📊 Trial pricing for ${vendor.kitchenName}: trialFee=${vendor.trialFee}, daily=${dailyPricing?.price}, final=${trialPrice}, source=${source}`);
      
      res.json({ 
        amount: trialPrice,
        days: 2, // Standard 2-day trial
        dailyPrice: trialPrice,
        planType,
        vendorPrice: trialPrice,
        startDate,
        source,
        usesDailyPlan: !!dailyPricing
      });
      return;
    }
    else if (planType === 'monthly') days = 30;

    // ✅ PRIORITIZE VendorPricing collection (user-visible)
    const vendorPricingDoc = await VendorPricing.findOne({ 
      vendor_id: vendor._id, 
      plan_type: planType,
      is_active: true 
    });
    
    let planPricing = vendorPricingDoc ? {
      planType: vendorPricingDoc.plan_type,
      price: vendorPricingDoc.price,
      active: true
    } : null;
    
    // Fallback to Vendor.pricing array
    if (!planPricing) {
      const vendorPricingArray = Array.isArray(vendor.pricing) ? vendor.pricing : [];
      planPricing = vendorPricingArray.find(
        p => (p.planType === planType || p.type === planType) && p.active === true
      );
    }
    
  let price = planPricing?.price;

// ✅ If trial → use daily price
if (!price && planType === 'trial') {
  const dailyPlan = await VendorPricing.findOne({
    vendor_id: vendor._id,
    plan_type: { $regex: '^daily$', $options: 'i' },
    is_active: true
  });

  price = dailyPlan?.price;
}

// ✅ final fallback
if (!price) price = 80;
    const amount = price;

    res.json({ 
      amount,
      days,
      dailyPrice: Math.round(price / days),
      planType,
      vendorPrice: price,
      startDate,
      source: planPricing ? 'vendor_pricing' : 'default'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Jain Menu Settings
// @route   GET /api/vendor/jain-menu
const getJainMenu = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    res.json({
      offersJainMenu: vendor.offersJainMenu,
      jainWeeklyPlan: vendor.jainWeeklyPlan
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Save Jain Menu Settings (toggle + weekly plan)
// @route   POST /api/vendor/jain-menu
const saveJainMenu = async (req, res) => {
  try {
    console.log('saveJainMenu req.body:', JSON.stringify(req.body));
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    const { offersJainMenu, jainWeeklyPlan } = req.body;
    vendor.offersJainMenu = offersJainMenu !== undefined ? offersJainMenu : vendor.offersJainMenu;
    if (jainWeeklyPlan) {
      vendor.jainWeeklyPlan = jainWeeklyPlan;
      vendor.markModified('jainWeeklyPlan');
    }
    await vendor.save();

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    try {
      await JainMenu.deleteMany({ vendor_id: vendor._id });
      if (offersJainMenu && jainWeeklyPlan) {
        const jainMenuDocs = DAYS.map(day => ({
          vendor_id: vendor._id,
          day: day,
          main_course: jainWeeklyPlan[day]?.mainCourse || null,
          alt_sabji: jainWeeklyPlan[day]?.altSabji || null,
          alt_sabji2: jainWeeklyPlan[day]?.altSabji2 || null,
          sides: jainWeeklyPlan[day]?.sides || null,
          special_addons: jainWeeklyPlan[day]?.specialAddOns || null
        }));
        await JainMenu.insertMany(jainMenuDocs);
      }
    } catch (jainErr) {
      console.error('Failed to save JainMenu collection:', jainErr.message);
    }

    console.log('After save offersJainMenu:', vendor.offersJainMenu, 'Monday mainCourse:', vendor.jainWeeklyPlan?.Monday?.mainCourse);
    res.json({
      message: 'Jain menu saved successfully',
      offersJainMenu: vendor.offersJainMenu,
      jainWeeklyPlan: vendor.jainWeeklyPlan
    });
  } catch (error) {
    console.error('saveJainMenu error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Pricing Plans
// @route   GET /api/vendor/pricing
const getPricing = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });
    // Always return as array with planType field
    const pricing = (vendor.pricing || []).map(p => ({
      planType: p.planType,
      price: p.price,
      active: p.active
    }));
    res.json({ pricing });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Save Pricing Plans
// @route   POST /api/vendor/pricing
const savePricing = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    const { pricing } = req.body;

    // Validation 1: Every active plan must have price > 0
    const invalidPlans = pricing.filter(p => p.active && (!p.price || p.price <= 0));
    if (invalidPlans.length > 0) {
      return res.status(400).json({
        message: 'Active plans must have price > 0',
        invalidPlans: invalidPlans.map(p => ({ planType: p.planType, price: p.price }))
      });
    }

    // Validation 2: No duplicate plan types
    const types = pricing.map(p => p.planType);
    const duplicateTypes = types.filter((type, index) => types.indexOf(type) !== index);
    if (duplicateTypes.length > 0) {
      return res.status(400).json({
        message: 'Duplicate plan types detected',
        duplicates: [...new Set(duplicateTypes)]
      });
    }

    // Validation 3: At least one plan active
    const activePlans = pricing.filter(p => p.active);
    if (activePlans.length === 0) {
      return res.status(400).json({
        message: 'At least one plan must be active'
      });
    }

    // Save to both Vendor.pricing AND VendorPricing collection (for user endpoints)
    vendor.pricing = pricing;
    vendor.markModified('pricing');
    await vendor.save();

    // Sync to VendorPricing collection for user frontend visibility
    await VendorPricing.deleteMany({ vendor_id: vendor._id });
    const pricingDocs = pricing.map(p => ({
      vendor_id: vendor._id,
      plan_type: p.planType,
      price: p.price,
      is_active: p.active
    }));
    await VendorPricing.insertMany(pricingDocs);

    res.json({
      message: 'Pricing updated successfully',
      pricing: vendor.pricing
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Vendor Weekly Plan (Public)
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

// @desc    Get Shop Status
// @route   GET /api/vendor/shop-status
const getShopStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const now = new Date();

    // LAZY REOPEN: if planned closure endDate has passed, auto-clear on read.
    // Defense-in-depth in case the nightly cron missed this vendor.
    if (
      !vendor.isOpen &&
      vendor.currentClosure?.isActive &&
      vendor.currentClosure?.closureType === 'planned' &&
      vendor.currentClosure?.endDate &&
      new Date(vendor.currentClosure.endDate) < now
    ) {
      // Capture meal data before clearing — closure object is reset below
      const closureMissedMeals   = vendor.currentClosure.missedMeals;
      const closureExtensionDays = vendor.currentClosure.extensionDays;

      vendor.isOpen = true;
      vendor.currentClosure = {
        isActive: false, startDate: null,
        endDate: null, reason: null, closureType: null,
        closedAt: null, missedMeals: null, extensionDays: null
      };
      await vendor.save();
      console.log(`[lazyReopen] Auto-reopened ${vendor.kitchenName} on dashboard load`);

      // Notify customers async — do not block the response
      const { sendKitchenReopenEmail } = require('../cron/kitchenClosureCron');
      sendKitchenReopenEmail(vendor._id, vendor.kitchenName, 'planned', {
        missedMeals:   closureMissedMeals,
        extensionDays: closureExtensionDays
      }).catch(err =>
        console.error('[lazyReopen] Reopen email failed:', err.message)
      );
    }

    res.json({
      isOpen:         vendor.isOpen,
      currentClosure: vendor.currentClosure || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Toggle Shop Status
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
      vendor.closureStartDate = new Date();
      vendor.closureEndDate = closureEndDate ? new Date(closureEndDate) : null;
      await vendor.save();

      try {
        const activeSubscriptions = await Subscription.find({
          vendorId: vendor._id,
          status: 'active'
        }).populate('userId', 'email name');

        const userEmails = new Map();
        activeSubscriptions.forEach(sub => {
          if (sub.userId && sub.userId.email) {
            userEmails.set(sub.userId._id.toString(), sub.userId);
          }
        });

        for (const [_, user] of userEmails) {
          await sendEmail(
            user.email,
            `MealSetu - ${vendor.kitchenName} is Temporarily Closed`,
            `<div style="font-family: Arial, sans-serif;">
              <h1 style="color: #f26522;">Kitchen Temporarily Closed</h1>
              <p>Dear ${user.name},</p>
              <p><strong>${vendor.kitchenName}</strong> is temporarily closed.</p>
              <p>Your subscription has been paused and will be extended when the kitchen reopens.</p>
            </div>`
          );
        }
      } catch (emailError) {
        console.error('Failed to send closure emails:', emailError);
      }

      return res.json({
        message: 'Kitchen closed successfully',
        isOpen: vendor.isOpen,
        closureStartDate: vendor.closureStartDate,
        closureEndDate: vendor.closureEndDate,
        subscriptionsExtended: 0
      });

    } else if (isOpen === true && previousStatus === false) {
      if (!vendor.closureStartDate) {
        vendor.isOpen = true;
        vendor.closureStartDate = null;
        vendor.closureEndDate = null;
        await vendor.save();
        return res.json({
          message: 'Kitchen opened successfully',
          isOpen: true,
          subscriptionsExtended: 0
        });
      }

      const closureStart = new Date(vendor.closureStartDate);
      const closureEnd = new Date();
      const diffTime = Math.abs(closureEnd - closureStart);
      const closureDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let subscriptionsExtended = 0;
      const extendedSubscriptions = [];

      if (closureDays >= 1) {
        const activeSubscriptions = await Subscription.find({
          vendorId: vendor._id,
          status: 'active'
        }).populate('userId', 'email name');

        for (const subscription of activeSubscriptions) {
          const currentExpiry = new Date(subscription.expiryDate);
          const now = new Date();
          const previousExpiry = new Date(currentExpiry);

          if (currentExpiry > now) {
            currentExpiry.setDate(currentExpiry.getDate() + closureDays);
            subscription.expiryDate = currentExpiry;
            await subscription.save();
            subscriptionsExtended++;

            if (subscription.userId) {
              extendedSubscriptions.push({
                user: subscription.userId,
                previousExpiry: previousExpiry.toLocaleDateString(),
                newExpiry: currentExpiry.toLocaleDateString()
              });
            }
          }
        }

        try {
          for (const extSub of extendedSubscriptions) {
            await sendEmail(
              extSub.user.email,
              `MealSetu - ${vendor.kitchenName} is Back in Service!`,
              `<div style="font-family: Arial, sans-serif;">
                <h1 style="color: #16a34a;">Kitchen Reopened!</h1>
                <p>Dear ${extSub.user.name},</p>
                <p><strong>${vendor.kitchenName}</strong> is back in service!</p>
                <p>Subscription extended by ${closureDays} day(s).</p>
                <p><strong>New Expiry: ${extSub.newExpiry}</strong></p>
              </div>`
            );
          }
        } catch (emailError) {
          console.error('Failed to send reopening emails:', emailError);
        }
      }

      vendor.closureStartDate = null;
      vendor.closureEndDate = null;
      await vendor.save();

      return res.json({
        message: `Kitchen opened! ${subscriptionsExtended > 0
          ? `${subscriptionsExtended} subscription(s) extended by ${closureDays} day(s)`
          : ''}`,
        isOpen: vendor.isOpen,
        closureDays,
        subscriptionsExtended
      });

    } else {
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
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }
    vendor.profileImage = `/uploads/${req.file.filename}`;
    await vendor.save();
    const profileImageUrl = transformProfilePic(vendor.profileImage, req);
    res.json({
      message: 'Profile picture updated successfully',
      profileImage: profileImageUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update vendor kitchen poster
// @route   PUT /api/vendor/me/kitchen-poster
const updateKitchenPoster = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }
    vendor.kitchenPoster = `/uploads/${req.file.filename}`;
    await vendor.save();
    const kitchenPosterUrl = transformKitchenPoster(vendor.kitchenPoster, req);
    res.json({
      message: 'Kitchen poster updated successfully',
      kitchenPoster: kitchenPosterUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update vendor trial settings
// @route   PATCH /api/vendor/trial-settings
const updateTrialSettings = async (req, res) => {
  try {
    const { trialEnabled, trialFee } = req.body;
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    if (trialEnabled !== undefined) vendor.trialEnabled = trialEnabled;
    if (trialFee !== undefined) {
      const fee = Number(trialFee);
      if (isNaN(fee) || fee < 0) {
        return res.status(400).json({ message: 'trialFee must be a positive number or zero' });
      }
      vendor.trialFee = fee;
    }
    await vendor.save();
    res.json({
      message: 'Trial settings updated successfully',
      trialEnabled: vendor.trialEnabled,
      trialFee: vendor.trialFee
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Submit vendor compliance
const submitVendorCompliance = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (req.files) {
      const normalizePath = (filePath) => {
        let normalized = filePath.replace(/\\/g, '/');
        if (normalized.includes('uploads/')) {
          const parts = normalized.split('uploads/');
          normalized = '/uploads/' + parts[parts.length - 1];
        }
        return normalized;
      };
      if (req.files.fssaiDoc) {
        vendor.fssaiLicense = normalizePath(req.files.fssaiDoc[0].path);
      }
      if (req.files.gstDoc) {
        vendor.gstDocument = normalizePath(req.files.gstDoc[0].path);
      }
    }

    const updateResult = await Vendor.findByIdAndUpdate(
      vendor._id,
      {
        $set: {
          isApproved: false,
          status: 'pending',
          approvalStatus: 'Pending',
          rejectionReason: null,
          resubmittedAt: new Date(),
          submittedDate: new Date()
        }
      },
      { new: true, runValidators: false }
    );

    res.json({
      message: 'Documents submitted successfully.',
      vendorId: updateResult._id,
      newStatus: updateResult.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== COMMISSION FUNCTIONS =====

// @desc    Get vendor commission summary (current rolling week)
// @route   GET /api/vendor/commission/summary
const getCommissionSummary = async (req, res) => {
  try {
    console.log('=== getCommissionSummary CALLED ===');
    console.log('req.user._id:', req.user?._id);
    const { getCommissionWeek } = require('../utils/commissionWeekCalculator');

    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    const vendorId = vendor._id;
    console.log('vendorId:', vendorId);

    const now = new Date();

    // Rolling week anchored to vendor's first order — matches cron exactly
    const firstOrder = await Order.findOne({ vendorId })
      .sort({ orderDate: 1, createdAt: 1 })
      .select('createdAt orderDate startDate')
      .lean();

    const anchorDate = firstOrder?.createdAt || firstOrder?.orderDate || firstOrder?.startDate;
    console.log('=== firstOrder found ===', anchorDate || 'NOT FOUND');
    if (!anchorDate) {
      return res.json({
        success:            true,
        currentWeek:        null,
        isWeekOpen:         false,
        canPay:             false,
        lifetimeEarnings:   0,
        lifetimeCommission: 0,
        lifetimeNet:        0
      });
    }

    const weekInfo = getCommissionWeek(anchorDate, now);
    if (!weekInfo || isNaN(new Date(weekInfo.weekStart).getTime())) {
      return res.json({
        success:            true,
        currentWeek:        null,
        isWeekOpen:         false,
        canPay:             false,
        lifetimeEarnings:   0,
        lifetimeCommission: 0,
        lifetimeNet:        0
      });
    }

    const isWeekOpen = now <= new Date(weekInfo.weekEnd);

    const start = new Date(weekInfo.weekStart);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(weekInfo.weekEnd);
    end.setUTCHours(23, 59, 59, 999);

    // Check if existing locked record
    let commission = await Commission.findOne({ vendorId, week: weekInfo.weekKey });

    // Lifetime aggregation (always computed)
    const lifetimeAgg = await Commission.aggregate([
      { $match: { vendorId: vendorId } },
      { $group: {
        _id:                null,
        lifetimeEarnings:   { $sum: '$total_earning' },
        lifetimeCommission: { $sum: '$commission_amount' }
      }}
    ]);
    const lifetimeEarnings   = lifetimeAgg[0]?.lifetimeEarnings   || 0;
    const lifetimeCommission = lifetimeAgg[0]?.lifetimeCommission || 0;
    const lifetimeNet        = lifetimeEarnings - lifetimeCommission;

    // If locked — return frozen values, never recalculate
    if (commission?.isLocked) {
      const dueDate   = new Date(commission.due_date);
      const isOverdue = dueDate < now && commission.status !== 'paid';
      const canPay    = commission.status !== 'paid' && commission.isLocked;
      const daysUntilDue = isOverdue
        ? -Math.floor((now - dueDate) / 86400000)
        : Math.ceil((dueDate - now) / 86400000);

      console.log('=== getCommissionSummary RETURNING (locked) ===', JSON.stringify({
        hasCurrentWeek:   true,
        weekKey:          commission.week,
        totalEarning:     commission.total_earning,
        commissionAmount: commission.commission_amount,
        status:           commission.status,
        isLocked:         commission.isLocked,
        firstOrderExists: !!firstOrder,
        firstOrderDate:   anchorDate
      }));
      return res.json({
        success:     true,
        currentWeek: {
          ...commission.toObject(),
          isWeekOpen:  false,
          canPay,
          isOverdue,
          isEstimate:  false,
          daysUntilDue
        },
        lifetimeEarnings,
        lifetimeCommission,
        lifetimeNet
      });
    }

    // Not locked — calculate live, check both createdAt and orderDate
    const orders = await Order.find({
      vendorId,
      status: { $in: ['active', 'completed', 'trial', 'pending'] },
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { orderDate: { $gte: start, $lte: end } }
      ]
    }).select('amount status createdAt orderDate').lean();

    console.log('[getCommissionSummary] orders found:', orders.length,
      'for week:', start.toISOString(), '→', end.toISOString());

    const totalEarning = orders.reduce((s, o) => s + (o.amount || 0), 0);

    // Tier lookup
    const tier = await CommissionSetting.findOne({
      isActive:   true,
      minEarning: { $lte: totalEarning },
      $or: [
        { maxEarning: { $gte: totalEarning } },
        { maxEarning: null }
      ]
    }).sort({ minEarning: -1 }).limit(1).lean();

    const rate             = tier?.ratePercent || 3;
    const commissionAmount = Math.round(totalEarning * rate / 100);
    const dueDate          = new Date(weekInfo.weekEnd);
    dueDate.setUTCDate(dueDate.getUTCDate() + 7);

    const settlementNumber = `MS-${weekInfo.financialYear}-W${String(
      weekInfo.fyWeekNumber
    ).padStart(2, '0')}-${String(vendorId).slice(-4).toUpperCase()}`;

    // Upsert — never overwrite a locked record
    commission = await Commission.findOneAndUpdate(
      { vendorId, week: weekInfo.weekKey, isLocked: { $ne: true } },
      {
        $set: {
          total_orders:        orders.length,
          total_earning:       totalEarning,
          commission_rate:     rate,
          commission_amount:   commissionAmount,
          due_date:            dueDate,
          weekStart:           weekInfo.weekStart,
          weekEnd:             weekInfo.weekEnd,
          financialYear:       weekInfo.financialYear,
          financialWeekNumber: weekInfo.fyWeekNumber,
          settlementNumber
        },
        $setOnInsert: {
          status:        'pending',
          isLocked:      false,
          reminderCount: 0
        }
      },
      { upsert: true, new: true }
    );

    const canPay = !isWeekOpen && commission.status !== 'paid' && commission.isLocked;

    console.log('=== getCommissionSummary RETURNING (live) ===', JSON.stringify({
      hasCurrentWeek:   !!commission,
      weekKey:          commission?.week,
      totalEarning:     commission?.total_earning,
      commissionAmount: commission?.commission_amount,
      status:           commission?.status,
      isLocked:         commission?.isLocked,
      firstOrderExists: !!firstOrder,
      firstOrderDate:   firstOrder?.createdAt
    }));
    return res.json({
      success:     true,
      currentWeek: {
        ...commission.toObject(),
        isWeekOpen,
        canPay,
        isOverdue:   false,
        isEstimate:  isWeekOpen,
        daysUntilDue: Math.ceil((dueDate - now) / 86400000)
      },
      lifetimeEarnings,
      lifetimeCommission,
      lifetimeNet
    });

  } catch (err) {
    console.error('[getCommissionSummary]', err);
    return res.status(500).json({ message: err.message });
  }
};

// @desc    Get pending payout (legacy dashboard)
const getPendingPayout = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(200).json({ pendingAmount: 0, overdueAmount: 0 });
    }

    const pendingCommissions = await Commission.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: { $in: ['pending', 'overdue'] }
        }
      },
      { $group: { _id: null, totalPending: { $sum: '$commission_amount' } } }
    ]);

    res.status(200).json({
      pendingAmount: pendingCommissions[0]?.totalPending || 0,
      overdueAmount: 0,
      pendingCount: 1,
      overdueCount: 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get all commissions for vendor
// @route   GET /api/vendor/commission/history
const getMyCommissions = async (req, res) => {
  try {
    console.log('=== getCommissionHistory CALLED ===');
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(200).json({ commissions: [], total: 0 });
    }
    console.log('vendorId:', vendor._id);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const commissions = await Commission.find({ vendorId: vendor._id })
      .sort({ month: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Commission.countDocuments({ vendorId: vendor._id });

    const allCommissions = await Commission.find({ vendorId: vendor._id }).lean();
    console.log('=== ALL COMMISSIONS IN DB FOR VENDOR ===', {
      count:    allCommissions.length,
      vendorId: vendor._id,
      records:  allCommissions.map(c => ({
        id:      c._id,
        week:    c.week,
        status:  c.status,
        amount:  c.commission_amount,
        earning: c.total_earning,
        vendorIdOnRecord: c.vendorId
      }))
    });

    res.status(200).json({
      commissions,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getAdminUpiId = async (req, res) => {
  try {
    const PlatformSetting = require('../models/PlatformSetting');
    const settings = await PlatformSetting.findOne();
    if (!settings || !settings.adminUpiId) {
      return res.json({ adminUpiId: null, configured: false });
    }
    res.json({ adminUpiId: settings.adminUpiId, configured: true });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all cash payment orders for this vendor
// @route   GET /api/vendor/cash-payments
const getCashPayments = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const [orders, pendingCount] = await Promise.all([
      Order.find({ vendorId: vendor._id, paymentMethod: 'Cash' })
        .populate('userId', 'name phone email')
        .sort({ orderDate: -1 }),
      Order.countDocuments({
        vendorId: vendor._id,
        paymentMethod: 'Cash',
        paymentStatus: 'Pending'
      })
    ]);

    const mapped = orders.map(order => ({
      orderId: order._id,
      customerName: order.manualCustomerName || order.userId?.name || order.customerName || 'Unknown',
      customerPhone: order.manualCustomerPhone || order.userId?.phone || 'N/A',
      planType: order.planType,
      amount: order.amount,
      orderDate: order.orderDate,
      paymentStatus: order.paymentStatus,
      cashPaymentConfirmedAt: order.cashPaymentConfirmedAt || null,
      startDate: order.startDate,
      endDate: order.endDate,
      isManualOrder: order.isManualOrder || false
    }));

    res.json({ orders: mapped, pendingCount });
  } catch (error) {
    console.error('getCashPayments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark a cash payment order as paid
// @route   PATCH /api/vendor/cash-payments/:orderId/mark-paid
const markCashPaymentPaid = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const order = await Order.findOne({
      _id: req.params.orderId,
      vendorId: vendor._id,
      paymentMethod: 'Cash',
      paymentStatus: 'Pending'
    }).populate('userId', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found or already marked as paid' });
    }

    order.paymentStatus = 'Paid';
    order.cashPaymentConfirmedAt = new Date();
    order.cashPaymentConfirmedBy = vendor._id;
    await order.save();

    const io = req.app.get('io');
    if (io) {
      if (order.userId) {
        io.to(order.userId.toString()).emit('payment_confirmed', {
          orderId: order._id,
          message: 'Your cash payment has been confirmed by the vendor!'
        });
      }
      io.to(`vendor_${vendor._id}`).emit('cash_payment_updated', {
        orderId: order._id
      });
    }

    try {
      if (order.userId?.email) {
        const { getMealSlotInfo } = require('../utils/mealTimingUtils');
        const slotInfo = getMealSlotInfo(order.startDate, order.orderDate);
        const endFormatted = order.endDate
          ? new Date(order.endDate).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric'
            })
          : 'N/A';
        const confirmedAt = new Date(order.cashPaymentConfirmedAt).toLocaleString('en-IN');
        await sendEmail(
          order.userId.email,
          'MealSetu — Cash Payment Confirmed ✅',
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#16a34a;padding:24px;text-align:center;border-radius:12px 12px 0 0">
              <h1 style="color:white;margin:0;font-size:22px">✅ Cash Payment Confirmed</h1>
            </div>
            <div style="padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
              <p>Dear ${order.userId.name || 'Customer'},</p>
              <p>Your cash payment has been confirmed by the vendor. Your subscription is now active.</p>
              <div style="background:${slotInfo.badgeBg};border-left:4px solid ${slotInfo.badgeColor};border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0 0 6px 0;font-weight:700;color:${slotInfo.badgeColor};font-size:16px">${slotInfo.slotLabel}</p>
                <p style="margin:0 0 4px 0;color:#374151;font-size:14px">${slotInfo.startMessage}</p>
                <p style="margin:0;color:#64748b;font-size:13px">${slotInfo.mealMessage}</p>
              </div>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr style="background:#f8fafc">
                  <td style="padding:10px 14px;font-weight:600;color:#374151">Plan</td>
                  <td style="padding:10px 14px;color:#64748b">${order.planType}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:600;color:#374151">Amount</td>
                  <td style="padding:10px 14px;color:#64748b">₹${order.amount}</td>
                </tr>
                <tr style="background:#f8fafc">
                  <td style="padding:10px 14px;font-weight:600;color:#374151">Valid Until</td>
                  <td style="padding:10px 14px;color:#64748b">${endFormatted}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:600;color:#374151">Confirmed At</td>
                  <td style="padding:10px 14px;color:#64748b">${confirmedAt}</td>
                </tr>
              </table>
              <p style="color:#64748b;font-size:13px;text-align:center;margin-top:20px">Thank you for choosing MealSetu!</p>
            </div>
          </div>`
        );
      }
    } catch (emailError) {
      console.error('Failed to send cash payment confirmation email:', emailError);
    }

    res.json({ message: 'Payment marked as paid', order });
  } catch (error) {
    console.error('markCashPaymentPaid error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Extends all active orders and shifts all pending orders by extensionDays.
// Uses millisecond math so 0.5-day (12-hour) extensions are precise.
// Returns { activeUpdated, upcomingUpdated } counts.
const extendAllPlansOnClosure = async (vendorId, extensionDays) => {
  if (!extensionDays || extensionDays <= 0) {
    console.log(`[extendPlans] extensionDays=${extensionDays} — skipping`);
    return { activeUpdated: 0, upcomingUpdated: 0 };
  }

  const extensionMs = extensionDays * 24 * 60 * 60 * 1000;

  const activeOrders = await Order.find({
    vendorId,
    status:  'active',
    endDate: { $gte: new Date() }
  });

  const pendingOrders = await Order.find({ vendorId, status: 'pending' });

  console.log(`[extendPlans] vendorId=${vendorId} extensionDays=${extensionDays} extensionMs=${extensionMs}`);
  console.log(`[extendPlans] active=${activeOrders.length} pending=${pendingOrders.length}`);

  for (const order of activeOrders) {
    const oldEnd  = new Date(order.endDate);
    order.endDate = new Date(oldEnd.getTime() + extensionMs);
    await order.save();
    console.log(`[extendPlans] active ${order._id}: ${oldEnd.toDateString()} → ${order.endDate.toDateString()}`);
  }

  for (const order of pendingOrders) {
    if (order.startDate) {
      order.startDate          = new Date(new Date(order.startDate).getTime() + extensionMs);
      order.scheduledStartDate = order.scheduledStartDate
        ? new Date(new Date(order.scheduledStartDate).getTime() + extensionMs)
        : order.startDate;
    }
    if (order.endDate) {
      order.endDate            = new Date(new Date(order.endDate).getTime() + extensionMs);
      order.scheduledEndDate   = order.scheduledEndDate
        ? new Date(new Date(order.scheduledEndDate).getTime() + extensionMs)
        : order.endDate;
    }
    await order.save();
    console.log(`[extendPlans] pending ${order._id} shifted +${extensionDays} days`);
  }

  return { activeUpdated: activeOrders.length, upcomingUpdated: pendingOrders.length };
};

// @desc  Close kitchen with user notification + plan extension
// @route POST /api/vendor/kitchen/close
const closeKitchenWithClosure = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id })
      .populate('ownerId', 'email name');
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    if (vendor.currentClosure?.isActive === true) {
      return res.status(409).json({ message: 'Kitchen is already closed. Reopen before closing again.' });
    }

    const { closureType, startDate, endDate, reason } = req.body;
    const isEmergency = closureType === 'emergency';

    // For emergency: start is always NOW server-side — never trust client time
    const start = isEmergency ? new Date() : (() => {
      const d = new Date(startDate);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();

    const end = new Date(endDate);
    // 18:29:59 UTC = 23:59:59 IST — end of day in Indian timezone, avoids +1 day display artifact
    end.setUTCHours(18, 29, 59, 999);

    // Compute meal-accurate extension for planned closures.
    // For emergency: unknown duration — compute at reopen using closedAt.
    let plannedMissedMeals   = null;
    let plannedExtensionDays = null;
    let plannedBreakdown     = [];
    if (!isEmergency) {
      const calc = calculatePlannedClosureMeals(start, end);
      plannedMissedMeals   = calc.missedMeals;
      plannedExtensionDays = calc.extensionDays;
      plannedBreakdown     = calc.breakdown;
      console.log(`[plannedClosure] vendor=${vendor._id} kitchen=${vendor.kitchenName}`);
      console.log(`[plannedClosure] missedMeals=${plannedMissedMeals} extensionDays=${plannedExtensionDays}`);
      console.log(`[plannedClosure] breakdown=${JSON.stringify(plannedBreakdown)}`);
    }

    vendor.currentClosure = {
      isActive:      true,
      startDate:     start,
      endDate:       end,
      reason:        reason || (isEmergency ? 'Emergency' : 'Holiday'),
      closureType,
      closedAt:      new Date(),   // exact API-call timestamp; for emergency: precise close time
      missedMeals:   plannedMissedMeals,
      extensionDays: plannedExtensionDays
    };
    vendor.plannedClosures.push({
      startDate:   start,
      endDate:     end,
      reason:      reason || (isEmergency ? 'Emergency' : 'Holiday'),
      closureType,
      notifiedAt:  new Date()
    });
    vendor.isOpen = false;
    await vendor.save();

    const startFormatted = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const endFormatted   = end.toLocaleDateString('en-IN',   { day: 'numeric', month: 'long', year: 'numeric' });

    const activeOrders = await Order.find({
      vendorId: vendor._id,
      status:   'active',
      endDate:  { $gte: new Date() }
    }).populate('userId', 'email name');

    // ── EMERGENCY: send Email 1 only, do NOT extend plans yet ──
    if (isEmergency) {
      for (const order of activeOrders) {
        if (!order.userId?.email) continue;
        try {
          await sendEmail(
            order.userId.email,
            `🚨 ${vendor.kitchenName} – Emergency Closure Notice`,
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#dc2626;padding:24px;text-align:center;border-radius:12px 12px 0 0">
                <h1 style="color:white;margin:0;font-size:20px">⚠️ Emergency Kitchen Closure</h1>
              </div>
              <div style="padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
                <p>Dear ${order.userId.name},</p>
                <p><strong>${vendor.kitchenName}</strong> has had to close temporarily due to an emergency.</p>
                <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0">
                  <p style="margin:0 0 8px;font-weight:700;color:#92400e">Closure Details</p>
                  <p style="margin:4px 0;color:#374151">📅 <strong>Closed from:</strong> ${startFormatted}</p>
                  <p style="margin:4px 0;color:#374151">📅 <strong>Expected reopen:</strong> ${endFormatted}</p>
                  <p style="margin:4px 0;color:#374151">📝 <strong>Reason:</strong> ${reason || 'Emergency'}</p>
                </div>
                <div style="background:#f0f9ff;border-left:4px solid #3b82f6;border-radius:8px;padding:16px;margin:16px 0">
                  <p style="margin:0 0 8px;font-weight:700;color:#1d4ed8">ℹ️ Your Plan</p>
                  <p style="margin:0;color:#374151">Your active plan has been noted. It will be extended by the <strong>exact number of meals missed</strong> during the closure. We will confirm your new plan end date when the kitchen reopens.</p>
                </div>
                <p style="color:#64748b;font-size:13px">We will notify you the moment the kitchen reopens.</p>
                <p style="color:#64748b;font-size:13px">Thank you for your understanding — MealSetu Team</p>
              </div>
            </div>`
          );
        } catch (emailErr) {
          console.error('Emergency Email 1 failed:', order.userId.email, emailErr.message);
        }
      }

      const io = req.app.get('io');
      if (io) {
        for (const order of activeOrders) {
          if (order.userId?._id) {
            io.to(order.userId._id.toString()).emit('subscription_updated', {
              type: 'kitchen_closed',
              message: `${vendor.kitchenName} has temporarily closed. Your plan will be extended when they reopen.`
            });
          }
        }
      }

      return res.json({
        success:       true,
        message:       `Kitchen closed (emergency). ${activeOrders.length} subscribers notified.`,
        extendedCount: 0,
        missedMeals:   null,
        extensionDays: null,
        startDate:     start,
        endDate:       end
      });
    }

    // ── PLANNED: extend active plans + shift upcoming (pending) plans ──
    const extensionMs = plannedExtensionDays * 24 * 60 * 60 * 1000;

    if (plannedExtensionDays > 0) {
      await extendAllPlansOnClosure(vendor._id, plannedExtensionDays);
    } else {
      console.log(`[plannedClosure] extensionDays=0 — no order extension needed`);
    }

    // Send closure notification to each active subscriber
    // activeOrders was fetched before the extension; new endDate = oldEnd + extensionMs
    for (const order of activeOrders) {
      if (!order.userId?.email) continue;
      const newEndDate      = new Date(new Date(order.endDate).getTime() + extensionMs);
      const newEndFormatted = newEndDate.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const mealLine = plannedMissedMeals > 0
        ? `<p style="margin:4px 0;color:#374151">🍽️ <strong>Meals covered:</strong> ${plannedMissedMeals} meal${plannedMissedMeals !== 1 ? 's' : ''}</p>`
        : '';
      try {
        await sendEmail(
          order.userId.email,
          `📅 ${vendor.kitchenName} – Planned Closure Notice`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#f26522;padding:24px;text-align:center;border-radius:12px 12px 0 0">
              <h1 style="color:white;margin:0;font-size:20px">📅 Planned Kitchen Closure</h1>
            </div>
            <div style="padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
              <p>Dear ${order.userId.name},</p>
              <p><strong>${vendor.kitchenName}</strong> will be closed for a planned break.</p>
              <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0 0 8px;font-weight:700;color:#92400e">Closure Details</p>
                <p style="margin:4px 0;color:#374151">📅 <strong>From:</strong> ${startFormatted}</p>
                <p style="margin:4px 0;color:#374151">📅 <strong>To:</strong> ${endFormatted}</p>
                <p style="margin:4px 0;color:#374151">📝 <strong>Reason:</strong> ${reason || 'Holiday'}</p>
              </div>
              <div style="background:#dcfce7;border-left:4px solid #16a34a;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0 0 8px;font-weight:700;color:#166534">✅ Your Plan Has Been Extended</p>
                <p style="margin:4px 0;color:#374151">Your subscription has been automatically extended by <strong>${plannedExtensionDays} day${plannedExtensionDays !== 1 ? 's' : ''}</strong>.</p>
                ${mealLine}
                <p style="margin:8px 0 0;color:#374151">New plan end date: <strong style="color:#16a34a">${newEndFormatted}</strong></p>
              </div>
              <p style="color:#64748b;font-size:13px">We apologize for the inconvenience and look forward to serving you again.</p>
              <p style="color:#64748b;font-size:13px">Thank you for your understanding — MealSetu Team</p>
            </div>
          </div>`
        );
      } catch (emailErr) {
        console.error('Planned closure email failed:', order.userId.email, emailErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) {
      for (const order of activeOrders) {
        if (order.userId?._id) {
          io.to(order.userId._id.toString()).emit('subscription_updated', {
            type: 'plan_extended',
            message: plannedExtensionDays > 0
              ? `${vendor.kitchenName} is closed. Your plan has been extended by ${plannedExtensionDays} days.`
              : `${vendor.kitchenName} is closed temporarily.`
          });
        }
      }
    }

    res.json({
      success:       true,
      message:       `Kitchen closed. ${activeOrders.length} active plans extended by ${plannedExtensionDays} days (${plannedMissedMeals} missed meals).`,
      extendedCount: activeOrders.length,
      missedMeals:   plannedMissedMeals,
      extensionDays: plannedExtensionDays,
      startDate:     start,
      endDate:       end
    });
  } catch (error) {
    console.error('closeKitchenWithClosure error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc  Reopen kitchen after closure
// @route POST /api/vendor/kitchen/reopen
const reopenKitchen = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const closure = vendor.currentClosure;

    if (!closure?.isActive) {
      return res.status(400).json({ success: false, message: 'No active closure found' });
    }

    const reopenTime = new Date();

    let extensionDays = 0;
    let missedMeals   = 0;
    let breakdown     = [];

    if (closure.closureType === 'emergency') {
      // Use closedAt (exact close time), not startDate (UTC midnight)
      const closeTime = new Date(closure.closedAt || closure.startDate);
      const result    = calculateMissedMeals(closeTime, reopenTime);
      extensionDays   = result.extensionDays;
      missedMeals     = result.missedMeals;
      breakdown       = result.breakdown;

      console.log(`[emergencyReopen] vendor=${vendor._id} kitchen=${vendor.kitchenName}`);
      console.log(`[emergencyReopen] closeTime=${closeTime.toISOString()} reopenTime=${reopenTime.toISOString()}`);
      console.log(`[emergencyReopen] missedMeals=${missedMeals} extensionDays=${extensionDays}`);
      console.log(`[emergencyReopen] breakdown=${JSON.stringify(breakdown)}`);
    }

    if (closure.closureType === 'planned') {
      console.log(`[plannedReopen] vendor=${vendor._id} — planned closure cleared, no re-extension`);
    }

    // Clear closure state first — vendor is open again
    vendor.isOpen = true;
    vendor.currentClosure = {
      isActive:      false,
      startDate:     null,
      endDate:       null,
      reason:        null,
      closureType:   null,
      closedAt:      null,
      missedMeals:   null,
      extensionDays: null
    };
    await vendor.save();

    // Extend orders only for emergency (planned orders were extended at close time)
    if (closure.closureType === 'emergency') {
      await extendAllPlansOnClosure(vendor._id, extensionDays);
    }

    // Send reopen notification with accurate meal info
    const { sendKitchenReopenEmail } = require('../cron/kitchenClosureCron');
    sendKitchenReopenEmail(vendor._id, vendor.kitchenName, closure.closureType, {
      missedMeals, extensionDays
    }).catch(err => console.error('[reopenKitchen] Email failed:', err.message));

    const io = req.app.get('io');
    if (io) {
      const activeOrders = await Order.find({ vendorId: vendor._id, status: 'active', endDate: { $gte: new Date() } });
      for (const order of activeOrders) {
        if (order.userId) {
          io.to(order.userId.toString()).emit('subscription_updated', {
            type:    'plan_extended',
            message: extensionDays > 0
              ? `${vendor.kitchenName} has reopened! Your plan was extended by ${extensionDays} days.`
              : `${vendor.kitchenName} has reopened!`
          });
        }
      }
    }

    return res.json({
      success:       true,
      message:       'Kitchen reopened successfully',
      missedMeals,
      extensionDays
    });
  } catch (error) {
    console.error('[reopenKitchen] Error:', error);
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
  addManualCustomer,
  getManualCustomers,
  calculateManualOrderAmount,
  getJainMenu,
  saveJainMenu,
  getPricing,       // ✅ FIXED
  savePricing,
  getVendorWeeklyPlan,
  toggleShopStatus,
  getShopStatus,
  updateTrialSettings,
  submitVendorCompliance,
  getCommissionSummary,
  getPendingPayout,
  getMyCommissions,
  getAdminUpiId,
  getCashPayments,
  markCashPaymentPaid,
  createCommissionPaymentOrder,
  verifyCommissionPaymentRazorpay,
  closeKitchenWithClosure,
  reopenKitchen,
  extendAllPlansOnClosure,
  getWeekOrderBreakdown,
  downloadSettlementInvoice,
  raiseCommissionDispute
};

// ===== RAZORPAY COMMISSION PAYMENT =====

// @desc  Create Razorpay order for vendor commission payment
// @route POST /api/vendor/commission/create-payment-order
async function createCommissionPaymentOrder(req, res) {
  try {
    const razorpay  = require('../utils/razorpayUtils');
    const Commission = require('../models/Commission');

    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const { commissionId } = req.body;
    const commission = await Commission.findOne({ _id: commissionId, vendorId: vendor._id });
    if (!commission) return res.status(404).json({ message: 'Commission not found' });
    if (commission.status === 'paid') {
      return res.status(400).json({ message: 'Commission already paid' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(commission.commission_amount * 100),
      currency: 'INR',
      receipt:  `c_${Date.now()}`,
      notes: {
        vendorId:     vendor._id.toString(),
        commissionId: commissionId,
        type:         'commission_payment'
      }
    });

    res.json({
      orderId:          razorpayOrder.id,
      amount:           razorpayOrder.amount,
      currency:         razorpayOrder.currency,
      keyId:            process.env.RAZORPAY_KEY_ID,
      commissionAmount: commission.commission_amount,
      week:             commission.month
    });
  } catch (error) {
    console.error('Create commission payment order error:', error);
    res.status(500).json({ message: 'Payment initiation failed', error: error.message });
  }
}

// @desc  Verify Razorpay commission payment — auto-confirms, no manual review needed
// @route POST /api/vendor/commission/verify-payment
async function verifyCommissionPaymentRazorpay(req, res) {
  try {
    const crypto          = require('crypto');
    const Commission      = require('../models/Commission');
    const CommissionPayment = require('../models/CommissionPayment');

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      commissionId
    } = req.body;

    const body        = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const commission = await Commission.findOne({ _id: commissionId, vendorId: vendor._id });
    if (!commission) return res.status(404).json({ message: 'Commission not found' });

    await CommissionPayment.create({
      vendorEarningId:   commission._id,
      vendorId:          vendor._id,
      amountPaid:        commission.commission_amount,
      paymentMethod:     'upi',
      utrNumber:         razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paidAt:            new Date(),
      status:            'confirmed',
      verifiedAt:        new Date()
    });

    const paymentTime = new Date();
    const isPaidOnTime = paymentTime <= new Date(commission.due_date);

    if (!commission.auditLog) commission.auditLog = [];
    commission.auditLog.push({
      action:      'paid',
      performedBy: 'vendor',
      at:          paymentTime,
      note:        `Paid via Razorpay. On time: ${isPaidOnTime}`,
      valueBefore: { status: commission.status },
      valueAfter:  { status: 'paid', paymentReference: razorpay_payment_id }
    });

    commission.status            = 'paid';
    commission.payment_date      = paymentTime;
    commission.paidOnTime        = isPaidOnTime;
    commission.paymentReference  = razorpay_payment_id;
    commission.admin_verified_at = paymentTime;
    commission.rejectionReason   = null;
    await commission.save();

    try {
      const vendorWithOwner = await Vendor.findById(vendor._id).populate('ownerId', 'email name');
      if (vendorWithOwner?.ownerId?.email) {
        await sendEmail(
          vendorWithOwner.ownerId.email,
          'MealSetu — Commission Payment Confirmed',
          `<div style="font-family:Arial,sans-serif;max-width:600px">
            <h2 style="color:#16a34a">Commission Payment Received</h2>
            <p>Dear ${vendorWithOwner.ownerId.name},</p>
            <div style="background:#f0fdf4;padding:20px;border-radius:10px;margin:16px 0">
              <p><strong>Week:</strong> ${commission.month}</p>
              <p><strong>Amount Paid:</strong> ₹${commission.commission_amount}</p>
              <p><strong>Transaction ID:</strong> ${razorpay_payment_id}</p>
              <p><strong>Status:</strong> Confirmed ✓</p>
            </div>
            <p>Thank you for your payment!</p>
          </div>`
        );
      }
    } catch (emailErr) {
      console.error('Email failed:', emailErr.message);
    }

    res.json({
      success:       true,
      message:       'Commission payment successful!',
      transactionId: razorpay_payment_id
    });
  } catch (error) {
    console.error('Verify commission payment error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
}

// @desc  Vendor raises dispute on a settlement
// @route POST /api/vendor/commission/:commissionId/dispute
async function raiseCommissionDispute(req, res) {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const { commissionId } = req.params;
    const { note }         = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ message: 'Dispute note is required' });
    }

    const commission = await Commission.findOne({ _id: commissionId, vendorId: vendor._id });
    if (!commission) return res.status(404).json({ message: 'Settlement not found' });
    if (commission.status === 'paid') {
      return res.status(400).json({ message: 'Cannot dispute a paid settlement' });
    }
    if (commission.disputeStatus === 'raised') {
      return res.status(400).json({ message: 'Dispute already raised for this settlement' });
    }

    commission.disputeStatus   = 'raised';
    commission.disputeNote     = note.trim();
    commission.disputeRaisedAt = new Date();
    if (!commission.auditLog) commission.auditLog = [];
    commission.auditLog.push({
      action:      'disputed',
      performedBy: `vendor:${vendor._id}`,
      at:          new Date(),
      note:        `Vendor raised dispute: ${note.trim()}`,
      valueBefore: { disputeStatus: null },
      valueAfter:  { disputeStatus: 'raised' }
    });

    await commission.save();
    return res.json({ success: true, message: 'Dispute raised successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// @desc  Order breakdown for a specific commission week
// @route GET /api/vendor/commission/week-orders
async function getWeekOrderBreakdown(req, res) {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const { weekStart, weekEnd } = req.query;
    if (!weekStart || !weekEnd) {
      return res.status(400).json({ message: 'weekStart and weekEnd are required' });
    }

    const start = new Date(weekStart);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(weekEnd);
    end.setUTCHours(23, 59, 59, 999);

    const orders = await Order.find({
      vendorId: vendor._id,
      status:   { $in: ['active', 'completed', 'trial'] },
      createdAt: { $gte: start, $lte: end }
    })
      .populate('userId', 'name phone')
      .sort({ createdAt: 1 })
      .lean();

    const commission = await Commission.findOne({
      vendorId: vendor._id,
      weekStart: { $gte: start },
      weekEnd:   { $lte: end }
    }).lean();

    const commissionRate = commission?.commission_rate || 5;
    const grossEarnings  = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const commissionAmt  = commission?.commission_amount ||
                           Math.round(grossEarnings * commissionRate / 100);
    const netEarnings    = grossEarnings - commissionAmt;

    const orderBreakdown = orders.map(order => ({
      orderId:       order._id,
      orderDate:     order.createdAt,
      customerName:  order.userId?.name || 'Customer',
      customerPhone: order.userId?.phone || '',
      planType:      order.planType,
      grossAmount:   order.amount || 0,
      commissionRate,
      commissionCut: Math.round((order.amount || 0) * commissionRate / 100),
      netAmount:     (order.amount || 0) - Math.round((order.amount || 0) * commissionRate / 100),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus
    }));

    return res.json({
      success:          true,
      weekStart:        start,
      weekEnd:          end,
      weekKey:          commission?.week || '',
      totalOrders:      orders.length,
      grossEarnings,
      commissionRate,
      commissionAmount: commissionAmt,
      netEarnings,
      commissionStatus: commission?.status || 'pending',
      dueDate:          commission?.due_date || null,
      settlementId:     commission?._id || null,
      orders:           orderBreakdown
    });
  } catch (err) {
    console.error('[getWeekOrderBreakdown]', err);
    return res.status(500).json({ message: err.message });
  }
}

// @desc  Download PDF settlement invoice for a commission week
// @route GET /api/vendor/commission/invoice/:commissionId
async function downloadSettlementInvoice(req, res) {
  try {
    const { generateSettlementInvoicePDF } = require('../utils/invoicePdfGenerator');
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const { commissionId } = req.params;
    const commission = await Commission.findOne({ _id: commissionId, vendorId: vendor._id }).lean();
    if (!commission) return res.status(404).json({ message: 'Settlement not found' });

    const start = new Date(commission.weekStart);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(commission.weekEnd);
    end.setUTCHours(23, 59, 59, 999);

    const orders = await Order.find({
      vendorId: vendor._id,
      status:   { $in: ['active', 'completed', 'trial'] },
      createdAt: { $gte: start, $lte: end }
    })
      .populate('userId', 'name')
      .lean();

    const commissionRate = commission.commission_rate || 5;
    const orderBreakdown = orders.map(o => ({
      orderDate:     o.createdAt,
      customerName:  o.userId?.name || 'Customer',
      planType:      o.planType,
      grossAmount:   o.amount || 0,
      commissionCut: Math.round((o.amount || 0) * commissionRate / 100),
      netAmount:     (o.amount || 0) - Math.round((o.amount || 0) * commissionRate / 100)
    }));

    generateSettlementInvoicePDF(res, {
      settlementId:     commission._id,
      vendorName:       vendor.kitchenName,
      vendorAddress:    vendor.address,
      weekStart:        commission.weekStart,
      weekEnd:          commission.weekEnd,
      orders:           orderBreakdown,
      grossEarnings:    commission.total_earning,
      commissionRate,
      commissionAmount: commission.commission_amount,
      netEarnings:      commission.total_earning - commission.commission_amount,
      commissionStatus: commission.status,
      dueDate:          commission.due_date,
      generatedAt:      new Date()
    });
  } catch (err) {
    console.error('[downloadSettlementInvoice]', err);
    return res.status(500).json({ message: err.message });
  }
}
