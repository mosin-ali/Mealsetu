const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema({
  settingKey: { type: String, required: true, unique: true }, // e.g. 'commission_rate'
  value: { type: mongoose.Schema.Types.Mixed, required: true }, // Number or String
  
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);