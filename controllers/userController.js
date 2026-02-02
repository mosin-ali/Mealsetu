const Menu = require('../models/Menu');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Vendor = require('../models/Vendor');

// @desc    Get All Menus for a specific date
// @route   GET /api/users/menus?date=2026-02-05
const getMenus = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    // Find menus and populate vendor details (Kitchen Name)
    const menus = await Menu.find({ date }).populate('vendorId', 'kitchenName address');
    res.json(menus);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Place an Order
// @route   POST /api/users/order
const placeOrder = async (req, res) => {
  try {
    const { vendorId, items, amount, deliverySlot, mealPreference } = req.body;
    
    const order = await Order.create({
      userId: req.user._id,
      vendorId,
      amount,
      deliverySlot,
      mealPreference,
      paymentStatus: 'Pending' // Simulating payment gateway logic
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error placing order' });
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

module.exports = { getMenus, placeOrder, addReview };