const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getVendorProfile, updateVendorProfile, getVendorMenus, addMenu, getVendorOrders, updateOrderStatus, getVendorReviews, getVendorCustomers, getVendorComplaints, resolveComplaint, getVendorReports } = require('../controllers/vendorController');

const router = express.Router();

// All routes here require login AND 'vendor' role
router.use(protect);
router.use(authorize('vendor'));

router.get('/me', getVendorProfile);
router.put('/me', updateVendorProfile);
router.get('/menus', getVendorMenus);
router.post('/menu', addMenu);
router.get('/orders', getVendorOrders);
router.put('/orders/:id', updateOrderStatus);
router.get('/reviews', getVendorReviews);
// Additional vendor endpoints
router.get('/customers', getVendorCustomers);
router.get('/complaints', getVendorComplaints);
router.put('/complaints/:id', resolveComplaint);
router.get('/reports', getVendorReports);

module.exports = router;