const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const { LUNCH_CUTOFF_UTC_HOURS } = require('../utils/mealTimingUtils');

const getPreparationList = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ ownerId: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrowMidnight = new Date(today);
    tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);

    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

    const orders = await Order.find({
      vendorId: vendor._id,
      status: { $in: ['active', 'trial'] },
      startDate: { $lt: tomorrowMidnight },
      $or: [
        { endDate: { $gte: today } },
        {
          endDate: { $in: [null, undefined] },
          startDate: { $gte: thirtyDaysAgo }
        }
      ]
    });

    const todayMidnightMs = today.getTime();

    const countGroup = (group) => {
      const jain = group.filter(o => o.mealPreference === 'Jain').length;
      return { total: group.length, regular: group.length - jain, jain };
    };

    // Exclude from lunch any order whose startDate is today AND was
    // placed after the lunch cutoff (10 AM IST / 04:30 UTC).
    // These customers only receive dinner today; their endDate was already
    // extended by +1 day in computeSubscriptionDates to compensate.
    const lunchEligible = orders.filter(order => {
      const orderCreation = order.orderDate ? new Date(order.orderDate) : null;
      if (!orderCreation) return true;

      const startNormalized = new Date(order.startDate);
      startNormalized.setUTCHours(0, 0, 0, 0);
      const startIsToday = startNormalized.getTime() === todayMidnightMs;
      if (!startIsToday) return true;

      const creationUTCHour =
        orderCreation.getUTCHours() + orderCreation.getUTCMinutes() / 60;
      return creationUTCHour < LUNCH_CUTOFF_UTC_HOURS;
    });

    // All orders in the result set are dinner-eligible:
    // orders starting tomorrow (after-dinner-cutoff purchases) were
    // already excluded by startDate: { $lte: today } in the query.
    const lunch  = countGroup(lunchEligible);
    const dinner = countGroup(orders);

    return res.json({
      lunch,
      dinner,
      total: orders.length,
      regular: lunch.regular + dinner.regular,
      jain: lunch.jain + dinner.jain,
      date: today.toISOString().slice(0, 10)
    });
  } catch (error) {
    console.error('Preparation list error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getPreparationList };
