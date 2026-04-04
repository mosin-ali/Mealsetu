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

    const customerIds = customerAggregation.map(c => c._id);
    const users = await User.find({ _id: { $in: customerIds } })
      .select('name email phone');

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
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Vendor Orders
// @route   GET /api/vendor/orders
const getVendorOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    const orders = await Order.find({ vendorId: vendor._id })
      .populate('userId', 'name phone');
    res.json(orders);
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

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order._id,
      username: order.userId?.name || order.customerName || 'Unknown',
      customerName: order.customerName || order.userId?.name || 'Unknown',
      amount: Number(order.amount) || 0,
      paymentMethod: order.paymentMethod || 'Cash',
      planType: order.planType || 'Trial',
      mealPreference: order.mealPreference || 'Regular',
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

// @desc    Update Order Status
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

// @desc    Get Jain Menu Settings
// @route   GET /api/vendor/jain-menu
// const getJainMenu = async (req, res) => {
//   try {
//     const vendor = await Vendor.findOne({ ownerId: req.user._id });
//     if (!vendor) {
//       return res.status(404).json({ message: 'Vendor profile not found' });
//     }
//     res.json({
//       success: true,
//       offersJainMenu: vendor.offersJainMenu || false,
//       jainWeeklyPlan: vendor.jainWeeklyPlan || {}
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Server Error', error: error.message });
//   }
// };

