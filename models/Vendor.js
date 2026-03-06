const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // --- Profile Info ---
  kitchenName: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String },
  profileImage: { type: String },
  kitchenPoster: { type: String }, // Kitchen Banner/Poster Image
  isOpen: { type: Boolean, default: true },
  
  // --- Compliance & Documents ---
  fssaiNumber: { type: String },
  fssaiLicense: { type: String }, // File URL
  gstDocument: { type: String },  // File URL
  
  // --- Status & Wallet ---
  closureStartDate: { type: Date }, // Tracks when shop was closed
  closureEndDate: { type: Date },   // Optional: when shop is expected to reopen
  
  approvalStatus: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  rejectionReason: { type: String },
  submittedDate: { type: Date, default: Date.now },
  
  walletBalance: { type: Number, default: 0 },
  
  // --- Weekly Menu Plan (Structured JSON for 7 days) ---
  weeklyPlan: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      Monday: { mainCourse: '', altSabji: '', sides: '', specialAddOns: '' },
      Tuesday: { mainCourse: '', altSabji: '', sides: '', specialAddOns: '' },
      Wednesday: { mainCourse: '', altSabji: '', sides: '', specialAddOns: '' },
      Thursday: { mainCourse: '', altSabji: '', sides: '', specialAddOns: '' },
      Friday: { mainCourse: '', altSabji: '', sides: '', specialAddOns: '' },
      Saturday: { mainCourse: '', altSabji: '', sides: '', specialAddOns: '' },
      Sunday: { mainCourse: '', altSabji: '', sides: '', specialAddOns: '' }
    }
  },
  
  // Optional display fields
  menuPrice: { type: Number, default: 80 },
  rating: { type: Number, default: 4.5 },
  workingDays: { type: String, default: 'Mon - Sat' },
  timings: { type: String, default: '11:00 AM - 09:00 PM' }
});

module.exports = mongoose.model('Vendor', vendorSchema);

