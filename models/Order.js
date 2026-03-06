const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  
  // Order Details 
  customerName: { type: String },
  mealPreference: { type: String, enum: ['Regular', 'Jain'] },
  deliverySlot: { type: String, enum: ['Lunch', 'Dinner'] },
  orderDate: { type: Date, default: Date.now },
  
  // Subscription Plan Type (Weekly, Monthly, Trial)
  planType: { type: String, enum: ['Weekly', 'Monthly', 'Trial', 'Tiffin'], default: 'Tiffin' },

  // Payment & Status 
  amount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Pending' },
  paymentMethod: { type: String, enum: ['Cash', 'UPI'], default: 'Cash' },
  orderStatus: {
    type: String, 
    enum: ['Preparing', 'Delivered', 'Cancelled', 'In Kitchen', 'Out for Delivery'], 
    default: 'Preparing' 
  },
  transactionId: { type: String },

  // Offer-related fields
  isOfferOrder: { type: Boolean, default: false },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  originalPrice: { type: Number },
  discountPercentage: { type: Number },
  discountedPrice: { type: Number },
  scheduledActivationDate: { type: Date },
  offerStatus: {
    type: String,
    enum: ['active', 'pending', 'cancelled', 'expired'],
    default: null
  }
});

module.exports = mongoose.model('Order', orderSchema);
