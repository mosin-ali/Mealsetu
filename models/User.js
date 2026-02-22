const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // --- Auth & Basic Info ---
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  profilePic: { type: String }, 
  role: { 
    type: String, 
    enum: ['user', 'vendor', 'admin', 'superadmin'], 
    default: 'user' 
  },
  
  // --- Customer Specific ---
  address: { type: String }, 
  pincode: { type: String },
  
  // --- Admin Specific  ---
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },

  // --- User Management Fields  ---
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  joinDate: { type: Date, default: Date.now },

  // --- Password Reset Fields (Token-based - kept for compatibility) ---
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },

  // --- OTP Verification Fields ---
  resetOTP: { type: String },
  resetOTPExpire: { type: Date },
  isOTPVerified: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
