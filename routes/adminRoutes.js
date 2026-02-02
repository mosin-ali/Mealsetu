const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getPendingVendors, updateVendorStatus, getAllUsers } = require('../controllers/adminController');

const router = express.Router();

// All routes require Admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/vendors/pending', getPendingVendors);
router.put('/vendors/:id/status', updateVendorStatus);
router.get('/users', getAllUsers);

module.exports = router;