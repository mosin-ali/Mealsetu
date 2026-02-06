const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Get current user profile
// @route   GET /api/users/me
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
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
    res.json(user);
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

    // Verify current password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
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
    // normalize to day range (start/end)
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);

    // Find menus for the day that are live and populate vendor details
    const menus = await Menu.find({ date: { $gte: start, $lte: end }, isLive: true }).populate('vendorId');

    // Map menus to include vendor-friendly fields (with sensible defaults)
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
        timings: v.timings || '11:00 AM - 09:00 PM'
      };
    });

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Place an Order
// @route   POST /api/users/order
const placeOrder = async (req, res) => {
  try {
    const { vendorId, items = [], amount, deliverySlot = 'Lunch', mealPreference } = req.body;

    // Basic validation
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

    const order = await Order.create({
      userId: req.user._id,
      vendorId,
      amount: numericAmount,
      deliverySlot,
      mealPreference: mealPref,
      paymentStatus: 'Pending' // Simulating payment gateway logic
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ message: 'Error placing order', error: error.message });
  }
};

// @desc    Add Review
// @route   POST /api/users/review
const addReview = async (req, res) => {
  try {
    const { vendorId, rating, comment } = req.body;
    const review = await Review.create({
      userId: req.user._id,
      vendorId,
      rating,
      comment
    });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: 'Error adding review' });
  }
};

module.exports = { getCurrentUser, updateUserProfile, changePassword, getMenus, getUserOrders, placeOrder, addReview };