// @desc    Update Jain Menu Settings
// @route   POST /api/vendor/jain-menu
const updateJainMenu = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const { offers_jain_menu, jain_menu } = req.body;

    // Validate 7 days present
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!jain_menu || !Array.isArray(jain_menu) || jain_menu.length !== 7) {
      return res.status(400).json({ success: false, message: 'jain_menu must be array of exactly 7 days' });
    }

    // Validate main_course required when enabled
    if (offers_jain_menu) {
      for (let i = 0; i < 7; i++) {
        if (!jain_menu[i].main_course || jain_menu[i].main_course.trim() === '') {
          return res.status(400).json({ success: false, message: `Main course required for day ${DAYS[i]}` });
        }
      }
    }

    // Update vendors table
    vendor.offersJainMenu = offers_jain_menu;
    await vendor.save();

    // Simple delete + insert (no transaction)
    await JainMenu.deleteMany({ vendor_id: vendor._id.toString() });
    if (jain_menu.length > 0) {
      const jainMenuDocs = jain_menu.map((dayData, index) => ({
        vendor_id: vendor._id,
        day: DAYS[index],
        main_course: dayData.main_course || null,
        alt_sabji: dayData.alt_sabji || null,
        alt_sabji2: dayData.alt_sabji2 || null,
        sides: dayData.sides || null,
        special_addons: dayData.special_addons || null
      }));
      await JainMenu.insertMany(jainMenuDocs);
    }

    res.json({
      success: true,
      message: 'Jain menu updated successfully',
      offersJainMenu: offers_jain_menu,
      jainMenu: jain_menu
    });
  } catch (error) {
    console.error('Jain menu update error:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get Vendor Pricing
// @route   GET /api/vendor/pricing
const getVendorPricing = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    let pricingData = await VendorPricing.find({ vendor_id: vendor._id });
    
    // Fallback to Vendor.pricing if VendorPricing is empty
    if (pricingData.length === 0 && vendor.pricing && vendor.pricing.length > 0) {
      pricingData = vendor.pricing.map(p => ({
        plan_type: p.type,
        price: p.price,
        is_active: p.active
      }));
    }
    
    const pricingMap = {};

    ['daily', 'weekly', 'monthly'].forEach(planType => {
      const plan = pricingData.find(p => p.plan_type === planType);
      pricingMap[planType] = plan ? {
        price: plan.price,
        is_active: plan.is_active
      } : { price: null, is_active: false };
    });

    res.json({
      success: true,
      pricing: pricingMap
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Update Vendor Pricing
// @route   POST /api/vendor/pricing
const updateVendorPricing = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    let pricing = req.body.pricing;

    // ✅ FIX: Handle both array format from frontend AND object format
    let pricingObj = {};
    if (Array.isArray(pricing)) {
      // Convert array [{type:'daily', price:80, active:true}] → {daily: {price:80, is_active:true}}
      pricing.forEach(plan => {
        if (plan.type && plan.price !== undefined && plan.active !== undefined) {
          pricingObj[plan.type] = {
            price: Number(plan.price),
            is_active: Boolean(plan.active)
          };
        }
      });
      pricing = pricingObj;
    } else if (pricing && typeof pricing === 'object' && !Array.isArray(pricing)) {
      // Already object format, validate keys
      pricing = pricing;
    } else {
      return res.status(400).json({ success: false, message: 'pricing must be array or object' });
    }

    console.log('updateVendorPricing - converted pricing:', pricing);

    const planTypes = ['daily', 'weekly', 'monthly'];
    const activePlans = [];
    const invalidPlans = [];

    planTypes.forEach(planType => {
      const plan = pricing[planType] || { price: null, is_active: false };
      if (plan.is_active) {
        activePlans.push(planType);
        if (!plan.price || plan.price <= 0 || plan.price > 99999 || !Number.isInteger(plan.price)) {
          invalidPlans.push(`${planType} price must be integer 1-99999`);
        }
      }
    });

    if (activePlans.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one plan must be active' });
    }

    if (invalidPlans.length > 0) {
      return res.status(400).json({ success: false, message: invalidPlans.join('; ') });
    }

    // Delete existing pricing records
    await VendorPricing.deleteMany({ vendor_id: vendor._id.toString() });
    
    // Create new pricing documents from object format
    const pricingDocs = [];
    planTypes.forEach(planType => {
      const plan = pricing[planType];
      pricingDocs.push({
        vendor_id: vendor._id,
        plan_type: planType,
        price: plan.price || null,
        is_active: plan.is_active || false
      });
    });
    
    await VendorPricing.insertMany(pricingDocs);

    // Sync to Vendor.pricing embedded array (array format)
    const vendorPricingArray = pricingDocs.map(doc => ({
      type: doc.plan_type,
      price: doc.price,
      active: doc.is_active
    }));
    await Vendor.findByIdAndUpdate(vendor._id, { $set: { pricing: vendorPricingArray } });

    res.json({
      success: true,
      message: 'Pricing updated successfully',
      pricing: pricingObj  // Return converted object format for frontend consistency
    });
  } catch (error) {
    console.error('Pricing update error:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
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
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }
    res.json({ pricing: vendor.pricing });
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
        invalidPlans: invalidPlans.map(p => ({ type: p.type, price: p.price }))
      });
    }

    // Validation 2: No duplicate plan types
    const types = pricing.map(p => p.type);
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

    vendor.pricing = pricing;
    await vendor.save();

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
    res.json({
      isOpen: vendor.isOpen,
      closureStartDate: vendor.closureStartDate,
      closureEndDate: vendor.closureEndDate
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

// @desc    Get vendor commission summary (current week)
// @route   GET /api/vendor/commission/summary
const getCommissionSummary = async (req, res) => {
  try {
    // STEP 1: Get real vendor using ownerId
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    const vendorId = vendor._id;

    // STEP 2: Current WEEK range (Monday to Sunday)
    const now = new Date();

    // Get Monday of current week
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...6=Sat
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get Sunday of current week
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Week key like "2026-W12" for database
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      (((startOfWeek - startOfYear) / 86400000) + 1) / 7
    );
    const currentMonth = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

    // Week label like "20 Mar - 26 Mar 2026"
    const weekLabel = `${startOfWeek.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short'
    })} - ${endOfWeek.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })}`;

    console.log('Commission Summary vendorId:', vendorId);
    console.log('Week range:', startOfWeek, '->', endOfWeek);
    console.log('Week key:', currentMonth);

    // STEP 3: Sum ALL orders this week for this vendor
    const allOrders = await Order.find({
      vendorId: vendorId,
      orderDate: { $gte: startOfWeek, $lte: endOfWeek }
    });

    console.log('All orders this week:', allOrders.length);

    const totalEarning = allOrders.reduce((sum, order) => {
      return sum + (order.amount || 0);
    }, 0);

    console.log('Total earning this week:', totalEarning);

    // STEP 4: Find correct commission tier
    let commissionRate = 3;
    let tierName = 'Starter';

    const tiers = await CommissionSetting.find({ isActive: true })
      .sort({ minEarning: 1 });

    console.log('Tiers found:', tiers.length);

    if (tiers.length > 0) {
      for (const tier of tiers) {
        if (
          totalEarning >= tier.minEarning &&
          (tier.maxEarning === null || totalEarning <= tier.maxEarning)
        ) {
          commissionRate = tier.ratePercent;
          tierName = tier.tierName;
          break;
        }
      }
    }

    // STEP 5: Calculate commission amounts
    const commissionDue = Math.round(totalEarning * commissionRate / 100);
    const netPayout = totalEarning - commissionDue;

    // STEP 6: Check existing commission record for this week
    const existingCommission = await Commission.findOne({
      vendorId: vendorId,
      month: currentMonth
    });

    const status = existingCommission
      ? existingCommission.status
      : 'not_generated';

    console.log('Commission response:', {
      totalEarning,
      commissionRate,
      commissionDue,
      netPayout
    });

    // STEP 7: Send response
    res.status(200).json({
      total_earning: totalEarning,
      commission_rate: commissionRate,
      commission_due: commissionDue,
      net_payout: netPayout,
      tier_name: tierName,
      current_month: weekLabel,
      month: currentMonth,
      status: status,
      orders_count: allOrders.length
    });

  } catch (error) {
    console.error('getCommissionSummary error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
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
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(200).json({ commissions: [], total: 0 });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const commissions = await Commission.find({ vendorId: vendor._id })
      .sort({ month: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Commission.countDocuments({ vendorId: vendor._id });

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

// @desc    Vendor submits commission payment proof
// @route   POST /api/vendor/commission/pay
const payCommission = async (req, res) => {
  try {
    const CommissionPayment = require('../models/CommissionPayment');

    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const { commissionId, paymentMethod, transactionId } = req.body;
    const proofFile = req.file;

    const commission = await Commission.findOne({
      _id: commissionId,
      vendorId: vendor._id
    });

    if (!commission) {
      return res.status(404).json({ message: 'Commission record not found' });
    }

    let proofUrl = null;
    if (proofFile) {
      proofUrl = `/uploads/commission-proofs/${proofFile.filename}`;
    }

    const payment = await CommissionPayment.create({
      vendorEarningId: commission._id,
      vendorId: vendor._id,
      amount_paid: commission.commission_amount,
      payment_method: paymentMethod || 'upi',
      utr_number: transactionId || '',
      proof_url: proofUrl,
      paid_at: new Date(),
      verified_by_admin: false
    });

    commission.status = 'pending_verification';
    commission.payment_proof_url = proofUrl;
    commission.payment_date = new Date();
    await commission.save();

    try {
      const vendorWithOwner = await Vendor.findById(vendor._id)
        .populate('ownerId', 'email name');
      if (vendorWithOwner?.ownerId?.email) {
        await sendEmail(
          vendorWithOwner.ownerId.email,
          'Commission Payment Submitted - MealSetu',
          `<div style="font-family: Arial, sans-serif;">
            <h2 style="color: #f97316;">Payment Proof Submitted</h2>
            <p>Amount: ₹${commission.commission_amount}</p>
            <p>Week: ${commission.month}</p>
            <p>Status: Pending Admin Verification</p>
          </div>`
        );
      }
    } catch (emailErr) {
      console.error('Email failed:', emailErr.message);
    }

    res.status(200).json({
      message: 'Payment proof submitted. Awaiting admin verification.',
      payment
    });

  } catch (error) {
    console.error('payCommission error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ===== END COMMISSION FUNCTIONS =====

// module.exports = {
//   getVendorProfile,
//   updateVendorProfile,
//   updateVendorProfilePic,
//   updateKitchenPoster,
//   getVendorMenus,
//   addMenu,
//   getVendorOrders,
//   getFilteredOrders,
//   updateOrderStatus,
//   getVendorReviews,
//   getVendorCustomers,
//   getVendorComplaints,
//   resolveComplaint,
//   getVendorReports,
//   getDashboardStats,
//   saveWeeklyPlan,
//   getWeeklyPlan,
//   getJainMenu,
//   saveJainMenu,
//   getPricing,
//   savePricing,
//   getVendorWeeklyPlan,
//   toggleShopStatus,
//   getShopStatus,
//   updateTrialSettings,
//   submitVendorCompliance,
//   getCommissionSummary,
//   getPendingPayout,
//   getMyCommissions,
//   payCommission,
// };

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

  // ✅ Jain
  getJainMenu,
  saveJainMenu,
  updateJainMenu, // 🔥 ADD THIS

  // ✅ Pricing
  getVendorPricing, // 🔥 ADD THIS (you already created it above)
  updateVendorPricing, // 🔥 ADD THIS

  getVendorWeeklyPlan,
  toggleShopStatus,
  getShopStatus,
  updateTrialSettings,
  submitVendorCompliance,
  getCommissionSummary,
  getPendingPayout,
  getMyCommissions,
  payCommission,
};

