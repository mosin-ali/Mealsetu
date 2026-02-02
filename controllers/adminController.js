const Vendor = require('../models/Vendor');
const User = require('../models/User');

// @desc    Get all Vendor Requests (Pending)
// @route   GET /api/admin/vendors/pending
const getPendingVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ approvalStatus: 'Pending' }).populate('ownerId', 'name email phone');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Approve or Reject Vendor
// @route   PUT /api/admin/vendors/:id/status
const updateVendorStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // status: 'Approved' or 'Rejected'
    
    const vendor = await Vendor.findByIdAndUpdate(
        req.params.id, 
        { approvalStatus: status, rejectionReason },
        { new: true }
    );
    
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get All Users
// @route   GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getPendingVendors, updateVendorStatus, getAllUsers };