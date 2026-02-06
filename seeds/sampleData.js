const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Menu = require('../models/Menu');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Vendor.deleteMany({});
    console.log('Cleared existing data');

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const vendorPassword = await bcrypt.hash('vendor123', salt);
    const userPassword = await bcrypt.hash('user123', salt);

    // Create Admin User
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@mealsetu.com',
      password: adminPassword,
      phone: '+91 9876543210',
      role: 'admin',
      isActive: true,
      joinDate: new Date()
    });
    console.log('✓ Admin created:', admin.email);

    // Create Sample Vendors
    const vendor1User = await User.create({
      name: 'Priya Sharma',
      email: 'priya.vendor@mealsetu.com',
      password: vendorPassword,
      phone: '+91 9876543211',
      role: 'vendor',
      isActive: true,
      joinDate: new Date()
    });

    const vendor1 = await Vendor.create({
      ownerId: vendor1User._id,
      kitchenName: 'Annapurna Home Kitchen',
      address: '123 Food Lane, Sector 21, Gandhinagar, Gujarat',
      pincode: '382021',
      fssaiLicense: 'uploads/fssai-annapurna.pdf',
      gstDocument: 'uploads/gst-annapurna.pdf',
      approvalStatus: 'Pending',
      submittedDate: new Date('2026-01-25'),
      walletBalance: 0
    });
    // add some display fields
    vendor1.menuPrice = 80;
    vendor1.rating = 4.8;
    vendor1.workingDays = 'Mon - Sat';
    vendor1.timings = '11:00 AM - 10:00 PM';
    await vendor1.save();
    console.log('✓ Vendor 1 created (Pending):', vendor1.kitchenName);

    const vendor2User = await User.create({
      name: 'Rajesh Patel',
      email: 'rajesh.vendor@mealsetu.com',
      password: vendorPassword,
      phone: '+91 9876543212',
      role: 'vendor',
      isActive: true,
      joinDate: new Date('2026-01-20')
    });

    const vendor2 = await Vendor.create({
      ownerId: vendor2User._id,
      kitchenName: 'Mom\'s Magic Kitchen',
      address: '456 Taste Street, Satellite, Ahmedabad, Gujarat',
      pincode: '380015',
      fssaiLicense: 'uploads/fssai-moms.pdf',
      gstDocument: 'uploads/gst-moms.pdf',
      approvalStatus: 'Approved',
      submittedDate: new Date('2026-01-15'),
      walletBalance: 5420
    });
    vendor2.menuPrice = 100;
    vendor2.rating = 4.9;
    vendor2.workingDays = 'All Days';
    vendor2.timings = '09:00 AM - 09:00 PM';
    await vendor2.save();
    console.log('✓ Vendor 2 created (Approved):', vendor2.kitchenName);

    const vendor3User = await User.create({
      name: 'Sonal Gupta',
      email: 'sonal.vendor@mealsetu.com',
      password: vendorPassword,
      phone: '+91 9876543213',
      role: 'vendor',
      isActive: true,
      joinDate: new Date('2026-01-10')
    });

    const vendor3 = await Vendor.create({
      ownerId: vendor3User._id,
      kitchenName: 'Healthy Eats Cafe',
      address: '789 Wellness Way, Vastrapur, Ahmedabad, Gujarat',
      pincode: '380006',
      fssaiLicense: 'uploads/fssai-healthy.pdf',
      gstDocument: 'uploads/gst-healthy.pdf',
      approvalStatus: 'Rejected',
      rejectionReason: 'FSSAI license expired. Please submit renewed license.',
      submittedDate: new Date('2026-01-22'),
      walletBalance: 0
    });
    vendor3.menuPrice = 90;
    vendor3.rating = 4.4;
    vendor3.workingDays = 'Mon - Fri';
    vendor3.timings = '10:00 AM - 08:00 PM';
    await vendor3.save();
    console.log('✓ Vendor 3 created (Rejected):', vendor3.kitchenName);

    // Create Sample Users
    const user1 = await User.create({
      name: 'Mosin Ali',
      email: 'mosin@mealsetu.com',
      password: userPassword,
      phone: '+91 9876543220',
      address: 'Himatnagar, Gujarat',
      pincode: '383001',
      role: 'user',
      isActive: true,
      joinDate: new Date('2026-01-01')
    });
    console.log('✓ User 1 created:', user1.email);

    const user2 = await User.create({
      name: 'Priya Singh',
      email: 'priya.user@mealsetu.com',
      password: userPassword,
      phone: '+91 9876543221',
      address: 'Ahmedabad, Gujarat',
      pincode: '380001',
      role: 'user',
      isActive: true,
      joinDate: new Date('2026-01-05')
    });
    console.log('✓ User 2 created:', user2.email);

    const user3 = await User.create({
      name: 'Rajesh Kumar',
      email: 'rajesh.user@mealsetu.com',
      password: userPassword,
      phone: '+91 9876543222',
      address: 'Gandhinagar, Gujarat',
      pincode: '382021',
      role: 'user',
      isActive: false,
      joinDate: new Date('2025-12-20')
    });
    console.log('✓ User 3 created (Inactive):', user3.email);

    const user4 = await User.create({
      name: 'Sneha Kapoor',
      email: 'sneha.user@mealsetu.com',
      password: userPassword,
      phone: '+91 9876543223',
      address: 'Baroda, Gujarat',
      pincode: '390001',
      role: 'user',
      isActive: true,
      joinDate: new Date('2025-12-10')
    });
    console.log('✓ User 4 created:', user4.email);

    // Create sample menus for vendors (today)
    const today = new Date();
    await Menu.create({ vendorId: vendor1._id, date: today, mainSabji: 'Paneer Butter Masala', altSabji: 'Mix Veg', sweetItem: 'Gulab Jamun', dietaryCategory: 'Regular', cycleType: 'Daily' });
    await Menu.create({ vendorId: vendor2._id, date: today, mainSabji: 'Aloo Gobi', altSabji: 'Dal Tadka', sweetItem: 'Rasgulla', dietaryCategory: 'Regular', cycleType: 'Daily' });
    console.log('✓ Sample menus created for vendors');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('Admin:');
    console.log('  Email: admin@mealsetu.com');
    console.log('  Password: admin123');
    console.log('\nVendor (Pending):');
    console.log('  Email: priya.vendor@mealsetu.com');
    console.log('  Password: vendor123');
    console.log('\nVendor (Approved):');
    console.log('  Email: rajesh.vendor@mealsetu.com');
    console.log('  Password: vendor123');
    console.log('\nUser:');
    console.log('  Email: mosin@mealsetu.com');
    console.log('  Password: user123');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  require('dotenv').config();
  seedDatabase();
}

module.exports = seedDatabase;
