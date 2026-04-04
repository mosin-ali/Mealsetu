const cron = require('node-cron');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Offer = require('../models/Offer');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { sendEmail } = require('../utils/emailUtils');

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
        order.status = 'active';
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

// Function to process all pending subscription orders (including non-offer extensions)
const processPendingSubscriptionOrders = async () => {
  console.log('🔄 Running cron job: Processing pending subscription orders...');
  
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = new Date(now);

    // Find all pending orders where scheduledStartDate has arrived
    const pendingOrders = await Order.find({
      status: 'pending',
      scheduledStartDate: { $lte: now }
    }).populate('vendorId').populate('userId');

    console.log(`📋 Found ${pendingOrders.length} pending subscription orders to process`);

    for (const order of pendingOrders) {
      try {
        // Check if there's a previous active order that needs to be expired
        const previousActiveOrder = await Order.findOne({
          userId: order.userId._id,
          status: 'active',
          _id: { $ne: order._id }
        }).sort({ endDate: -1 });

        // If previous order has ended, expire it first
        if (previousActiveOrder && previousActiveOrder.endDate) {
          const prevEndDate = new Date(previousActiveOrder.endDate);
          if (prevEndDate < now) {
            previousActiveOrder.status = 'expired';
            await previousActiveOrder.save();
            console.log(`⏰ Expired previous order ${previousActiveOrder._id} for user ${order.userId.name}`);
          }
        }

        // Calculate actual start and end dates
        const startDate = order.scheduledStartDate || now;
        let endDate = order.scheduledEndDate;
        
        // If no scheduledEndDate, calculate based on plan type
        if (!endDate) {
          const durationDays = order.planType === 'Weekly' ? 7 : order.planType === 'Monthly' ? 30 : 7;
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + durationDays);
        }

        // Update order status to active
        order.status = 'active';
        order.startDate = startDate;
        order.endDate = endDate;
        await order.save();

        // Also update the subscription if exists
        await Subscription.findOneAndUpdate(
          { userId: order.userId._id, status: 'pending' },
          { 
            status: 'active',
            startDate: startDate,
            expiryDate: endDate
          }
        );

        // Update user expiry date
        await User.findByIdAndUpdate(order.userId._id, {
          expiryDate: endDate
        });

        // Send activation email to user
        const emailSubject = '🎉 Your Upcoming Plan is Now Active! - MealSetu';
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🎉 Plan Activated!</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Dear <strong>${order.userId.name}</strong>,</p>
              <p style="font-size: 16px;">Great news! Your upcoming plan from <strong>${order.vendorId?.kitchenName || 'MealSetu'}</strong> is now <strong>active</strong>!</p>
              
              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #16a34a;">
                <h3 style="color: #16a34a; margin: 0 0 15px 0;">📋 Plan Details</h3>
                <p style="margin: 8px 0;"><strong>🏪 Kitchen:</strong> ${order.vendorId?.kitchenName || 'MealSetu'}</p>
                <p style="margin: 8px 0;"><strong>📦 Plan Type:</strong> ${order.planType}</p>
                <p style="margin: 8px 0;"><strong>💰 Amount Paid:</strong> ₹${order.amount}</p>
                <p style="margin: 8px 0;"><strong>📅 Start Date:</strong> ${new Date(startDate).toLocaleDateString('en-IN')}</p>
                <p style="margin: 8px 0;"><strong>📅 End Date:</strong> ${new Date(endDate).toLocaleDateString('en-IN')}</p>
              </div>
              
              <p style="color: #555;">Thank you for choosing MealSetu! Enjoy your delicious meals!</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>MealSetu - Quality Food, Delivered with Care</p>
            </div>
          </div>
        `;

        await sendEmail(order.userId.email, emailSubject, emailHtml);

        console.log(`✅ Activated subscription order ${order._id} for user ${order.userId.name}`);
      } catch (orderError) {
        console.error(`❌ Error processing subscription order ${order._id}:`, orderError);
      }
    }

    console.log('✅ Cron job completed: Processed pending subscription orders');
  } catch (error) {
    console.error('❌ Cron job error:', error);
  }
};

// Function to send expiry reminder emails
const sendExpiryReminders = async () => {
  console.log('🔄 Running cron job: Sending expiry reminder emails...');
  
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Calculate 3 days from now
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);

    // Find users with active plans expiring in the next 3 days
    // who don't have any upcoming pending orders
    const users = await User.find({ role: 'user' });

    for (const user of users) {
      try {
        // Check if user has any pending orders (upcoming plans)
        const hasUpcomingPlan = await Order.findOne({
          userId: user._id,
          status: 'pending'
        });

        if (hasUpcomingPlan) {
          // User has upcoming plan, skip reminder
          continue;
        }

        // Find user's active subscription
        const activeSubscription = await Subscription.findOne({
          userId: user._id,
          status: 'active'
        });

        if (!activeSubscription) {
          // No active subscription, skip
          continue;
        }

        const expiryDate = new Date(activeSubscription.expiryDate);
        
        // Check if subscription expires within 3 days
        if (expiryDate > now && expiryDate <= threeDaysFromNow) {
          const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          // Send reminder email
          const emailSubject = `⏰ Your Plan Expires in ${daysRemaining} Days! - MealSetu`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">⏰ Plan Expiring Soon!</h1>
              </div>
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px;">Dear <strong>${user.name}</strong>,</p>
                <p style="font-size: 16px;">Your current meal plan from <strong>MealSetu</strong> will expire in <strong>${daysRemaining} day${daysRemaining > 1 ? 's' : ''}</strong>!</p>
                
                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #f59e0b;">
                  <h3 style="color: #f59e0b; margin: 0 0 15px 0;">📋 Current Plan</h3>
                  <p style="margin: 8px 0;"><strong>📅 Expires On:</strong> ${expiryDate.toLocaleDateString('en-IN')}</p>
                  <p style="margin: 8px 0;"><strong>⏱️ Days Remaining:</strong> ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}</p>
                </div>
                
                <p style="color: #dc2626; font-size: 16px; font-weight: bold;">
                  ⚠️ Don't miss out on your meals! Extend your subscription or order a new plan to continue receiving meals without interruption.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="#" style="background: #f26522; color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">Extend Subscription Now</a>
                </div>
                
                <p style="color: #555;">Visit your dashboard to explore Weekly and Monthly subscription plans.</p>
                <p style="color: #555;">Thank you for choosing MealSetu!</p>
              </div>
              <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <p>MealSetu - Quality Food, Delivered with Care</p>
              </div>
            </div>
          `;

          await sendEmail(user.email, emailSubject, emailHtml);
          console.log(`📧 Sent expiry reminder to ${user.email} (expires in ${daysRemaining} days)`);
        }
      } catch (userError) {
        console.error(`❌ Error processing user ${user.email}:`, userError);
      }
    }

    console.log('✅ Cron job completed: Sent expiry reminder emails');
  } catch (error) {
    console.error('❌ Cron job error:', error);
  }
};

