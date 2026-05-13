const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Order = require('../models/Order');
const PlatformSetting = require('../models/PlatformSetting');
const Commission = require('../models/Commission');
const CommissionPayment = require('../models/CommissionPayment');
const { sendEmail } = require('../utils/emailUtils');

// @desc    Get platform settings (commission rate, etc)
// @route   GET /api/admin/settings
const getPlatformSettings = async (req, res) => {
  try {
    let settings = await PlatformSetting.findOne();
    if (!settings) {
      settings = await PlatformSetting.create({ commissionRate: 10 });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update commission rate
// @route   PUT /api/admin/settings/commission
const updateCommissionRate = async (req, res) => {
  try {
    const { commissionRate } = req.body;
    let settings = await PlatformSetting.findOne();
    if (!settings) {
      settings = await PlatformSetting.create({ commissionRate });
    } else {
      settings.commissionRate = commissionRate;
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all users


const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all pending vendor requests
// @route   GET /api/admin/vendor-requests
const getPendingVendors = async (req, res) => {
  try {
    console.log('🔍 Fetching pending vendors - STRICT QUERY ONLY');

    const vendors = await Vendor.find({ 
      status: 'pending', 
      isApproved: { $ne: true } 
    })
    .sort({ 
      resubmittedAt: -1,  // Resubmissions first
      createdAt: -1       // Then newest first
    })
    .select('-password')
    .populate('ownerId', 'name email phone');

    console.log(`✅ Found ${vendors.length} pending vendors:`, vendors.map(v => `Kitchen: ${v.kitchenName}, Status: ${v.status}, isApproved: ${v.isApproved}`));
    return res.status(200).json({ vendors });

  } catch (error) {
    console.error('❌ getPendingVendors error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};


// @desc    Approve vendor request
// @route   POST /api/admin/vendor-requests/approve
const approveVendor = async (req, res) => {
  try {
    const { vendorId } = req.body;
    console.log('🔄 Approving vendorId:', vendorId);
    if (!vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { $set: { isApproved: true, status: 'approved', approvalStatus: 'Approved' } },
      { new: true, runValidators: false }
    ).populate('ownerId', 'name email');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    console.log('Vendor approved in DB:', vendor._id, 'isApproved:', vendor.isApproved, 'status:', vendor.status);
    try {
      const toEmail = vendor.email || vendor.ownerId?.email;
      if (toEmail) {
        await sendEmail(
          toEmail,
          'Your MealSetu Vendor Account is Approved',
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#f26522;padding:30px;text-align:center">
              <h1 style="color:white;margin:0">MealSetu</h1>
            </div>
            <div style="background:white;padding:30px">
              <h2 style="color:#16a34a">Congratulations! Your Kitchen is Now Live</h2>
              <p>Dear ${vendor.kitchenName || 'Vendor'},</p>
              <p>Your vendor account has been approved. Your kitchen is now visible to users on MealSetu.</p>
              <p>Login to your vendor dashboard to start managing your menu and orders.</p>
            </div>
          </div>`
        );
      }
    } catch (emailErr) {
      console.error('Email failed:', emailErr.message);
    }
    return res.status(200).json({ message: 'Vendor approved successfully', vendor });
  } catch (error) {
    console.error('approveVendor error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Reject vendor request
// @route   POST /api/admin/vendor-requests/reject
const rejectVendor = async (req, res) => {
  try {
    const { vendorId, rejectionReason } = req.body;

    if (!vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    console.log('Rejecting vendor:', vendorId, 'Reason:', rejectionReason);

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        $set: {
          isApproved: false,
          status: 'rejected',
          approvalStatus: 'Rejected',
          rejectionReason: rejectionReason.trim()
        }
      },
      { new: true, runValidators: false }
    ).populate('ownerId', 'name email');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    console.log('Vendor rejected in DB successfully. Status:', vendor.status, 'isApproved:', vendor.isApproved, 'rejectionReason:', vendor.rejectionReason);

    try {
      const toEmail = vendor.email || vendor.ownerId?.email;
      if (toEmail) {
        await sendEmail(
          toEmail,
          'Update on Your MealSetu Vendor Application',
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#f26522;padding:30px;text-align:center;border-radius:10px 10px 0 0">
              <h1 style="color:white;margin:0">MealSetu</h1>
            </div>
            <div style="background:white;padding:30px;border-radius:0 0 10px 10px">
              <h2 style="color:#ef4444">Application Update</h2>
              <p>Dear ${vendor.kitchenName || 'Vendor'},</p>
              <p>We have reviewed your vendor application and could not approve it at this time.</p>
              <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:20px 0;border-radius:0 8px 8px 0">
                <strong>Reason for Rejection:</strong><br/><br/>${rejectionReason.trim()}
              </div>
              <p>Please address the above concerns and submit your application again from the Compliance section of your vendor dashboard.</p>
              <p style="color:#64748b;font-size:13px;margin-top:20px">Thank you for your interest in MealSetu.</p>
            </div>
          </div>`
        );
      }
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return res.status(200).json({
      message: 'Vendor rejected successfully',
      vendor: vendor
    });

  } catch (error) {
    console.error('rejectVendor error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

// New vendor stats controller
const getAllVendorsForAdmin = async (req, res) => {
  try {
    console.log('Fetching all vendors with subscriber stats...');
    const vendors = await Vendor.find({}).populate('ownerId', 'name email phone').lean();
    
    const vendorsWithStats = await Promise.all(
      vendors.map(async (vendor) => {
        const subscriberResult = await Order.aggregate([
          { $match: { vendorId: vendor._id } },
          {
            $group: {
              _id: null,
              appUserIds: {
                $addToSet: {
                  $cond: [
                    { $eq: ['$isManualOrder', true] },
                    '$$REMOVE',
                    '$userId'
                  ]
                }
              },
              manualPhones: {
                $addToSet: {
                  $cond: [
                    { $eq: ['$isManualOrder', true] },
                    '$manualCustomerPhone',
                    '$$REMOVE'
                  ]
                }
              }
            }
          },
          {
            $project: {
              count: {
                $add: [
                  { $size: '$appUserIds' },
                  { $size: '$manualPhones' }
                ]
              }
            }
          }
        ]);
        const subscriberCount = subscriberResult[0]?.count || 0;

        const fixImageUrl = (imgPath, req) => {
          if (!imgPath) return null;
          if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) return imgPath;
          const backendUrl = `${req.protocol}://${req.get('host')}`;
          return imgPath.startsWith('/')
            ? `${backendUrl}${imgPath}`
            : `${backendUrl}/${imgPath}`;
        };

        return {
          _id: vendor._id.toString(),
          kitchenName: vendor.kitchenName,
          ownerName: vendor.ownerId?.name || vendor.ownerName,
          email: vendor.ownerId?.email || null,
          phone: vendor.ownerId?.phone || vendor.phone || 'N/A',
          profileImage: fixImageUrl(vendor.profileImage, req),
          status: vendor.status,
          isApproved: vendor.isApproved,
          subscriberCount,
          joinDate: vendor.createdAt
        };

      })
    );

    res.status(200).json({ 
      vendors: vendorsWithStats.sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate))
    });
  } catch (error) {
    console.error('getAllVendorsForAdmin error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};


// Get subscribers for specific vendor
const getVendorSubscribers = async (req, res) => {
  try {
    const { vendorId } = req.params;
    console.log(`Fetching subscribers for vendor ${vendorId}...`);
    
    // Validate vendorId first
    if (!vendorId || vendorId === 'undefined' || vendorId.trim() === '') {
      return res.status(400).json({ message: 'Vendor ID is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: 'Invalid vendor ID format' });
    }
    
    const vendor = await Vendor.findById(vendorId).select('kitchenName');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const now = new Date();
    const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);

    // Fetch all orders for this vendor, sorted newest first
    const allOrders = await Order.find({
      vendorId: new mongoose.Types.ObjectId(vendorId)
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone address pincode joinDate')
      .lean();

    const customerMap = new Map();

    for (const order of allOrders) {
      const isManual = order.isManualOrder === true;
      const key = isManual
        ? `manual_${order.manualCustomerPhone}`
        : order.userId?._id?.toString();

      if (!key) continue;

      if (!customerMap.has(key)) {
        let joinDate = null;
        if (isManual) {
          joinDate = order.orderDate;
        } else {
          joinDate = order.userId?.joinDate
            || (order.userId?._id
                ? new Date(parseInt(order.userId._id.toString().slice(0, 8), 16) * 1000)
                : null)
            || order.orderDate;
        }

        customerMap.set(key, {
          _id: key,
          name: isManual
            ? (order.manualCustomerName || 'Offline Customer')
            : (order.userId?.name || 'Unknown'),
          email: isManual ? '—' : (order.userId?.email || '—'),
          phone: isManual
            ? (order.manualCustomerPhone || 'N/A')
            : (order.userId?.phone || 'N/A'),
          joinDate,
          lastOrderDate: order.orderDate,
          isManual,
          hasActiveSubscription: false,
          orderCount: 0
        });
      } else if (isManual) {
        // Sorted newest-first: update joinDate to earlier value as older orders arrive
        const entry = customerMap.get(key);
        if (order.orderDate < entry.joinDate) {
          entry.joinDate = order.orderDate;
        }
      }

      const entry = customerMap.get(key);
      entry.orderCount += 1;

      // Derive endDate from startDate + planDuration when endDate is missing
      const PLAN_DAYS = { Weekly: 7, Monthly: 30, Trial: 1, Tiffin: 1 };
      const planDuration = PLAN_DAYS[order.planType] || 7;
      const orderStart = order.startDate ? new Date(order.startDate) : null;
      let orderEnd = order.endDate ? new Date(order.endDate) : null;
      if (!orderEnd && orderStart) {
        orderEnd = new Date(orderStart);
        orderEnd.setDate(orderEnd.getDate() + planDuration);
      }

      const isCurrentlyActive =
        (order.status === 'active' || order.status === 'trial') &&
        orderStart !== null &&
        orderStart <= todayStart &&
        orderEnd !== null &&
        orderEnd >= todayStart;

      if (isCurrentlyActive) {
        entry.hasActiveSubscription = true;
      }
    }

    const users = Array.from(customerMap.values()).map(entry => {
      const lastActive = entry.lastOrderDate ? new Date(entry.lastOrderDate) : null;
      const daysSinceActive = lastActive
        ? Math.floor((now - lastActive) / (1000 * 60 * 60 * 24))
        : null;

      // isActive = has a running subscription today, or ordered within last 50 days
      // (50-day fallback covers legacy orders without proper endDate)
      const isActive = entry.hasActiveSubscription
        || (daysSinceActive !== null && daysSinceActive <= 50);

      return {
        _id: entry._id,
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        joinDate: entry.joinDate ? new Date(entry.joinDate).toISOString() : null,
        lastActiveDate: lastActive ? lastActive.toISOString() : null,
        daysSinceActive,
        isActive,
        isManual: entry.isManual,
        totalOrders: entry.orderCount
      };
    });

    users.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    const totalManualCustomers = users.filter(u => u.isManual).length;

    return res.status(200).json({
      users,
      vendorName: vendor.kitchenName,
      totalAppUsers: users.length - totalManualCustomers,
      totalManualCustomers
    });
  } catch (error) {
    console.error('getVendorSubscribers FULL ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Auto mark globally inactive users (for cron)
const autoMarkInactiveUsers = async (req, res) => {
  try {
    console.log('Running autoMarkInactiveUsers cron...');
    
    const users = await User.find({}).lean();
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    let updatedCount = 0;

    for (const user of users) {
      const latestOrder = await Order.findOne({ userId: user._id })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();
      
      const lastActive = latestOrder?.createdAt || user.joinDate || now;
      const daysSinceActive = Math.floor((now - lastActive) / dayMs);
      
      const update = daysSinceActive > 50 ? { isActive: false } : { isActive: true };
      if (update.isActive !== user.isActive) {
        await User.findByIdAndUpdate(user._id, {
          ...update,
          lastActiveDate: lastActive
        });
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} users activity status`);
    res.status(200).json({ message: `Updated ${updatedCount} users`, updatedCount });
  } catch (error) {
    console.error('autoMarkInactiveUsers error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('name email phone');
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone },
      { new: true, runValidators: false }
    ).select('name email phone');
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const getPublicAdminContact = async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('name email phone').lean();
    res.json(admin || null);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===== COMMISSION CONTROLLER FUNCTIONS =====
// @desc    Get all commissions (admin view)
const getAllCommissions = async (req, res) => {
  try {
    const commissions = await Commission.find({})
      .populate('vendorId', 'kitchenName ownerId')
      .populate('vendorId.ownerId', 'email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ commissions });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get commission summary statistics
const getCommissionSummary = async (req, res) => {
  try {
    const summary = await Commission.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: null,
          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$count', 0] } },
          pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$totalAmount', 0] } },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$count', 0] } },
          paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$totalAmount', 0] } },
          overdueCount: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$count', 0] } },
          overdueAmount: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$totalAmount', 0] } }
        }
      }
    ]);
    
    const stats = summary[0] || {};
    res.status(200).json({
      pendingAmount: stats.pendingAmount || 0,
      paidAmount: stats.paidAmount || 0,
      overdueAmount: stats.overdueAmount || 0,
      pendingCount: stats.pendingCount || 0,
      paidCount: stats.paidCount || 0,
      overdueCount: stats.overdueCount || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};


// @route   PUT /api/admin/commissions/:id/mark-paid
const markCommissionPaid = async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }
    
    commission.status = 'paid';
    commission.paidAt = new Date();
    await commission.save();
    
    res.status(200).json(commission);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get commission tiers
// @route   GET /api/admin/commission/tiers
const getCommissionTiers = async (req, res) => {
  try {
    const CommissionSetting = require('../models/CommissionSetting');
    const tiers = await CommissionSetting.find({ }).sort({ minEarning: 1 });
    res.status(200).json({ tiers });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update commission tiers (bulk)
// @route   PUT /api/admin/commission/tiers
const updateCommissionTiers = async (req, res) => {
  try {
    const CommissionSetting = require('../models/CommissionSetting');
    const { tiers } = req.body;
    
    if (!Array.isArray(tiers)) {
      return res.status(400).json({ message: 'Tiers must be an array' });
    }
    
    // Upsert all tiers by tierName
    const updatedTiers = [];
    for (const tier of tiers) {
      const result = await CommissionSetting.findOneAndUpdate(
        { tierName: tier.tierName },
        {
          $set: {
            tierName: tier.tierName,
            minEarning: tier.minEarning,
            maxEarning: tier.maxEarning,
            ratePercent: tier.ratePercent,
            isActive: tier.isActive !== false
          }
        },
        { upsert: true, new: true }
      );
      updatedTiers.push(result);
    }
    
    res.status(200).json({ 
      message: 'Commission tiers updated successfully',
      tiers: updatedTiers 
    });
  } catch (error) {
    console.error('Update tiers error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get commission vendors overview
// @route   GET /api/admin/commission/vendors
const getCommissionVendors = async (req, res) => {
  try {
    const CommissionSetting = require('../models/CommissionSetting');

    const { month, status, search } = req.query;
    
    let match = {};
    if (month) match.month = month;
    if (status) match.status = status;
    
    const commissions = await Commission.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor'
        }
      },
      { $unwind: '$vendor' },
      {
        $lookup: {
          from: 'commissionpayments',
          localField: '_id',
          foreignField: 'vendorEarningId',
          as: 'payments'
        }
      },
      {
        $addFields: {
          latestPayment: { $arrayElemAt: ['$payments', -1] }
        }
      },
      {
        $project: {
          vendor_name: '$vendor.kitchenName',
          month: 1,
          total_earning: 1,
          commission_rate: 1,
          commission_amount: 1,
          status: 1,
          amount_paid: { $ifNull: ['$latestPayment.amount_paid', 0] },
          payment_status: '$latestPayment.status',
          proof_url: '$latestPayment.proof_url',
          paid_at: { $ifNull: ['$latestPayment.paid_at', null] }
        }
      },
      { $sort: { month: -1 } }
    ]);
    
    let vendors = commissions;
    if (search) {
      vendors = vendors.filter(v => v.vendorName.toLowerCase().includes(search.toLowerCase()));
    }
    
    res.status(200).json({ vendors });
  } catch (error) {
    console.error('Get commission vendors error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Verify commission payment
// @route   POST /api/admin/commission/verify/:paymentId
const verifyCommissionPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action } = req.body; // 'confirm' or 'reject'
    
    const payment = await CommissionPayment.findById(paymentId).populate('vendorEarningId');
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    if (action === 'confirm') {
      payment.status = 'confirmed';
      payment.verifiedByAdmin = req.user._id;
      payment.verifiedAt = new Date();
      await payment.save();
      
      // Update commission
      payment.vendorEarningId.status = 'paid';
      payment.vendorEarningId.adminVerifiedAt = new Date();
      await payment.vendorEarningId.save();
      
      // Email vendor
      const vendor = await Vendor.findById(payment.vendorId).populate('ownerId');
      if (vendor.ownerId.email) {
        await sendEmail(
          vendor.ownerId.email,
          'Commission Payment Verified',
          `<p>Your payment of ₹${payment.amountPaid} has been verified by admin.</p>`
        );
      }
      
      res.json({ message: 'Payment verified successfully' });
    } else if (action === 'reject') {
      payment.status = 'rejected';
      payment.notes = req.body.notes;
      await payment.save();
      
      res.json({ message: 'Payment rejected' });
    } else {
      res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};



// @desc    Get commission report CSV
// @route   GET /api/admin/commission/report/csv
const getCommissionReportCSV = async (req, res) => {
  try {
    const commissions = await Commission.find({})
      .populate('vendorId', 'kitchenName')
      .lean();
    
    let csv = 'Vendor,Month,Total Orders,Total Earning,Rate,Commission Amount,Status,Due Date\n';
    
    commissions.forEach(c => {
      csv += `"${c.vendorId.kitchenName}","${c.month}",${c.total_orders},"₹${c.total_earning}",${c.commission_rate}%,₹${c.commission_amount},"${c.status}","${c.due_date?.toLocaleDateString() || ''}"\n`;
    });
    
    res.header('Content-Type', 'text/csv');
    res.attachment('mealsetu-commissions.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'CSV generation failed' });
  }
};

// @desc    Seed default commission tiers (runs if empty)
// @route   POST /api/admin/commission/seed-tiers
const seedDefaultTiers = async (req, res) => {
  try {
    const CommissionSetting = require('../models/CommissionSetting');
    const count = await CommissionSetting.countDocuments();
    
    if (count > 0) {
      return res.json({ message: 'Tiers already exist', count });
    }
    
    const defaultTiers = [
      { tierName: 'Starter', minEarning: 0, maxEarning: 10000, ratePercent: 3, isActive: true },
      { tierName: 'Growth', minEarning: 10001, maxEarning: 50000, ratePercent: 5, isActive: true },
      { tierName: 'Pro', minEarning: 50001, maxEarning: 100000, ratePercent: 8, isActive: true },
      { tierName: 'Enterprise', minEarning: 100001, maxEarning: null, ratePercent: 10, isActive: true }
    ];
    
    await CommissionSetting.insertMany(defaultTiers);
    
    res.json({ message: 'Default tiers seeded', tiers: defaultTiers });
  } catch (error) {
    res.status(500).json({ message: 'Seeding failed', error: error.message });
  }
};

// ===== END COMMISSION FUNCTIONS =====

module.exports = { 
  getPlatformSettings, 
  updateCommissionRate, 
  getPendingVendors, 
  getAllUsers, 
  approveVendor, 
  rejectVendor,
  getAllVendorsForAdmin,
  getVendorSubscribers,
  autoMarkInactiveUsers,
  getAdminProfile,
  updateAdminProfile,
  getPublicAdminContact,
  getAllCommissions,
  getCommissionSummary,
  markCommissionPaid,
  getCommissionTiers,
  updateCommissionTiers,
  getCommissionVendors,
  verifyCommissionPayment,
  getCommissionReportCSV,
  seedDefaultTiers
};



