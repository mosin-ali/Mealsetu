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
  
  // --- Customer Specific [cite: 60] ---
  address: { type: String }, 
  pincode: { type: String },
  
  // --- Admin Specific  ---
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },

  // --- User Management Fields  ---
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  joinDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);