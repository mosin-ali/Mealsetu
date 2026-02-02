const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // e.g., WELCOME50
  description: { type: String, required: true },
  discountValue: { type: Number, required: true },
  validUntil: { type: Date, required: true },
  color: { type: String, default: '#f26522' } // UI styling
});

module.exports = mongoose.model('Offer', offerSchema);