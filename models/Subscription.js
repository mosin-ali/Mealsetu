const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  
  // 
  planType: { type: String, enum: ['Weekly', 'Monthly', 'Trial'], required: true },
  startDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'paused'], default: 'active' },
  autoRenew: { type: Boolean, default: false },

  // Fields for Vendor View 
  customerName: { type: String }, // Optional: Snapshot of name at booking
  contact: { type: String },      // Optional: Snapshot of phone
  dietaryPref: { type: String }   // e.g., "No Garlic"
});

module.exports = mongoose.model('Subscription', subscriptionSchema);