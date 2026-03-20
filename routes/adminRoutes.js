const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { 
  getPlatformSettings, 
  updateCommissionRate, 
  getPendingVendors, 
  getAllUsers, 
  approveVendor, 
  rejectVendor, 
  getAllVendorsForAdmin, 
  getVendorSubscribers, 
  getAdminProfile, 
  updateAdminProfile, 
  getPublicAdminContact, 
  getAllCommissions, 
  getCommissionSummary, 
  markCommissionPaid,
  getCommissionTiers,
  updateCommissionTiers,
  getCommissionVendors,
  getCommissionReportCSV,
  seedDefaultTiers,
  verifyCommissionPayment
} = require('../controllers/adminController');
const router = express.Router();

// All routes require Admin role
router.get('/public-contact', getPublicAdminContact);

router.use(protect);
router.use(authorize('admin'));

router.get('/settings', getPlatformSettings);
router.put('/settings/commission', updateCommissionRate);
router.get('/vendor-requests', getPendingVendors);
router.post('/vendor-requests/approve', approveVendor);
router.post('/vendor-requests/reject', rejectVendor);
router.get('/users', getAllUsers);
router.get('/vendors-stats', getAllVendorsForAdmin);
router.get('/vendor-subscribers/:vendorId', getVendorSubscribers);

// One-time cleanup route for vendor statuses
router.get('/fix-vendors', async (req, res) => {
  try {
    const Vendor = require('../models/Vendor');
    await Vendor.updateMany(
      { status: { $in: [null, undefined, ''] } },
      { $set: { status: 'pending', isApproved: false, approvalStatus: 'Pending' } }
    );
    await Vendor.updateMany(
      { isApproved: { $exists: false } },
      { $set: { isApproved: false, status: 'pending' } }
    );
    const allVendors = await Vendor.find({}).select('kitchenName status isApproved');
    res.json({ message: 'Fixed', vendors: allVendors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/fix-vendor-statuses', async (req, res) => {
  try {
    const Vendor = require('../models/Vendor');
    const result = await Vendor.updateMany(
      { isApproved: { $exists: false } },
      { $set: { isApproved: false, status: 'pending', approvalStatus: 'Pending' } }
    );
    const result2 = await Vendor.updateMany(
      { isApproved: null },
      { $set: { isApproved: false, status: 'pending', approvalStatus: 'Pending' } }
    );
    const result3 = await Vendor.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'pending', approvalStatus: 'Pending' } }
    );
    console.log('Fixed vendor statuses:', result, result2, result3);
    res.json({ message: 'Vendor statuses fixed', result, result2, result3 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);

// Commission routes
router.get('/commissions', getAllCommissions);
router.get('/commissions/summary', getCommissionSummary);
router.put('/commissions/:id/mark-paid', markCommissionPaid);

// Commission tiers
router.get('/commission/tiers', getCommissionTiers);
router.put('/commission/tiers', updateCommissionTiers);

// Commission vendors overview
router.get('/commission/vendors', getCommissionVendors);

// Commission reports
router.get('/commission/report/csv', getCommissionReportCSV);

// Commission seed (one-time)
router.post('/commission/seed-tiers', seedDefaultTiers);

// Commission payment verification
router.post('/commission/verify/:paymentId', verifyCommissionPayment);

module.exports = router;
