const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getVendorProfile, updateVendorProfile, updateVendorProfilePic, getVendorMenus, addMenu, getVendorOrders, getFilteredOrders, updateOrderStatus, getVendorReviews, getVendorCustomers, getVendorComplaints, resolveComplaint, getVendorReports, getDashboardStats, saveWeeklyPlan, getWeeklyPlan, getVendorWeeklyPlan, toggleShopStatus, getShopStatus } = require('../controllers/vendorController');

const router = express.Router();

// All routes here require login AND 'vendor' role
router.use(protect);
router.use(authorize('vendor'));

router.get('/me', getVendorProfile);
router.put('/me', updateVendorProfile);
router.put('/me/profile-pic', upload.single('profilePic'), updateVendorProfilePic);
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

// Shop status endpoints (Open/Close shop)
router.get('/shop-status', getShopStatus);
router.put('/shop-status', toggleShopStatus);

module.exports = router;
