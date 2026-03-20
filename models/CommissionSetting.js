const mongoose = require('mongoose');

const commissionSettingSchema = new mongoose.Schema({
  tierName: { 
    type: String, 
    required: true 
  },
  minEarning: { 
    type: Number, 
    required: true,
    default: 0
  },
  maxEarning: { 
    type: Number, 
    required: true 
  },
  ratePercent: { 
    type: Number, 
    required: true 
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// Index for efficient tier lookups
commissionSettingSchema.index({ minEarning: 1, maxEarning: 1 });

module.exports = mongoose.model('CommissionSetting', commissionSettingSchema);

