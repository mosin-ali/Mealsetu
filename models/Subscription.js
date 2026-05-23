const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  
  // 
  planType: { type: String, enum: ['Weekly', 'Monthly', 'Trial'], required: true },
  startDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  leaveDate: { type: Date },
  leavesUsed: { type: Number, default: 0 },     // max 2 per subscription
  leaveDates: [{                                // history of each leave applied
    startDate: { type: Date },
    endDate: { type: Date },
    days: { type: Number },
    appliedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['active', 'pending', 'on-hold', 'expired', 'cancelled', 'completed', 'trial'], default: 'active' },
  autoRenew: { type: Boolean, default: false },

  // Fields for Vendor View
  customerName: { type: String },
  contact: { type: String },
  dietaryPref: { type: String }
});

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ vendorId: 1, status: 1 });
subscriptionSchema.index({ expiryDate: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);