const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // Link to specific order
  
  // Cached customer info for display
  customerName: { type: String, default: '' },
  
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: "" },
  
  createdAt: { type: Date, default: Date.now }
});

// Index for efficient queries
reviewSchema.index({ vendorId: 1, createdAt: -1 });
reviewSchema.index({ vendorId: 1, rating: -1 });

module.exports = mongoose.model('Review', reviewSchema);
