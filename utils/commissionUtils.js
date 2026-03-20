const CommissionSetting = require('../models/CommissionSetting');
const Commission = require('../models/Commission');
const Order = require('../models/Order');
const Vendor = require('../models/Vendor');

/**
 * Get commission tier for given monthly earning
 */
async function getTierForEarnings(totalEarning) {
  const tiers = await CommissionSetting.find({ isActive: true })
    .sort({ minEarning: 1 })
    .lean();

  for (const tier of tiers) {
    if (totalEarning >= tier.minEarning && 
        (tier.maxEarning === null || totalEarning <= tier.maxEarning)) {
      return tier;
    }
  }
  
  // Default fallback tier
  return tiers[0] || { ratePercent: 3 };
}

/**
 * Calculate monthly earning for vendor from completed (Delivered) orders
 */
async function calculateMonthlyEarning(vendorId, month) {
  // Parse month YYYY-MM to date range
  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0, 23, 59, 59);

  const orders = await Order.aggregate([
    {
      $match: {
        vendorId,
        orderStatus: 'Delivered',
        orderDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        total_earning: { $sum: '$amount' }
      }
    }
  ]);

  return orders[0] || { totalOrders: 0, total_earning: 0 };
}

/**
 * Check if monthly commission already exists
 */
async function monthlyCommissionExists(vendorId, month) {
  const existing = await Commission.findOne({ 
    vendorId, 
    month 
  });
  return !!existing;
}

/**
 * MAIN CRON FUNCTION: Generate monthly commissions for all approved vendors
 * Run on 1st of every month for PREVIOUS month
 */
async function generateMonthlyCommissions() {
  try {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
    const monthStr = prevMonth.toISOString().slice(0, 7); // YYYY-MM
    
    console.log(`🧾 Generating commissions for ${monthStr}...`);
    
    // Get all approved vendors
    const vendors = await Vendor.find({ isApproved: true }).select('_id');
    
    for (const vendor of vendors) {
      // Skip if already exists
      const existing = await monthlyCommissionExists(vendor._id, monthStr);
      if (existing) {
        console.log(`⏭️ Skipping ${vendor._id} - already generated`);
        continue;
      }
      
      // Calculate earnings
      const earningData = await calculateMonthlyEarning(vendor._id, monthStr);
      if (earningData.total_earning === 0) {
        console.log(`⚪ Zero earnings for ${vendor._id}`);
        continue;
      }
      
      // Get tier
      const tier = await getTierForEarnings(earningData.total_earning);
      
      // Create commission record
      const commission = new Commission({
        vendorId: vendor._id,
        month: monthStr,
        totalOrders: earningData.totalOrders,
        total_earning: earningData.total_earning,
        commission_rate: tier.ratePercent,
        commission_amount: Math.round(earningData.total_earning * tier.ratePercent / 100),
        status: 'pending',
        due_date: new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 10) // 10th of next month
      });
      
      await commission.save();
      console.log(`✅ Created commission for ${vendor._id}: ₹${commission.commission_amount}`);
    }
    
    console.log('🎉 Monthly commissions generation complete');
  } catch (error) {
    console.error('❌ Commission generation failed:', error);
  }
}

/**
 * Daily CRON: Set overdue commissions (>10 days pending)
 */
async function setOverdueCommissions() {
  try {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    
    const overdue = await Commission.updateMany(
      {
        status: 'pending',
        due_date: { $lt: tenDaysAgo }
      },
      { status: 'overdue' }
    );
    
    console.log(`⚠️  Marked ${overdue.modifiedCount} commissions as overdue`);
  } catch (error) {
    console.error('❌ Overdue check failed:', error);
  }
}

module.exports = {
  getTierForEarnings,
  calculateMonthlyEarning,
  monthlyCommissionExists,
  generateMonthlyCommissions,
  setOverdueCommissions
};

