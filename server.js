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
const { seedDatabase, isDatabaseEmpty } = require('./seeds/sampleData');
const { startOfferActivationCron } = require('./cron/offerActivation');

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
app.use('/api/vendor', vendorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Connect to MongoDB and conditionally seed database
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
    
    // Check if database is empty and auto-seed if needed
    const empty = await isDatabaseEmpty();
    if (empty) {
      console.log('\n📦 Database is empty. Running automatic seed...');
      try {
        const result = await seedDatabase({ force: false, verbose: true });
        if (result.status === 'seeded') {
          console.log('✅ Automatic seeding completed!\n');
        }
      } catch (seedError) {
        console.error('⚠ Automatic seeding failed:', seedError.message);
        console.log('   Server will continue without sample data.\n');
      }
    } else {
      console.log('📊 Database contains existing data. Skipping auto-seed.\n');
    }
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      
      // Start the offer activation cron job
      startOfferActivationCron();
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

startServer();

