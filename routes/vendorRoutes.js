const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getVendorProfile, updateVendorProfile, updateVendorProfilePic, updateKitchenPoster, getVendorMenus, addMenu, getVendorOrders, getFilteredOrders, updateOrderStatus, getVendorReviews, getVendorCustomers, getVendorComplaints, resolveComplaint, getVendorReports, getDashboardStats, saveWeeklyPlan, getWeeklyPlan, toggleShopStatus, getShopStatus, updateTrialSettings, submitVendorCompliance, getPendingPayout, getMyCommissions, payCommission, getCommissionSummary, getJainMenu, saveJainMenu, getPricing, savePricing, getVendorWeeklyPlan, addManualCustomer, getManualCustomers, calculateManualOrderAmount, getCashPayments, markCashPaymentPaid } = require('../controllers/vendorController');
const { createOffer, getVendorOffers, deleteOffer } = require('../controllers/offerController');
const { getPreparationList } = require('../controllers/preparationController');

const router = express.Router();

// All routes here require login AND 'vendor' role
router.use(protect);
router.use(authorize('vendor'));

router.get('/me', getVendorProfile);
router.put('/me', updateVendorProfile);
router.put('/me/profile-pic', upload.single('profilePic'), updateVendorProfilePic);
router.put('/me/kitchen-poster', upload.single('kitchenPoster'), updateKitchenPoster);
router.get('/menus', getVendorMenus);
router.post('/menu', addMenu);
router.get('/orders', getVendorOrders);
router.get('/orders/filtered', getFilteredOrders);
router.put('/orders/:id', updateOrderStatus);
router.get('/reviews', getVendorReviews);
// Additional vendor endpoints
router.get('/customers', getVendorCustomers);
router.get('/complaints', getVendorComplaints);
router.put('/complaints/:id', resolveComplaint);
router.get('/reports', getVendorReports);
// Dashboard stats endpoint
router.get('/dashboard-stats', getDashboardStats);

// Weekly plan endpoints (Batch Save) - require vendor authentication
router.get('/weekly-plan', getWeeklyPlan);
router.put('/weekly-plan', saveWeeklyPlan);

// Jain menu endpoints
router.get('/jain-menu', getJainMenu);
router.post('/jain-menu', saveJainMenu);

// Pricing endpoints
router.get('/pricing', getPricing);
router.post('/pricing', savePricing);

// Shop status endpoints (Open/Close shop)
router.get('/shop-status', getShopStatus);
router.put('/shop-status', toggleShopStatus);

// Offer endpoints
router.get('/offers', getVendorOffers);
router.post('/offers', upload.single('posterImage'), createOffer);
router.delete('/offers/:id', deleteOffer);

// Trial Settings endpoint
router.patch('/trial-settings', updateTrialSettings);

// Compliance submission endpoint
router.post('/compliance-submit', upload.fields([{ name: 'fssaiDoc', maxCount: 1 }, { name: 'gstDoc', maxCount: 1 }]), submitVendorCompliance);

// Commission endpoints
router.get('/commission/summary', getCommissionSummary);
router.get('/commission/history', getMyCommissions); // paginated later
router.post('/commission/pay', upload.single('proof'), payCommission);

router.get('/preparation-list', getPreparationList);

// Manual Customer routes
router.post('/manual-customer', addManualCustomer);
router.get('/manual-customers', getManualCustomers);
router.get('/manual-customer/calculate', calculateManualOrderAmount);

// Cash payment management routes
router.get('/cash-payments', getCashPayments);
router.patch('/cash-payments/:orderId/mark-paid', markCashPaymentPaid);

module.exports = router;
