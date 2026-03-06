const User = require('../models/User');
const Vendor = require('../models/Vendor');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Helper to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to send email
const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html
  };

  await transporter.sendMail(mailOptions);
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
    // Normalize path: convert Windows backslashes to forward slashes and ensure proper format
    const normalizePath = (filePath) => {
      if (!filePath) return null;
      // Replace backslashes with forward slashes (Windows path fix)
      let normalized = filePath.replace(/\\/g, '/');
      // Check if the result contains uploads/ anywhere
      if (normalized.includes('uploads/')) {
        // Extract everything from uploads/ onward and prepend a single /uploads/
        const parts = normalized.split('uploads/');
        normalized = '/uploads/' + parts[parts.length - 1];
      }
      return normalized;
    };

    const profilePicPath = req.files['profilePic'] ? normalizePath(req.files['profilePic'][0].path) : null;
    const kitchenPosterPath = req.files['kitchenPoster'] ? normalizePath(req.files['kitchenPoster'][0].path) : null;

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
        // Also normalize vendor document paths
        const fssaiPath = req.files['fssaiDoc'] ? normalizePath(req.files['fssaiDoc'][0].path) : null;
        const gstPath = req.files['gstDoc'] ? normalizePath(req.files['gstDoc'][0].path) : null;

        await Vendor.create({
            ownerId: user._id,
            kitchenName,
            address: kitchenAddress,
            pincode,
            fssaiLicense: fssaiPath,
            gstDocument: gstPath,
            profileImage: profilePicPath,
            kitchenPoster: kitchenPosterPath
        });
    }

    // 6. If Role is Admin, verify key
    if (role === 'admin' && adminKey !== 'admin123') {
        await User.findByIdAndDelete(user._id);
        return res.status(401).json({ message: 'Invalid Admin Key' });
    }

    // Transform profilePic to full URL - fix double-slash issue
    const transformPathToUrl = (path) => {
      if (!path) return null;
      // Remove any double slashes
      let cleanPath = path.replace(/\/+/g, '/');
      // Ensure proper format: /uploads/filename
      if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
      }
      return `${req.protocol}://${req.get('host')}${cleanPath}`;
    };

    const profilePicUrl = user.profilePic 
      ? transformPathToUrl(user.profilePic) 
      : null;

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePic: profilePicUrl,
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
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.role !== role) {
      return res.status(401).json({ message: `This account is registered as ${user.role}. Please login via the ${user.role} portal.` });
    }

    if (role === 'admin' && adminKey !== 'admin123') {
      return res.status(401).json({ message: 'Invalid admin key' });
    }

    // Transform profilePic to full URL - fix double-slash issue
    const transformPathToUrl = (path) => {
      if (!path) return null;
      // Remove any double slashes
      let cleanPath = path.replace(/\/+/g, '/');
      // Ensure proper format: /uploads/filename
      if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
      }
      return `${req.protocol}://${req.get('host')}${cleanPath}`;
    };

    const profilePicUrl = user.profilePic 
      ? transformPathToUrl(user.profilePic)
      : null;

    const token = generateToken(user._id, user.role);
    
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePic: profilePicUrl,
      token: token,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Send OTP for password reset
// @route   POST /api/auth/forgot-password/send-otp
const sendOTP = async (req, res) => {
  const { email } = req.body;

  console.log('Send OTP request for:', email);

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({ message: 'If an account exists, an OTP has been sent' });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    
    // Hash OTP before storing (for security)
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    // Set OTP expiry (5 minutes)
    user.resetOTP = hashedOTP;
    user.resetOTPExpire = Date.now() + 5 * 60 * 1000;
    user.isOTPVerified = false;
    
    await user.save();

    // Send OTP via email
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset OTP</h1>
        <p>You requested a password reset for your MealSetu account.</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 14px;">This OTP will expire in 5 minutes.</p>
        <hr/>
        <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail(user.email, 'MealSetu - Password Reset OTP', message);
    console.log('OTP sent successfully to:', user.email);

    res.status(200).json({ message: 'OTP sent successfully', email: user.email });

  } catch (error) {
    console.error('Send OTP error:', error);
    
    try {
      const user = await User.findOne({ email });
      if (user) {
        user.resetOTP = undefined;
        user.resetOTPExpire = undefined;
        await user.save();
      }
    } catch (saveError) {
      console.error('Error resetting user fields:', saveError);
    }

    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/forgot-password/verify-otp
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  console.log('Verify OTP request for:', email);

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // Check if OTP is valid
    if (!user.resetOTP || !user.resetOTPExpire) {
      return res.status(400).json({ message: 'OTP expired or not requested. Please request a new OTP.' });
    }

    // Check if OTP is expired
    if (Date.now() > user.resetOTPExpire) {
      user.resetOTP = undefined;
      user.resetOTPExpire = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    // Hash the provided OTP and compare
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.resetOTP !== hashedOTP) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    // Mark as verified
    user.isOTPVerified = true;
    await user.save();

    console.log('OTP verified successfully for:', user.email);

    res.status(200).json({ message: 'OTP verified successfully', verified: true });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
};

// @desc    Reset password after OTP verification
// @route   POST /api/auth/forgot-password/reset-password
const resetPasswordWithOTP = async (req, res) => {
  const { email, password } = req.body;

  console.log('Reset password request for:', email);

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // Check if OTP was verified
    if (!user.isOTPVerified) {
      return res.status(400).json({ message: 'Please verify OTP first' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    // Clear OTP fields
    user.resetOTP = undefined;
    user.resetOTPExpire = undefined;
    user.isOTPVerified = false;

    await user.save();

    console.log('Password reset successful for user:', user.email);

    res.status(200).json({ message: 'Password reset successful. You can now login with your new password.' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};

// Keep old functions for backward compatibility (deprecated)
const forgotPassword = async (req, res) => {
  // Redirect to sendOTP
  return sendOTP(req, res);
};

const resetPassword = async (req, res) => {
  // Redirect to resetPasswordWithOTP
  return resetPasswordWithOTP(req, res);
};

module.exports = { 
  registerUser, 
  loginUser, 
  forgotPassword, 
  resetPassword,
  sendOTP,
  verifyOTP,
  resetPasswordWithOTP
};
