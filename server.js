const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { getVendorWeeklyPlan } = require('./controllers/vendorController');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public route for getting vendor's weekly plan (no auth required)
app.get('/api/vendor-profile/:vendorId', async (req, res) => {
  try {
    const Vendor = require('./models/Vendor');
    const { vendorId } = req.params;
    const vendor = await Vendor.findById(vendorId);
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({ 
      weeklyPlan: vendor.weeklyPlan,
      kitchenName: vendor.kitchenName 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendor', vendorRoutes); // New
app.use('/api/users', userRoutes);    // New
app.use('/api/admin', adminRoutes);   // New

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));