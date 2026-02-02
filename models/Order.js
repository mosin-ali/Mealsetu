const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  
  // Order Details 
  customerName: { type: String },
  mealPreference: { type: String, enum: ['Regular', 'Jain'] },
  deliverySlot: { type: String, enum: ['Lunch', 'Dinner'] },
  orderDate: { type: Date, default: Date.now },

  // Payment & Status 
  amount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Pending' },
  orderStatus: { 
    type: String, 
    enum: ['Preparing', 'Delivered', 'Cancelled', 'In Kitchen', 'Out for Delivery'], 
    default: 'Preparing' 
  },
  transactionId: { type: String }
});

module.exports = mongoose.model('Order', orderSchema);