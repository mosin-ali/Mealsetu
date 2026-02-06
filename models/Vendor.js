const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // --- Profile Info [cite: 70] ---
  kitchenName: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String },
  profileImage: { type: String },
  isOpen: { type: Boolean, default: true },
  
  // --- Compliance & Documents [cite: 70, 82] ---
  fssaiNumber: { type: String },
  fssaiLicense: { type: String }, // File URL
  gstDocument: { type: String },  // File URL
  
  // --- Status & Wallet [cite: 70, 82] ---
  approvalStatus: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  rejectionReason: { type: String }, // For Vendor Requests Queue
  submittedDate: { type: Date, default: Date.now },
  
  walletBalance: { type: Number, default: 0 } // Stores "Pending Payout"
  ,
  // Optional display fields
  menuPrice: { type: Number, default: 80 },
  rating: { type: Number, default: 4.5 },
  workingDays: { type: String, default: 'Mon - Sat' },
  timings: { type: String, default: '11:00 AM - 09:00 PM' }
});

module.exports = mongoose.model('Vendor', vendorSchema);