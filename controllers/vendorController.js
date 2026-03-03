const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Subscription = require('../models/Subscription');
const Payout = require('../models/Payout');

// @desc    Get vendor profile
// @route   GET /api/vendor/me
const getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id }).populate('ownerId', '-password');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    res.json(vendor);
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

    res.json(vendor);
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

// @desc    Get vendor customers (unique users who ordered from this vendor)
// @route   GET /api/vendor/customers
const getVendorCustomers = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const orders = await Order.find({ vendorId: vendor._id }).populate('userId', 'name email phone');
    const map = {};
    orders.forEach(o => {
      if (o.userId) map[o.userId._id] = o.userId;
    });
    const customers = Object.values(map);
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
    const reviews = await Review.find({ vendorId: vendor._id }).populate('userId', 'name').sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
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

// @desc    Get Dashboard Stats (Total Revenue, Today's Orders, Active Subscribers)
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

    res.json({
      totalRevenue,
      todayOrders,
      activeSubscribers,
      pendingPayout
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

module.exports = {
  getVendorProfile,
  updateVendorProfile,
  getVendorMenus,
  addMenu,
  getVendorOrders,
  updateOrderStatus,
  getVendorReviews,
  getVendorCustomers,
  getVendorComplaints,
  resolveComplaint,
  getVendorReports,
  getDashboardStats,
  saveWeeklyPlan,
  getWeeklyPlan,
  getVendorWeeklyPlan
};
