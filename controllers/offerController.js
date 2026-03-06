const Offer = require('../models/Offer');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const nodemailer = require('nodemailer');

// Helper function to transform image path to full URL
const transformImageUrl = (imagePath, req) => {
  if (!imagePath) return null;
  
  // If already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Use dynamic protocol and host from request
  const backendUrl = `${req.protocol}://${req.get('host')}`;
  
  // Remove any double slashes
  let cleanPath = imagePath.replace(/\/+/g, '/');
  
  // If path starts with /uploads, prepend backend URL
  if (cleanPath.startsWith('/uploads/')) {
    return `${backendUrl}${cleanPath}`;
  }
  
  return `${backendUrl}/uploads/${cleanPath.replace(/^\/?uploads\//, '')}`;
};

// Helper function to send email
const sendEmail = async (to, subject, html) => {
  try {
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
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// @desc    Create a new offer (vendor)
// @route   POST /api/vendor/offers
const createOffer = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an offer poster image' });
    }

    const { startDate, endDate, planDiscounts } = req.body;

    // Parse planDiscounts if it's a string
    let parsedPlanDiscounts = planDiscounts;
    if (typeof planDiscounts === 'string') {
      parsedPlanDiscounts = JSON.parse(planDiscounts);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({ message: 'Start date cannot be in the past' });
    }

    if (end <= start) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    // Validate plan discounts
    if (!parsedPlanDiscounts || !Array.isArray(parsedPlanDiscounts) || parsedPlanDiscounts.length === 0) {
      return res.status(400).json({ message: 'At least one plan discount is required' });
    }

    // Create the offer
    const offer = await Offer.create({
      vendorId: vendor._id,
      posterImage: `/uploads/${req.file.filename}`,
      startDate: start,
      endDate: end,
      planDiscounts: parsedPlanDiscounts
    });

    // Populate vendor details for email
    const populatedOffer = await Offer.findById(offer._id).populate('vendorId', 'kitchenName');

    // Send promotional emails to all users in the background (non-blocking)
    setImmediate(async () => {
      try {
        const users = await User.find({ role: 'user', isActive: true }).select('email name');
        
        if (users.length > 0) {
          // Format discount details for email
          const discountText = populatedOffer.planDiscounts
            .map(pd => `${pd.planName}: ${pd.discountPercentage}% OFF`)
            .join(', ');

          const emailSubject = '🎉 New Offer Available on MealSetu!';
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #f26522 0%, #ff6b35 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🍱 New Offer Alert!</h1>
              </div>
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Great news! <strong>${populatedOffer.vendorId.kitchenName}</strong> has launched a new exciting offer on MealSetu!</p>
                
                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #f26522;">
                  <h3 style="color: #f26522; margin: 0 0 15px 0;">🎁 Offer Details</h3>
                  <p style="font-size: 18px; font-weight: bold; color: #16a34a;">${discountText}</p>
                </div>
                
                <div style="background: #fff3ed; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0; color: #555;"><strong>📅 Valid From:</strong> ${new Date(populatedOffer.startDate).toLocaleDateString('en-IN')}</p>
                  <p style="margin: 5px 0; color: #555;"><strong>📅 Valid Until:</strong> ${new Date(populatedOffer.endDate).toLocaleDateString('en-IN')}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${req.protocol}://${req.get('host')}/user" style="background: #f26522; color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">🔥 Grab This Offer Now!</a>
                </div>
                
                <p style="color: #888; font-size: 14px; text-align: center; margin-top: 20px;">
                  Don't miss out on this amazing deal. Order now and enjoy delicious meals at discounted prices!
                </p>
              </div>
              <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <p>MealSetu - Quality Food, Delivered with Care</p>
              </div>
            </div>
          `;

          // Send emails in batches
          const batchSize = 10;
          for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);
            await Promise.all(
              batch.map(user => sendEmail(user.email, emailSubject, emailHtml))
            );
          }
          console.log(`Promotional emails sent to ${users.length} users for offer ${offer._id}`);
        }
      } catch (emailError) {
        console.error('Failed to send promotional emails:', emailError);
      }
    });

    res.status(201).json({
      message: 'Offer created successfully',
      offer: {
        ...populatedOffer.toObject(),
        posterImage: transformImageUrl(populatedOffer.posterImage, req)
      }
    });
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ message: 'Error creating offer', error: error.message });
  }
};

// @desc    Get vendor's all offers
// @route   GET /api/vendor/offers
const getVendorOffers = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const offers = await Offer.find({ vendorId: vendor._id })
      .populate('vendorId', 'kitchenName')
      .sort({ createdAt: -1 });

    // Transform image URLs
    const transformedOffers = offers.map(offer => ({
      ...offer.toObject(),
      posterImage: transformImageUrl(offer.posterImage, req)
    }));

    res.json(transformedOffers);
  } catch (error) {
    console.error('Get vendor offers error:', error);
    res.status(500).json({ message: 'Error fetching offers' });
  }
};

// @desc    Delete an offer (vendor)
// @route   DELETE /api/vendor/offers/:id
const deleteOffer = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const offer = await Offer.findOne({ _id: req.params.id, vendorId: vendor._id });
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    await Offer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Delete offer error:', error);
    res.status(500).json({ message: 'Error deleting offer' });
  }
};

// @desc    Get all active offers (for user dashboard)
// @route   GET /api/users/active-offers
const getActiveOffers = async (req, res) => {
  try {
    // Use current date with proper time handling
    const now = new Date();
    
    // Start of today (00:00:00)
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    // End of today (23:59:59.999)
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('[getActiveOffers] Searching for active offers...');
    console.log('[getActiveOffers] Current date range:', {
      startOfToday: startOfToday.toISOString(),
      endOfToday: endOfToday.toISOString()
    });

    // Query: offers where startDate <= endOfToday AND endDate >= startOfToday
    // This ensures offers that start today or have already started are included
    // And offers that end today or haven't ended yet are included
    const offers = await Offer.find({
      $or: [
        { isActive: true },
        { isActive: { $exists: false } }
      ],
      startDate: { $lte: endOfToday },
      endDate: { $gte: startOfToday }
    })
      .populate('vendorId', 'kitchenName address profileImage kitchenPoster')
      .sort({ createdAt: -1 });

    console.log('[getActiveOffers] Offers found after query:', offers.length);

    if (offers.length > 0) {
      console.log('[getActiveOffers] Sample offer dates:');
      offers.slice(0, 3).forEach((offer, i) => {
        console.log(`  Offer ${i + 1}:`, {
          _id: offer._id,
          startDate: offer.startDate,
          endDate: offer.endDate,
          isActive: offer.isActive
        });
      });
    }

    // Transform image URLs and filter out offers without valid vendor
    const transformedOffers = offers
      .filter(offer => offer.vendorId)
      .map(offer => ({
        _id: offer._id,
        vendorId: offer.vendorId._id,
        kitchenName: offer.vendorId.kitchenName,
        vendorAddress: offer.vendorId.address,
        vendorProfileImage: transformImageUrl(offer.vendorId.profileImage, req),
        vendorKitchenPoster: transformImageUrl(offer.vendorId.kitchenPoster, req),
        posterImage: transformImageUrl(offer.posterImage, req),
        startDate: offer.startDate,
        endDate: offer.endDate,
        planDiscounts: offer.planDiscounts,
        createdAt: offer.createdAt
      }));

    console.log('[getActiveOffers] Returning transformed offers:', transformedOffers.length);
    
    // Return the array directly (not wrapped in object)
    res.json(transformedOffers);
  } catch (error) {
    console.error('Get active offers error:', error);
    res.status(500).json({ message: 'Error fetching active offers' });
  }
};

// @desc    Redeem an offer (user)
// @route   POST /api/users/redeem-offer
const redeemOffer = async (req, res) => {
  try {
    const { offerId, planType } = req.body;
    const userId = req.user._id;

    if (!offerId || !planType) {
      return res.status(400).json({ message: 'offerId and planType are required' });
    }

    // Get the offer
    const offer = await Offer.findById(offerId).populate('vendorId', 'kitchenName');
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    // Check if offer is still active
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startDate = new Date(offer.startDate);
    const endDate = new Date(offer.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (now < startDate || now > endDate) {
      return res.status(400).json({ message: 'This offer has expired or is not yet active' });
    }

    // Find the discount for the selected plan
    const planDiscount = offer.planDiscounts.find(
      pd => pd.planName.toLowerCase() === planType.toLowerCase()
    );

    if (!planDiscount || planDiscount.discountPercentage === 0) {
      return res.status(400).json({ 
        message: `No discount available for ${planType} plan` 
      });
    }

    // Calculate prices
    const PLAN_PRICES = {
      'One Day': 80,
      'Weekly': 560,
      'Monthly': 2000
    };

    const originalPrice = PLAN_PRICES[planType] || 80;
    const discountPercentage = planDiscount.discountPercentage;
    const discountedPrice = Math.round(originalPrice * (1 - discountPercentage / 100));

    // Check if user has an active subscription
    const activeSubscription = await Subscription.findOne({
      userId: userId,
      status: 'active',
      expiryDate: { $gte: now }
    });

    // If user has active plan, we need to schedule the offer
    if (activeSubscription) {
      // Calculate scheduled activation date (next day after current plan expires)
      const currentExpiry = new Date(activeSubscription.expiryDate);
      const scheduledActivationDate = new Date(currentExpiry);
      scheduledActivationDate.setDate(scheduledActivationDate.getDate() + 1);

      // Check if the offer will still be valid when the new plan starts
      if (scheduledActivationDate > endDate) {
        return res.status(400).json({ 
          message: 'This offer will expire before your current plan ends. Please wait for your current plan to complete.',
          expiredOffer: true
        });
      }

      // Create a pending order
      const order = await Order.create({
        userId: userId,
        vendorId: offer.vendorId._id,
        amount: discountedPrice,
        deliverySlot: 'Lunch',
        mealPreference: 'Regular',
        paymentStatus: 'Pending',
        paymentMethod: 'Cash',
        planType: planType,
        isOfferOrder: true,
        offerId: offer._id,
        originalPrice: originalPrice,
        discountPercentage: discountPercentage,
        discountedPrice: discountedPrice,
        scheduledActivationDate: scheduledActivationDate,
        offerStatus: 'pending',
        customerName: req.user.name
      });

      // Also create a pending subscription
      const subscriptionStartDate = scheduledActivationDate;
      const subscriptionEndDate = new Date(subscriptionStartDate);
      const durationDays = planType === 'One Day' ? 1 : planType === 'Weekly' ? 7 : 30;
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + durationDays);

      await Subscription.create({
        userId: userId,
        vendorId: offer.vendorId._id,
        planType: planType,
        startDate: subscriptionStartDate,
        expiryDate: subscriptionEndDate,
        status: 'pending', // Will be activated by cron job
        customerName: req.user.name,
        contact: req.user.phone,
        isOfferSubscription: true,
        offerId: offer._id
      });

      return res.status(201).json({
        message: 'Offer redeemed successfully!',
        status: 'pending',
        currentPlanExpiry: activeSubscription.expiryDate,
        scheduledActivationDate: scheduledActivationDate,
        offerDetails: {
          vendorName: offer.vendorId.kitchenName,
          planType: planType,
          originalPrice: originalPrice,
          discountPercentage: discountPercentage,
          discountedPrice: discountedPrice,
          offerEndDate: offer.endDate
        }
      });
    }

    // No active subscription - create and activate immediately
    // Create order
    const order = await Order.create({
      userId: userId,
      vendorId: offer.vendorId._id,
      amount: discountedPrice,
      deliverySlot: 'Lunch',
      mealPreference: 'Regular',
      paymentStatus: 'Pending',
      paymentMethod: 'Cash',
      planType: planType,
      isOfferOrder: true,
      offerId: offer._id,
      originalPrice: originalPrice,
      discountPercentage: discountPercentage,
      discountedPrice: discountedPrice,
      offerStatus: 'active',
      customerName: req.user.name
    });

    // Create and activate subscription immediately
    const subscriptionStartDate = new Date();
    const subscriptionEndDate = new Date(subscriptionStartDate);
    const durationDays = planType === 'One Day' ? 1 : planType === 'Weekly' ? 7 : 30;
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + durationDays);

    const subscription = await Subscription.create({
      userId: userId,
      vendorId: offer.vendorId._id,
      planType: planType,
      startDate: subscriptionStartDate,
      expiryDate: subscriptionEndDate,
      status: 'active',
      customerName: req.user.name,
      contact: req.user.phone,
      isOfferSubscription: true,
      offerId: offer._id
    });

    // Update user expiry date
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, { expiryDate: subscriptionEndDate });

    // Send confirmation email
    const emailSubject = `🎉 Offer Activated! - ${offer.vendorId.kitchenName}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #16a34a;">Offer Activated!</h1>
        <p>Dear ${req.user.name},</p>
        <p>Your redeemed offer from <strong>${offer.vendorId.kitchenName}</strong> is now active!</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
          <p><strong>Vendor:</strong> ${offer.vendorId.kitchenName}</p>
          <p><strong>Plan:</strong> ${planType}</p>
          <p><strong>Original Price:</strong> ₹${originalPrice}</p>
          <p><strong>Discount:</strong> ${discountPercentage}% OFF</p>
          <p><strong>You Paid:</strong> ₹${discountedPrice}</p>
          <p><strong>Start Date:</strong> ${subscriptionStartDate.toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${subscriptionEndDate.toLocaleDateString()}</p>
        </div>
        <p>Enjoy your discounted meals!</p>
        <hr/>
        <p style="color: #999; font-size: 12px;">MealSetu - Quality Food, Delivered with Care</p>
      </div>
    `;
    sendEmail(req.user.email, emailSubject, emailHtml);

    return res.status(201).json({
      message: 'Offer redeemed and activated successfully!',
      status: 'active',
      offerDetails: {
        vendorName: offer.vendorId.kitchenName,
        planType: planType,
        originalPrice: originalPrice,
        discountPercentage: discountPercentage,
        discountedPrice: discountedPrice
      },
      subscription: {
        planType: planType,
        startDate: subscriptionStartDate,
        expiryDate: subscriptionEndDate,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Redeem offer error:', error);
    res.status(500).json({ message: 'Error redeeming offer', error: error.message });
  }
};

module.exports = {
  createOffer,
  getVendorOffers,
  deleteOffer,
  getActiveOffers,
  redeemOffer
};

