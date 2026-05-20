const cron = require('node-cron');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Commission = require('../models/Commission');
const CommissionSetting = require('../models/CommissionSetting');
const { sendEmail } = require('../utils/emailUtils');
const { getCommissionWeek } = require('../utils/commissionWeekCalculator');

// ===== HELPER: Find commission tier for an earnings amount =====
const getTierForEarnings = async (amount) => {
  const tiers = await CommissionSetting.find({ isActive: true }).sort({ minEarning: 1 });

  let matched = { tierName: 'Starter', ratePercent: 3 };
  for (const tier of tiers) {
    if (
      amount >= tier.minEarning &&
      (tier.maxEarning === null || amount <= tier.maxEarning)
    ) {
      matched = tier;
      break;
    }
  }
  return matched;
};

// ===== JOB 1: Every day 8AM — Generate commission for any rolling week that ended yesterday =====
// Running daily (not just Monday) ensures every vendor's non-Monday week-ends are caught.
const generateWeeklyCommissions = cron.schedule('0 8 * * *', async () => {
  console.log('🔄 Commission Generation Cron Started:', new Date().toLocaleString());

  try {
    const now       = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    yesterday.setUTCHours(12, 0, 0, 0); // midday yesterday — safely inside the previous day

    const vendors = await Vendor.find({
      isApproved: true,
      status:     'approved'
    }).populate('ownerId', 'email name');

    console.log(`👥 Found ${vendors.length} approved vendors`);

    for (const vendor of vendors) {
      try {
        // Rolling week is anchored to vendor's first order date
        const firstOrder = await Order.findOne({ vendorId: vendor._id }).sort({ orderDate: 1, createdAt: 1 }).select('createdAt orderDate startDate');
        if (!firstOrder) continue;
        const anchorDate = firstOrder.createdAt || firstOrder.orderDate || firstOrder.startDate;
        if (!anchorDate) continue;

        const weekInfo = getCommissionWeek(anchorDate, yesterday);
        if (!weekInfo) continue;

        // Only generate if this rolling week actually ended yesterday (i.e. weekEnd = yesterday's date)
        const weekEndDate = new Date(weekInfo.weekEnd);
        weekEndDate.setUTCHours(0, 0, 0, 0);
        const yesterdayDate = new Date(yesterday);
        yesterdayDate.setUTCHours(0, 0, 0, 0);
        if (weekEndDate.getTime() !== yesterdayDate.getTime()) continue;

        // Idempotency — skip if already generated
        const existing = await Commission.findOne({
          vendorId: vendor._id,
          week:     weekInfo.weekKey
        });
        if (existing) {
          console.log(`⏭️ Already exists: ${vendor.kitchenName} — ${weekInfo.weekKey}`);
          continue;
        }

        // Sum orders in this rolling week window
        const weekOrders = await Order.find({
          vendorId:  vendor._id,
          createdAt: { $gte: weekInfo.weekStart, $lte: weekInfo.weekEnd },
          status:    { $in: ['active', 'completed'] }
        });

        const totalEarning = weekOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        if (totalEarning === 0) {
          console.log(`⏭️ No earnings: ${vendor.kitchenName} — ${weekInfo.weekKey}`);
          continue;
        }

        const tier             = await getTierForEarnings(totalEarning);
        const commissionAmount = Math.round(totalEarning * tier.ratePercent / 100);

        const weekLabel = `${weekInfo.weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekInfo.weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

        const settlementNum = `MS-${weekInfo.financialYear}-W${String(weekInfo.fyWeekNumber).padStart(2,'0')}-${String(vendor._id).slice(-4).toUpperCase()}`;

        const commission = await Commission.create({
          vendorId:            vendor._id,
          week:                weekInfo.weekKey,
          month:               weekInfo.weekKey,
          weekStart:           weekInfo.weekStart,
          weekEnd:             weekInfo.weekEnd,
          financialYear:       weekInfo.financialYear,
          financialWeekNumber: weekInfo.fyWeekNumber,
          total_orders:        weekOrders.length,
          total_earning:       totalEarning,
          commission_rate:     tier.ratePercent,
          commission_amount:   commissionAmount,
          status:              'pending',
          due_date:            weekInfo.dueDate,
          notes:               `Week: ${weekLabel}`,
          isLocked:            true,
          lockedAt:            new Date(),
          lockedBy:            'cron',
          settlementNumber:    settlementNum,
          reminderCount:       0,
          tierSnapshot: {
            tierName:    tier.tierName    || 'Starter',
            minEarning:  tier.minEarning  || 0,
            maxEarning:  tier.maxEarning  || null,
            ratePercent: tier.ratePercent || 3
          },
          auditLog: [{
            action:      'created',
            performedBy: 'cron',
            at:          new Date(),
            note:        `Week ${weekInfo.weekKey} locked by cron. Earnings: ₹${totalEarning}, Commission: ₹${commissionAmount}`,
            valueBefore: {},
            valueAfter:  { isLocked: true, commission_amount: commissionAmount }
          }]
        });

        console.log(`✅ Commission created: ${vendor.kitchenName} — ${weekInfo.weekKey} — ₹${commissionAmount}`);

        // Email vendor
        try {
          const vendorEmail = vendor.ownerId?.email;
          if (vendorEmail) {
            await sendEmail(
              vendorEmail,
              `MealSetu — Weekly Commission Due for ${weekLabel}`,
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#f97316;padding:20px;text-align:center;border-radius:10px 10px 0 0">
                  <h1 style="color:white;margin:0">MealSetu</h1>
                </div>
                <div style="background:white;padding:30px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb">
                  <h2 style="color:#1a2240">Weekly Commission Statement</h2>
                  <p>Dear <strong>${vendor.kitchenName}</strong>,</p>
                  <p>Your weekly commission has been calculated for <strong>${weekLabel}</strong>.</p>
                  <div style="background:#f8fafc;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #f97316">
                    <table style="width:100%;border-collapse:collapse">
                      <tr>
                        <td style="padding:8px 0;color:#64748b">Financial Year</td>
                        <td style="padding:8px 0;font-weight:600;text-align:right">${weekInfo.financialYear}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b">Week</td>
                        <td style="padding:8px 0;font-weight:600;text-align:right">${weekInfo.weekKey}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b">Period</td>
                        <td style="padding:8px 0;font-weight:600;text-align:right">${weekLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b">Total Orders</td>
                        <td style="padding:8px 0;font-weight:600;text-align:right">${weekOrders.length}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b">Total Earnings</td>
                        <td style="padding:8px 0;font-weight:600;text-align:right">₹${totalEarning.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b">Commission Rate</td>
                        <td style="padding:8px 0;font-weight:600;text-align:right">${tier.ratePercent}% (${tier.tierName})</td>
                      </tr>
                      <tr style="border-top:2px solid #e5e7eb">
                        <td style="padding:12px 0;color:#dc2626;font-weight:700;font-size:18px">Commission Due</td>
                        <td style="padding:12px 0;color:#dc2626;font-weight:700;font-size:18px;text-align:right">₹${commissionAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    </table>
                  </div>
                  <div style="background:#fef3c7;padding:15px;border-radius:8px;margin:20px 0">
                    <p style="margin:0;color:#92400e">
                      ⏰ <strong>Due Date:</strong> ${weekInfo.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <p>Please login to your vendor dashboard and pay via Razorpay.</p>
                  <p style="color:#64748b;font-size:13px;margin-top:30px">Thank you for being part of MealSetu!</p>
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

    console.log('✅ Commission Generation Cron Completed');
  } catch (error) {
    console.error('❌ Commission Generation Cron Error:', error);
  }
}, {
  scheduled: false
});

// ===== JOB 2: Every day 9AM — Mark overdue if due_date has passed and still pending =====
const markOverdueCommissions = cron.schedule('0 9 * * *', async () => {
  console.log('🔄 Overdue Check Cron Started:', new Date().toLocaleString());

  try {
    const now = new Date();

    const overdueCommissions = await Commission.find({
      status:   { $in: ['pending', 'pending_verification'] },
      due_date: { $lt: now }
    }).populate('vendorId');

    console.log(`⚠️ Found ${overdueCommissions.length} overdue commissions`);

    for (const commission of overdueCommissions) {
      commission.status = 'overdue';
      await commission.save();

      console.log(`🔴 Marked overdue: ${commission.vendorId?.kitchenName} — ${commission.week}`);

      try {
        const vendor = await Vendor.findById(commission.vendorId).populate('ownerId', 'email name');
        const vendorEmail = vendor?.ownerId?.email;

        if (vendorEmail) {
          const weekLabel = commission.weekStart && commission.weekEnd
            ? `${new Date(commission.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(commission.weekEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : (commission.notes || commission.week);

          await sendEmail(
            vendorEmail,
            'URGENT: MealSetu Commission Payment Overdue',
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#dc2626;padding:20px;text-align:center;border-radius:10px 10px 0 0">
                <h1 style="color:white;margin:0">⚠️ Payment Overdue</h1>
              </div>
              <div style="background:white;padding:30px;border-radius:0 0 10px 10px;border:1px solid #fecaca">
                <p>Dear <strong>${vendor.kitchenName}</strong>,</p>
                <p>Your commission payment is <strong style="color:#dc2626">OVERDUE</strong>.</p>
                <div style="background:#fef2f2;padding:20px;border-radius:8px;border-left:4px solid #dc2626;margin:20px 0">
                  <p style="margin:0"><strong>Week:</strong> ${weekLabel}</p>
                  <p style="margin:8px 0 0"><strong>Amount Due:</strong>
                    <span style="color:#dc2626;font-size:20px;font-weight:700">
                      ₹${commission.commission_amount?.toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>
                <p>Please pay immediately via your vendor dashboard to avoid service interruption.</p>
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
  console.log('✅ Commission Cron Jobs Started');
  console.log('   → Commission generation: Every day at 8:00 AM (rolling weeks)');
  console.log('   → Overdue check: Every day at 9:00 AM');
};

module.exports = { startWeeklyCommissionCron };
