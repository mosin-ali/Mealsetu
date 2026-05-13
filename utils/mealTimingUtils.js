// Smart subscription start date logic based on purchase time.
// All dates stored as UTC midnight to be consistent with all query comparisons.

const LUNCH_CUTOFF_UTC_HOURS  = 4.5;   // 04:30 UTC = 10:00 AM IST
const DINNER_CUTOFF_UTC_HOURS = 11.5;  // 11:30 UTC = 05:00 PM IST

/**
 * Returns { startDate, endDate, mealSlotToday }
 *
 * mealSlotToday values:
 *   'both'   — purchased before lunch cutoff; both meals active today
 *   'dinner' — purchased between cutoffs; only dinner active today;
 *              endDate extended by 1 day to compensate missed lunch
 *   'none'   — purchased after dinner cutoff; starts tomorrow
 *
 * @param {number} planDurationDays  1=Trial, 7=Weekly, 30=Monthly
 * @param {Date}   purchaseTime      defaults to new Date()
 */
const computeSubscriptionDates = (planDurationDays, purchaseTime = new Date()) => {
  const utcHour = purchaseTime.getUTCHours() + purchaseTime.getUTCMinutes() / 60;

  const todayMidnight = new Date(purchaseTime);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const tomorrowMidnight = new Date(todayMidnight);
  tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);

  let startDate;
  let extraDays = 0;
  let mealSlotToday;

  if (utcHour < LUNCH_CUTOFF_UTC_HOURS) {
    startDate     = todayMidnight;
    mealSlotToday = 'both';
  } else if (utcHour < DINNER_CUTOFF_UTC_HOURS) {
    startDate     = todayMidnight;
    extraDays     = 1;
    mealSlotToday = 'dinner';
  } else {
    startDate     = tomorrowMidnight;
    mealSlotToday = 'none';
  }

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + planDurationDays + extraDays);

  return { startDate, endDate, mealSlotToday };
};

/**
 * Returns plan duration in days. Accepts both 'Weekly' and 'weekly'.
 * Trial = 2 days (48-hour window).
 */
const getPlanDurationDays = (planType) => {
  const map = {
    trial: 2, Trial: 2,
    weekly: 7, Weekly: 7,
    monthly: 30, Monthly: 30,
    tiffin: 1, Tiffin: 1
  };
  return map[planType] || 7;
};

module.exports = {
  computeSubscriptionDates,
  getPlanDurationDays,
  LUNCH_CUTOFF_UTC_HOURS,
  DINNER_CUTOFF_UTC_HOURS
};
