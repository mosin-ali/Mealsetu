const cron = require('node-cron');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Commission = require('../models/Commission');
const CommissionSetting = require('../models/CommissionSetting');
const { sendEmail } = require('../utils/emailUtils');

// ===== HELPER: Get tier for earnings amount =====
const getTierForEarnings = async (amount) => {
  const tiers = await CommissionSetting.find({ isActive: true }).sort({ minEarning: 1 });
  
  let matchedTier = { tierName: 'Starter', ratePercent: 3 }; // default
  
  for (const tier of tiers) {
    if (
      amount >= tier.minEarning &&
      (tier.maxEarning === null || amount <= tier.maxEarning)
    ) {
      matchedTier = tier;
      break;
    }
  }
  
  return matchedTier;
};

// ===== HELPER: Get previous week range (Mon to Sun) =====
const getPreviousWeekRange = () => {
  const now = new Date();

  // Find last Monday
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  // Start of THIS week Monday
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  // Start of LAST week Monday (7 days before this Monday)
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  // End of LAST week Sunday
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  // Week number
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((lastMonday - startOfYear) / 86400000) + 1) / 7);
  const weekKey = `${lastMonday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

  const weekLabel = `${lastMonday.toLocaleDateString('en-IN', { 
    day: 'numeric', month: 'short' 
  })} - ${lastSunday.toLocaleDateString('en-IN', { 
    day: 'numeric', month: 'short', year: 'numeric' 
  })}`;

  return { lastMonday, lastSunday, weekKey, weekLabel };
};

// ===== JOB 1: Every Monday 8AM — Generate weekly commission records =====
const generateWeeklyCommissions = cron.schedule('0 8 * * 1', async () => {
  console.log('🔄 Weekly Commission Cron Started:', new Date().toLocaleString());

  try {
    const { lastMonday, lastSunday, weekKey, weekLabel } = getPreviousWeekRange();
    
    console.log(`📅 Processing week: ${weekLabel} (${weekKey})`);
    console.log(`📅 Range: ${lastMonday} to ${lastSunday}`);

    // Get all approved vendors
    const vendors = await Vendor.find({ 
      isApproved: true, 
      status: 'approved' 
    }).populate('ownerId', 'email name');

    console.log(`👥 Found ${vendors.length} approved vendors`);

    for (const vendor of vendors) {
      try {
        // Check if commission already exists for this week
        const existing = await Commission.findOne({
          vendorId: vendor._id,
          month: weekKey
        });

        if (existing) {
          console.log(`⏭️ Commission already exists for ${vendor.kitchenName} - ${weekKey}`);
          continue;
        }

        // Sum all orders for this vendor in the previous week
        const orders = await Order.find({
          vendorId: vendor._id,
          orderDate: { $gte: lastMonday, $lte: lastSunday }
        });

        const totalEarning = orders.reduce((sum, order) => {
          return sum + (order.amount || 0);
        }, 0);

        console.log(`💰 ${vendor.kitchenName}: ${orders.length} orders, ₹${totalEarning} earned`);

        // Skip if no earnings this week
        if (totalEarning === 0) {
          console.log(`⏭️ Skipping ${vendor.kitchenName} - no earnings this week`);
          continue;
        }

        // Get commission tier
        const tier = await getTierForEarnings(totalEarning);
        const commissionAmount = Math.round(totalEarning * tier.ratePercent / 100);

        // Due date = next Sunday (7 days to pay)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        // Create commission record
        const commission = await Commission.create({
          vendorId: vendor._id,
          month: weekKey,
          total_orders: orders.length,
          total_earning: totalEarning,
          commission_rate: tier.ratePercent,
          commission_amount: commissionAmount,
          status: 'pending',
          due_date: dueDate,
          notes: `Week: ${weekLabel}`
        });

        console.log(`✅ Commission created for ${vendor.kitchenName}: ₹${commissionAmount}`);

        // Send email to vendor
        try {
          const vendorEmail = vendor.ownerId?.email;
          if (vendorEmail) {
            await sendEmail(
              vendorEmail,
              `MealSetu - Weekly Commission Due for ${weekLabel}`,
              `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #f97316; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0;">MealSetu</h1>
                </div>
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                  <h2 style="color: #1a2240;">Weekly Commission Statement</h2>
                  <p>Dear <strong>${vendor.kitchenName}</strong>,</p>
                  <p>Your weekly commission has been calculated for <strong>${weekLabel}</strong>.</p>
                  
                  <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b;">Week</td>
                        <td style="padding: 8px 0; font-weight: 600; text-align: right;">${weekLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b;">Total Orders</td>
                        <td style="padding: 8px 0; font-weight: 600; text-align: right;">${orders.length}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b;">Total Earnings</td>
                        <td style="padding: 8px 0; font-weight: 600; text-align: right;">₹${totalEarning.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b;">Commission Rate</td>
                        <td style="padding: 8px 0; font-weight: 600; text-align: right;">${tier.ratePercent}% (${tier.tierName})</td>
                      </tr>
                      <tr style="border-top: 2px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #dc2626; font-weight: 700; font-size: 18px;">Commission Due</td>
                        <td style="padding: 12px 0; color: #dc2626; font-weight: 700; font-size: 18px; text-align: right;">₹${commissionAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    </table>
                  </div>

                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #92400e;">
                      ⏰ <strong>Due Date:</strong> ${dueDate.toLocaleDateString('en-IN', { 
                        day: 'numeric', month: 'long', year: 'numeric' 
                      })}
                    </p>
                  </div>

                  <h3 style="color: #1a2240;">Payment Instructions</h3>
                  <p><strong>UPI:</strong> mealsetu@paytm</p>
                  <p><strong>Bank:</strong> HDFC A/c XXXX6789 (MealSetu)</p>
                  
                  <p style="margin-top: 20px;">
                    Please login to your vendor dashboard and upload the payment proof after paying.
                  </p>

                  <p style="color: #64748b; font-size: 13px; margin-top: 30px;">
                    Thank you for being part of MealSetu!
                  </p>
                </div>
              </div>`
            );
            console.log(`📧 Email sent to ${vendorEmail}`);
          }
        } catch (emailErr) {
          console.error(`❌ Email failed for ${vendor.kitchenName}:`, emailErr.message);
        }

      } catch (vendorErr) {
        console.error(`❌ Error processing ${vendor.kitchenName}:`, vendorErr.message);
      }
    }

    console.log('✅ Weekly Commission Cron Completed');

  } catch (error) {
    console.error('❌ Weekly Commission Cron Error:', error);
  }
}, {
  scheduled: false // Will be started manually below
});

// ===== JOB 2: Every day 9AM — Mark overdue if not paid within 7 days =====
const markOverdueCommissions = cron.schedule('0 9 * * *', async () => {
  console.log('🔄 Overdue Check Cron Started:', new Date().toLocaleString());

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Find all pending commissions older than 7 days
    const overdueCommissions = await Commission.find({
      status: 'pending',
      createdAt: { $lte: sevenDaysAgo }
    }).populate('vendorId');

    console.log(`⚠️ Found ${overdueCommissions.length} overdue commissions`);

    for (const commission of overdueCommissions) {
      commission.status = 'overdue';
      await commission.save();

      console.log(`🔴 Marked overdue: ${commission.vendorId?.kitchenName} - ${commission.month}`);

      // Send overdue reminder email
      try {
        const vendor = await Vendor.findById(commission.vendorId).populate('ownerId', 'email name');
        const vendorEmail = vendor?.ownerId?.email;

        if (vendorEmail) {
          await sendEmail(
            vendorEmail,
            'URGENT: MealSetu Commission Payment Overdue',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc2626; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">⚠️ Payment Overdue</h1>
              </div>
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #fecaca;">
                <p>Dear <strong>${vendor.kitchenName}</strong>,</p>
                <p>Your commission payment is <strong style="color: #dc2626;">OVERDUE</strong>.</p>
                
                <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Week:</strong> ${commission.notes || commission.month}</p>
                  <p style="margin: 8px 0;"><strong>Amount Due:</strong> 
                    <span style="color: #dc2626; font-size: 20px; font-weight: 700;">
                      ₹${commission.commission_amount?.toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>

                <p>Please pay immediately to avoid service interruption.</p>
                <p><strong>UPI:</strong> mealsetu@paytm</p>
                <p><strong>Bank:</strong> HDFC A/c XXXX6789 (MealSetu)</p>
                <p>Login to dashboard and upload payment proof after paying.</p>
              </div>
            </div>`
          );
        }
      } catch (emailErr) {
        console.error('❌ Overdue email failed:', emailErr.message);
      }
    }

    console.log('✅ Overdue Check Cron Completed');
  } catch (error) {
    console.error('❌ Overdue Check Cron Error:', error);
  }
}, {
  scheduled: false
});

// ===== START BOTH CRON JOBS =====
const startWeeklyCommissionCron = () => {
  generateWeeklyCommissions.start();
  markOverdueCommissions.start();
  console.log('✅ Weekly Commission Cron Jobs Started');
  console.log('   → Commission generation: Every Monday at 8:00 AM');
  console.log('   → Overdue check: Every day at 9:00 AM');
};

module.exports = { startWeeklyCommissionCron };