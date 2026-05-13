
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
userId: { 
  type: mongoose.Schema.Types.ObjectId, 
  ref: 'User', 
  required: [function() { return this.source !== 'manual'; }, 'userId is required for app orders']
},
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  
  // Order Details 
  customerName: { type: String },
  mealPreference: { type: String, enum: ['Regular', 'Jain'] },
  deliverySlot: { type: String, enum: ['Lunch', 'Dinner'] },
  orderDate: { type: Date, default: Date.now },
  
  // Subscription Plan Type (Weekly, Monthly, Trial)
  planType: { type: String, enum: ['Weekly', 'Monthly', 'Trial', 'Tiffin'], default: 'Tiffin' },

  // Trial Order - Start and End dates for trial period
  startDate: { type: Date },
  endDate: { type: Date },

  // Payment & Status
  amount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Pending' },
  paymentMethod: { type: String, enum: ['Cash', 'UPI', 'Free'], default: 'Cash' },
  cashPaymentConfirmedAt: { type: Date, default: null },
  cashPaymentConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
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
    enum: ['active', 'pending', 'on-hold', 'cancelled', 'expired', 'completed', 'trial'],
    default: null
  },

  // For subscription extension - scheduled start/end dates for pending orders
  scheduledStartDate: { type: Date },
  scheduledEndDate: { type: Date },

  // Order status: pending, active, expired
  status: {
    type: String,
    enum: ['pending', 'active', 'on-hold', 'expired', 'cancelled', 'completed', 'trial'],
    default: 'active'
  },

  // Manual/Offline Customer fields
  source: { type: String, enum: ['app', 'manual'], default: 'app' },
  manualCustomerName: { type: String, default: null },
  manualCustomerPhone: { type: String, default: null },
  manualCustomerAddress: { type: String, default: null },
  manualCustomerPincode: { type: String, default: null },
  isManualOrder: { type: Boolean, default: false }
});

module.exports = mongoose.model('Order', orderSchema);
