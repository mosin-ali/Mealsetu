const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getPlatformSettings, updateCommissionRate, getPendingVendors, updateVendorStatus, getAllUsers } = require('../controllers/adminController');

const router = express.Router();

// All routes require Admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/settings', getPlatformSettings);
router.put('/settings/commission', updateCommissionRate);
router.get('/vendors/pending', getPendingVendors);
router.put('/vendors/:id/status', updateVendorStatus);
router.get('/users', getAllUsers);

module.exports = router;