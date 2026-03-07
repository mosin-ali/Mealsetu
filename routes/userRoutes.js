const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getCurrentUser, getActiveSubscriptionStatus, updateUserProfile, updateUserProfilePic, changePassword, getMenus, getUserOrders, placeOrder, addReview, applyLeave, getUserSubscription, extendSubscription, getVendorStatus, getVendorReviews, getVendorRating, checkReviewEligibility, getApprovedVendors, createTrialOrder, getTrialEligibility, getMySubscription, getUpcomingOrders, extendSubscriptionOrder } = require('../controllers/userController');
const { getActiveOffers, redeemOffer } = require('../controllers/offerController');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public route (anyone can see menus)
router.get('/menus', getMenus);

// Public route to get all approved vendors (for user side)
router.get('/vendors', getApprovedVendors);

// Public route to get vendor status (open/close)
router.get('/vendor-status/:vendorId', getVendorStatus);

// Public route to get vendor reviews (for user view)
router.get('/vendor-reviews/:vendorId', getVendorReviews);

// Public route to get vendor rating (dynamic average)
router.get('/vendor-rating/:vendorId', getVendorRating);

// Protected routes (User only)
router.get('/me', protect, getCurrentUser);
router.get('/subscription', protect, authorize('user'), getUserSubscription);
router.get('/subscription-status', protect, authorize('user'), getActiveSubscriptionStatus);
router.put('/:id', protect, updateUserProfile);
router.put('/:id/profile-pic', protect, upload.single('profilePic'), updateUserProfilePic);
router.post('/:id/change-password', protect, changePassword);
router.get('/orders', protect, authorize('user'), getUserOrders);
router.post('/order', protect, authorize('user'), placeOrder);
router.post('/review', protect, authorize('user'), addReview);
router.get('/review-eligibility/:vendorId', protect, authorize('user'), checkReviewEligibility);
router.post('/apply-leave', protect, authorize('user'), applyLeave);
router.post('/extend-subscription', protect, authorize('user'), extendSubscription);

// Offer routes for users
router.get('/active-offers', protect, authorize('user'), getActiveOffers);
router.post('/redeem-offer', protect, authorize('user'), redeemOffer);

// Trial routes
router.post('/trial', protect, authorize('user'), createTrialOrder);
router.get('/trial-eligibility/:vendorId', protect, authorize('user'), getTrialEligibility);
router.get('/subscription-status', protect, authorize('user'), getActiveSubscriptionStatus);

// Order routes for subscription management
router.get('/orders/my-subscription', protect, authorize('user'), getMySubscription);
router.get('/orders/upcoming', protect, authorize('user'), getUpcomingOrders);
router.post('/orders/extend', protect, authorize('user'), extendSubscriptionOrder);

module.exports = router;
