const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getMenus, placeOrder, addReview } = require('../controllers/userController');

const router = express.Router();

// Public route (anyone can see menus)
router.get('/menus', getMenus);

// Protected routes (User only)
router.post('/order', protect, authorize('user'), placeOrder);
router.post('/review', protect, authorize('user'), addReview);

module.exports = router;