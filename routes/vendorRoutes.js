const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { addMenu, getVendorOrders, updateOrderStatus } = require('../controllers/vendorController');

const router = express.Router();

// All routes here require login AND 'vendor' role
router.use(protect);
router.use(authorize('vendor'));

router.post('/menu', addMenu);
router.get('/orders', getVendorOrders);
router.put('/orders/:id', updateOrderStatus);

module.exports = router;