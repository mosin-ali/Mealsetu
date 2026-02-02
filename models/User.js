const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String }, 
  pincode: { type: String },
  profilePic: { type: String }, 
  role: { 
    type: String, 
    enum: ['user', 'vendor', 'admin'], 
    default: 'user' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);