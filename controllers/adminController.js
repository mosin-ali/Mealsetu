const Vendor = require('../models/Vendor');
const User = require('../models/User');
const PlatformSetting = require('../models/PlatformSetting');
const { sendEmail } = require('../utils/emailUtils');

// @desc    Get platform settings (commission rate, etc)
// @route   GET /api/admin/settings
const getPlatformSettings = async (req, res) => {
  try {
    let settings = await PlatformSetting.findOne();
    if (!settings) {
      settings = await PlatformSetting.create({ commissionRate: 10 });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update commission rate
// @route   PUT /api/admin/settings/commission
const updateCommissionRate = async (req, res) => {
  try {
    const { commissionRate } = req.body;
    let settings = await PlatformSetting.findOne();
    if (!settings) {
      settings = await PlatformSetting.create({ commissionRate });
    } else {
      settings.commissionRate = commissionRate;
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all users


const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all pending vendor requests
// @route   GET /api/admin/vendor-requests
const getPendingVendors = async (req, res) => {
  try {
    console.log('🔍 Fetching pending vendors - STRICT QUERY ONLY');

    const vendors = await Vendor.find({ 
      status: 'pending', 
      isApproved: { $ne: true } 
    })
    .sort({ 
      resubmittedAt: -1,  // Resubmissions first
      createdAt: -1       // Then newest first
    })
    .select('-password')
    .populate('ownerId', 'name email phone');

    console.log(`✅ Found ${vendors.length} pending vendors:`, vendors.map(v => `Kitchen: ${v.kitchenName}, Status: ${v.status}, isApproved: ${v.isApproved}`));
    return res.status(200).json({ vendors });

  } catch (error) {
    console.error('❌ getPendingVendors error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};


// @desc    Approve vendor request
// @route   POST /api/admin/vendor-requests/approve
const approveVendor = async (req, res) => {
  try {
    const { vendorId } = req.body;
    console.log('🔄 Approving vendorId:', vendorId);
    if (!vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { $set: { isApproved: true, status: 'approved', approvalStatus: 'Approved' } },
      { new: true, runValidators: false }
    ).populate('ownerId', 'name email');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    console.log('Vendor approved in DB:', vendor._id, 'isApproved:', vendor.isApproved, 'status:', vendor.status);
    try {
      const toEmail = vendor.email || vendor.ownerId?.email;
      if (toEmail) {
        await sendEmail(
          toEmail,
          'Your MealSetu Vendor Account is Approved',
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#f26522;padding:30px;text-align:center">
              <h1 style="color:white;margin:0">MealSetu</h1>
            </div>
            <div style="background:white;padding:30px">
              <h2 style="color:#16a34a">Congratulations! Your Kitchen is Now Live</h2>
              <p>Dear ${vendor.kitchenName || 'Vendor'},</p>
              <p>Your vendor account has been approved. Your kitchen is now visible to users on MealSetu.</p>
              <p>Login to your vendor dashboard to start managing your menu and orders.</p>
            </div>
          </div>`
        );
      }
    } catch (emailErr) {
      console.error('Email failed:', emailErr.message);
    }
    return res.status(200).json({ message: 'Vendor approved successfully', vendor });
  } catch (error) {
    console.error('approveVendor error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Reject vendor request
// @route   POST /api/admin/vendor-requests/reject
const rejectVendor = async (req, res) => {
  try {
    const { vendorId, rejectionReason } = req.body;

    if (!vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    console.log('Rejecting vendor:', vendorId, 'Reason:', rejectionReason);

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        $set: {
          isApproved: false,
          status: 'rejected',
          approvalStatus: 'Rejected',
          rejectionReason: rejectionReason.trim()
        }
      },
      { new: true, runValidators: false }
    ).populate('ownerId', 'name email');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    console.log('Vendor rejected in DB successfully. Status:', vendor.status, 'isApproved:', vendor.isApproved, 'rejectionReason:', vendor.rejectionReason);

    try {
      const toEmail = vendor.email || vendor.ownerId?.email;
      if (toEmail) {
        await sendEmail(
          toEmail,
          'Update on Your MealSetu Vendor Application',
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#f26522;padding:30px;text-align:center;border-radius:10px 10px 0 0">
              <h1 style="color:white;margin:0">MealSetu</h1>
            </div>
            <div style="background:white;padding:30px;border-radius:0 0 10px 10px">
              <h2 style="color:#ef4444">Application Update</h2>
              <p>Dear ${vendor.kitchenName || 'Vendor'},</p>
              <p>We have reviewed your vendor application and could not approve it at this time.</p>
              <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:20px 0;border-radius:0 8px 8px 0">
                <strong>Reason for Rejection:</strong><br/><br/>${rejectionReason.trim()}
              </div>
              <p>Please address the above concerns and submit your application again from the Compliance section of your vendor dashboard.</p>
              <p style="color:#64748b;font-size:13px;margin-top:20px">Thank you for your interest in MealSetu.</p>
            </div>
          </div>`
        );
      }
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return res.status(200).json({
      message: 'Vendor rejected successfully',
      vendor: vendor
    });

  } catch (error) {
    console.error('rejectVendor error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getPlatformSettings, updateCommissionRate, getPendingVendors, getAllUsers, approveVendor, rejectVendor };

