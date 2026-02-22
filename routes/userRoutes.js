const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getCurrentUser, updateUserProfile, updateUserProfilePic, changePassword, getMenus, getUserOrders, placeOrder, addReview, applyLeave, getUserSubscription, extendSubscription } = require('../controllers/userController');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public route (anyone can see menus)
router.get('/menus', getMenus);

// Protected routes (User only)
router.get('/me', protect, getCurrentUser);
router.get('/subscription', protect, authorize('user'), getUserSubscription);
router.put('/:id', protect, updateUserProfile);
router.put('/:id/profile-pic', protect, upload.single('profilePic'), updateUserProfilePic);
router.post('/:id/change-password', protect, changePassword);
router.get('/orders', protect, authorize('user'), getUserOrders);
router.post('/order', protect, authorize('user'), placeOrder);
router.post('/review', protect, authorize('user'), addReview);
router.post('/apply-leave', protect, authorize('user'), applyLeave);
router.post('/extend-subscription', protect, authorize('user'), extendSubscription);

module.exports = router;
