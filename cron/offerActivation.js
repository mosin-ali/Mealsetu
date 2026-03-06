const cron = require('node-cron');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Offer = require('../models/Offer');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const nodemailer = require('nodemailer');

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

// Function to process pending offer orders
const processPendingOfferOrders = async () => {
  console.log('🔄 Running cron job: Processing pending offer orders...');
  
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find all pending orders where scheduled activation date has arrived
    const pendingOrders = await Order.find({
      isOfferOrder: true,
      offerStatus: 'pending',
      scheduledActivationDate: { $lte: now }
    }).populate('vendorId').populate('userId').populate('offerId');

    console.log(`📋 Found ${pendingOrders.length} pending offer orders to process`);

    for (const order of pendingOrders) {
      try {
        // Check if the offer is still valid
        const offer = await Offer.findById(order.offerId);
        
        if (!offer) {
          // Offer was deleted - cancel the order and notify user
          order.offerStatus = 'expired';
          await order.save();
          
          await sendEmail(
            order.userId.email,
            '⚠️ Offer Update - MealSetu',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #ef4444;">Offer No Longer Available</h1>
              <p>Dear ${order.userId.name},</p>
              <p>We regret to inform you that the offer you redeemed from <strong>${order.vendorId.kitchenName}</strong> is no longer available as the offer has been removed by the vendor.</p>
              <p>Please browse new offers on your dashboard to find other exciting deals!</p>
              <a href="#" style="background: #f26522; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Browse Offers</a>
              <hr/>
              <p style="color: #999; font-size: 12px;">MealSetu - Quality Food, Delivered with Care</p>
            </div>`
          );
          continue;
        }

        // Check if offer is still active
        const offerEndDate = new Date(offer.endDate);
        offerEndDate.setHours(23, 59, 59, 999);
        
        if (now > offerEndDate) {
          // Offer has expired - cancel the order and notify user
          order.offerStatus = 'expired';
          await order.save();
          
          await sendEmail(
            order.userId.email,
            '⚠️ Offer Expired - MealSetu',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #ef4444;">Offer Expired</h1>
              <p>Dear ${order.userId.name},</p>
              <p>We regret to inform you that the offer from <strong>${order.vendorId.kitchenName}</strong> that you redeemed has expired before it could be activated.</p>
              <div style="background: #f5f5f5; padding: 15px; margin: 15px 0;">
                <p><strong>Plan:</strong> ${order.planType}</p>
                <p><strong>Offer Valid Until:</strong> ${offerEndDate.toLocaleDateString()}</p>
              </div>
              <p>Please browse new offers on your dashboard to find other exciting deals!</p>
              <a href="#" style="background: #f26522; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Browse Offers</a>
              <hr/>
              <p style="color: #999; font-size: 12px;">MealSetu - Quality Food, Delivered with Care</p>
            </div>`
          );
          continue;
        }

        // Activate the order
        order.offerStatus = 'active';
        order.orderStatus = 'Preparing';
        await order.save();

        // Update the subscription to active
        await Subscription.findOneAndUpdate(
          { userId: order.userId._id, offerId: offer._id, status: 'pending' },
          { status: 'active' }
        );

        // Update user expiry date
        const subscription = await Subscription.findOne({
          userId: order.userId._id,
          vendorId: order.vendorId._id,
          status: 'active'
        });

        if (subscription) {
          await User.findByIdAndUpdate(order.userId._id, {
            expiryDate: subscription.expiryDate
          });
        }

        // Send activation email to user
        const emailSubject = `🎉 Your Discounted Plan is Now Active! - ${order.vendorId.kitchenName}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🎉 Offer Activated!</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Dear <strong>${order.userId.name}</strong>,</p>
              <p style="font-size: 16px;">Great news! Your discounted plan from <strong>${order.vendorId.kitchenName}</strong> is now active!</p>
              
              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #16a34a;">
                <h3 style="color: #16a34a; margin: 0 0 15px 0;">📋 Order Details</h3>
                <p style="margin: 8px 0;"><strong>🏪 Vendor:</strong> ${order.vendorId.kitchenName}</p>
                <p style="margin: 8px 0;"><strong>📦 Plan Type:</strong> ${order.planType}</p>
                <p style="margin: 8px 0;"><strong>💰 Original Price:</strong> ₹${order.originalPrice}</p>
                <p style="margin: 8px 0;"><strong>🏷️ Discount:</strong> ${order.discountPercentage}% OFF</p>
                <p style="margin: 8px 0; font-size: 18px; color: #16a34a;"><strong>✅ Amount Paid:</strong> ₹${order.discountedPrice}</p>
                <p style="margin: 8px 0;"><strong>📅 Start Date:</strong> ${new Date(order.scheduledActivationDate).toLocaleDateString('en-IN')}</p>
                <p style="margin: 8px 0;"><strong>📅 End Date:</strong> ${subscription ? new Date(subscription.expiryDate).toLocaleDateString('en-IN') : 'N/A'}</p>
              </div>
              
              <p style="color: #555;">Your discounted meal subscription is now active. Enjoy your delicious meals!</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="#" style="background: #f26522; color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">Order Your Meals Now</a>
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>MealSetu - Quality Food, Delivered with Care</p>
            </div>
          </div>
        `;

        await sendEmail(order.userId.email, emailSubject, emailHtml);

        console.log(`✅ Activated offer order ${order._id} for user ${order.userId.name}`);
      } catch (orderError) {
        console.error(`❌ Error processing order ${order._id}:`, orderError);
      }
    }

    console.log('✅ Cron job completed: Processed pending offer orders');
  } catch (error) {
    console.error('❌ Cron job error:', error);
  }
};

// Schedule cron job to run every day at midnight
// The cron expression: '0 0 * * *' means at 00:00 (midnight) every day
const startOfferActivationCron = () => {
  console.log('📅 Offer activation cron job scheduled to run daily at midnight');
  
  // Run immediately on startup (for testing)
  // processPendingOfferOrders();
  
  // Schedule for midnight every day
  cron.schedule('0 0 * * *', () => {
    processPendingOfferOrders();
  });
};

module.exports = {
  startOfferActivationCron,
  processPendingOfferOrders
};

