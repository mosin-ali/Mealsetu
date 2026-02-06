const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getCurrentUser, updateUserProfile, changePassword, getMenus, getUserOrders, placeOrder, addReview } = require('../controllers/userController');

const router = express.Router();

// Public route (anyone can see menus)
router.get('/menus', getMenus);

// Protected routes (User only)
router.get('/me', protect, getCurrentUser);
router.put('/:id', protect, updateUserProfile);
router.post('/:id/change-password', protect, changePassword);
router.get('/orders', protect, authorize('user'), getUserOrders);
router.post('/order', protect, authorize('user'), placeOrder);
router.post('/review', protect, authorize('user'), addReview);

module.exports = router;