const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  kitchenName: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },
  fssaiLicense: { type: String }, // URL/Path to file
  gstDocument: { type: String },  // URL/Path to file
  approvalStatus: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  walletBalance: { type: Number, default: 0 },
  isOpen: { type: Boolean, default: true }
});

module.exports = mongoose.model('Vendor', vendorSchema);