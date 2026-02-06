const User = require('../models/User');
const Vendor = require('../models/Vendor');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register new user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { 
      name, email, password, role, 
      phone, pincode, address,        // User specific
      kitchenName, kitchenAddress,    // Vendor specific
      adminKey                        // Admin specific
    } = req.body;

    // 1. Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Handle File Uploads (from Multer)
    // frontend sends: 'profilePic', 'fssaiDoc', 'gstDoc'
    const profilePicPath = req.files['profilePic'] ? req.files['profilePic'][0].path : null;

    // 4. Create Base User
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address: role === 'user' ? address : undefined,
      pincode: role === 'user' ? pincode : undefined,
      profilePic: profilePicPath,
      role
    });

    // 5. If Role is Vendor, create Vendor Document
    if (role === 'vendor') {
        const fssaiPath = req.files['fssaiDoc'] ? req.files['fssaiDoc'][0].path : null;
        const gstPath = req.files['gstDoc'] ? req.files['gstDoc'][0].path : null;

        await Vendor.create({
            ownerId: user._id,
            kitchenName,
            address: kitchenAddress,
            pincode, // Vendor pincode
            fssaiLicense: fssaiPath,
            gstDocument: gstPath
        });
    }

    // 6. If Role is Admin, verify key (Simple check)
    if (role === 'admin' && adminKey !== 'admin123') {
        await User.findByIdAndDelete(user._id);
        return res.status(401).json({ message: 'Invalid Admin Key' });
    }

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  const { email, password, role, adminKey } = req.body;

  try {
    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if role matches
    if (user.role !== role) {
      return res.status(401).json({ message: `This account is registered as ${user.role}. Please login via the ${user.role} portal.` });
    }

    // If admin, verify admin key
    if (role === 'admin' && adminKey !== 'admin123') {
      return res.status(401).json({ message: 'Invalid admin key' });
    }

    // Generate token and return user data
    const token = generateToken(user._id, user.role);
    
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePic: user.profilePic,
      token: token,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = { registerUser, loginUser };