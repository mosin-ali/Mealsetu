const mongoose = require('mongoose');

const commissionSettingSchema = new mongoose.Schema({
  tierName: {
    type: String,
    required: true,
    trim: true
  },
  minEarning: {
    type: Number,
    required: true,
    default: 0
  },
  maxEarning: {
    type: Number,
    default: null
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

module.exports = mongoose.model('CommissionSetting', commissionSettingSchema);