// New function for Bug 2: Process expired active subscriptions and activate next pending
const processExpiredSubscriptions = async () => {
  console.log('🔄 Running cron job: Processing expired subscriptions...');
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const expiredSubs = await Subscription.find({
      status: 'active',
      expiryDate: { $lte: now }
    }).populate('userId');

    console.log(`📋 Found ${expiredSubs.length} expired subscriptions to process`);

    for (const sub of expiredSubs) {
      const userId = sub.userId._id;
      try {
        // Mark all expired active subs for this user
        const result = await Subscription.updateMany(
          { userId, status: 'active', expiryDate: { $lte: now } },
          { status: 'expired' }
        );
        if (result.modifiedCount > 0) {
          console.log(`⏰ Marked ${result.modifiedCount} expired subs for user ${sub.userId.name}`);
        }

        // Find next pending sub (earliest startDate)
        const nextPending = await Subscription.findOne(
          { userId, status: 'pending' }
        ).sort({ startDate: 1 }).populate('vendorId');

        if (nextPending) {
          // Activate it
          const startDate = new Date(now);
          let durationDays = 7; // default
          if (nextPending.planType === 'Weekly') durationDays = 7;
          else if (nextPending.planType === 'Monthly') durationDays = 30;
          else if (nextPending.planType === 'Trial') durationDays = 2;

          const expiryDate = new Date(startDate);
          expiryDate.setDate(expiryDate.getDate() + durationDays);

          nextPending.status = 'active';
          nextPending.startDate = startDate;
          nextPending.expiryDate = expiryDate;
          await nextPending.save();

          // Update user expiry
          await User.findByIdAndUpdate(userId, { expiryDate });

          // Send notification email
          const emailSubject = '🎉 Your New Subscription Plan is Now Active! - MealSetu';
          const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">🎉 New Plan Activated!</h1>
  </div>
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Dear <strong>${sub.userId.name}</strong>,</p>
    <p>Your previous plan has expired and your next queued plan from <strong>${nextPending.vendorId?.kitchenName || 'MealSetu'}</strong> is now <strong>active</strong>!</p>
    <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #16a34a;">
      <h3 style="color: #16a34a;">📋 Active Plan Details</h3>
      <p><strong>🏪 Kitchen:</strong> ${nextPending.vendorId?.kitchenName || 'MealSetu'}</p>
      <p><strong>📦 Plan:</strong> ${nextPending.planType}</p>
      <p><strong>📅 Start:</strong> ${startDate.toLocaleDateString('en-IN')}</p>
      <p><strong>📅 End:</strong> ${expiryDate.toLocaleDateString('en-IN')}</p>
    </div>
    <p>Enjoy your meals! Your remaining plans stay queued.</p>
  </div>
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>MealSetu - Quality Food, Delivered with Care</p>
  </div>
</div>`;
          await sendEmail(sub.userId.email, emailSubject, emailHtml);

          console.log(`✅ Activated next pending sub ${nextPending._id} for user ${sub.userId.name}`);
        } else {
          console.log(`ℹ️ No pending subscription found for user ${sub.userId.name}`);
        }
      } catch (userError) {
        console.error(`❌ Error processing user ${userId}:`, userError);
      }
    }
    console.log('✅ Cron job completed: Processed expired subscriptions');
  } catch (error) {
    console.error('❌ Cron error in processExpiredSubscriptions:', error);
  }
};



// Combined function to run all subscription-related cron tasks
const processAllSubscriptions = async () => {
  console.log('=== Starting combined subscription cron job ===');
  await processExpiredSubscriptions();
  await processPendingOfferOrders();
  await processPendingSubscriptionOrders();
  await sendExpiryReminders();
  console.log('=== Completed combined subscription cron job ===');
};


// Schedule cron job to run every day at midnight
// The cron expression: '0 0 * * *' means at 00:00 (midnight) every day
const startOfferActivationCron = () => {
console.log('📅 Subscription cron job (incl. auto-activation on expiry) scheduled daily at midnight');
  
  // Run immediately on startup (for testing)
  // processAllSubscriptions();
  
  // Schedule for midnight every day
  cron.schedule('0 0 * * *', () => {
    processAllSubscriptions();
  });
};

module.exports = {
  startOfferActivationCron,
  processExpiredSubscriptions,
  processPendingOfferOrders,
  processPendingSubscriptionOrders,
  sendExpiryReminders,
  processAllSubscriptions
};


