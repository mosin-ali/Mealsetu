'use strict';

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ─── Credential Resolution ────────────────────────────────────────────────────
// Strategy 1: Build credential object from individual environment variables.
// Strategy 2: Fall back to firebase-service-account.json file on disk.
// Strategy 3: If neither is available, run in DISABLED mode (no crash).

let firebaseApp   = null;
let fcmDisabled   = false;

function resolveCredential() {
  // Strategy 1 — environment variables
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    return {
      type:                        'service_account',
      project_id:                  process.env.FIREBASE_PROJECT_ID,
      private_key_id:              process.env.FIREBASE_PRIVATE_KEY_ID   || '',
      private_key:                 process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email:                process.env.FIREBASE_CLIENT_EMAIL,
      client_id:                   process.env.FIREBASE_CLIENT_ID        || '',
      auth_uri:                    'https://accounts.google.com/o/oauth2/auth',
      token_uri:                   'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url:        process.env.FIREBASE_CLIENT_CERT_URL  || '',
    };
  }

  // Strategy 2 — JSON file on disk
  const jsonPath = path.resolve(__dirname, '..', 'firebase-service-account.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      // Reject placeholder template — check for real project_id
      if (
        raw.project_id &&
        raw.project_id !== 'YOUR_FIREBASE_PROJECT_ID' &&
        raw.private_key &&
        raw.private_key !== '-----BEGIN RSA PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END RSA PRIVATE KEY-----\n'
      ) {
        return raw;
      }
    } catch (e) {
      console.warn('[FCM] firebase-service-account.json is malformed:', e.message);
    }
  }

  // Strategy 3 — disabled mode
  return null;
}

// ─── Initialise Firebase Admin SDK ───────────────────────────────────────────
(function initFirebase() {
  // Prevent re-initialisation if already done (e.g. hot-reload)
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0];
    return;
  }

  const credential = resolveCredential();

  if (!credential) {
    fcmDisabled = true;
    console.warn(
      '[FCM] ⚠️  Firebase credentials not found.\n' +
      '         Push notifications are DISABLED.\n' +
      '         To enable: add real values to backend/.env (FIREBASE_*)\n' +
      '         or place a valid firebase-service-account.json in /backend'
    );
    return;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(credential),
    });
    console.log('[FCM] ✅ Firebase Admin SDK initialised successfully.');
  } catch (err) {
    fcmDisabled = true;
    console.error('[FCM] ❌ Firebase init failed:', err.message);
    console.warn('[FCM] Push notifications are DISABLED due to init error.');
  }
})();

// ─── Public API ───────────────────────────────────────────────────────────────
// These function signatures are identical to the original so that
// offerController.js requires zero changes.

/**
 * Send a push notification to a single device token.
 * @param {string} token     - FCM device registration token
 * @param {string} title     - Notification title
 * @param {string} body      - Notification body
 * @param {object} [data={}] - Optional key-value data payload
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendNotification(token, title, body, data = {}) {
  if (fcmDisabled) {
    console.warn('[FCM] sendNotification skipped — FCM is disabled.');
    return { success: false, error: 'FCM_DISABLED' };
  }

  if (!token) {
    return { success: false, error: 'NO_DEVICE_TOKEN' };
  }

  const message = {
    token,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
    },
  };

  try {
    const messageId = await admin.messaging().send(message);
    return { success: true, messageId };
  } catch (err) {
    console.error('[FCM] sendNotification error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a push notification to multiple device tokens (multicast).
 * @param {string[]} tokens  - Array of FCM device registration tokens
 * @param {string}   title   - Notification title
 * @param {string}   body    - Notification body
 * @param {object}  [data={}]- Optional key-value data payload
 * @returns {Promise<{success: boolean, successCount?: number, failureCount?: number, error?: string}>}
 */
async function sendMulticastNotification(tokens, title, body, data = {}) {
  if (fcmDisabled) {
    console.warn('[FCM] sendMulticastNotification skipped — FCM is disabled.');
    return { success: false, error: 'FCM_DISABLED' };
  }

  if (!tokens || tokens.length === 0) {
    return { success: false, error: 'NO_DEVICE_TOKENS' };
  }

  const message = {
    tokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      success:      true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err) {
    console.error('[FCM] sendMulticastNotification error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a notification to a Firebase topic.
 * @param {string} topic     - FCM topic name (without /topics/ prefix)
 * @param {string} title     - Notification title
 * @param {string} body      - Notification body
 * @param {object} [data={}] - Optional key-value data payload
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendTopicNotification(topic, title, body, data = {}) {
  if (fcmDisabled) {
    console.warn('[FCM] sendTopicNotification skipped — FCM is disabled.');
    return { success: false, error: 'FCM_DISABLED' };
  }

  const message = {
    topic,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
  };

  try {
    const messageId = await admin.messaging().send(message);
    return { success: true, messageId };
  } catch (err) {
    console.error('[FCM] sendTopicNotification error:', err.message);
    return { success: false, error: err.message };
  }
}

async function notifyUser(userId, title, body, data = {}) {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId).select('fcmToken').lean();
    if (!user?.fcmToken) return { success: false, error: 'NO_DEVICE_TOKEN' };
    return sendNotification(user.fcmToken, title, body, data);
  } catch (err) {
    console.error('[FCM] notifyUser error:', err.message);
    return { success: false, error: err.message };
  }
}

const notifyRiderNewBatch = (userId, area, orderCount, pickupTime, mealSlot) =>
  notifyUser(
    userId,
    'New delivery batch assigned',
    `${orderCount} order(s)${area ? ` in ${area}` : ''} for ${mealSlot || 'your'} delivery${pickupTime ? ` at ${pickupTime}` : ''}.`,
    { type: 'new_batch_assigned', mealSlot: mealSlot || '' }
  );

const notifyDeliveryAssigned = (userId, riderName, orderId) =>
  notifyUser(
    userId,
    'Delivery partner assigned',
    `${riderName || 'A rider'} has been assigned to your order.`,
    { type: 'delivery_assigned', orderId: orderId || '' }
  );

const notifyOrderConfirmed = (userId, { planType, vendorName, startDate, orderId } = {}) =>
  notifyUser(
    userId,
    'Order confirmed',
    `${planType || 'Meal'} plan from ${vendorName || 'your kitchen'} is confirmed.`,
    { type: 'order_confirmed', orderId: orderId || '', startDate: startDate || '' }
  );

const notifyVendorNewOrder = (userId, customerName, planType, amount) =>
  notifyUser(
    userId,
    'New order received',
    `${customerName || 'A customer'} placed a ${planType || 'meal'} order for ₹${amount || 0}.`,
    { type: 'new_order' }
  );

const notifyVendorPayment = (userId, customerName, amount) =>
  notifyUser(
    userId,
    'Payment received',
    `${customerName || 'A customer'} completed a payment of ₹${amount || 0}.`,
    { type: 'payment_received' }
  );

const notifyCashPaymentConfirmed = (userId, vendorName, planType) =>
  notifyUser(
    userId,
    'Cash payment confirmed',
    `${vendorName || 'Your kitchen'} confirmed your ${planType || 'meal'} payment.`,
    { type: 'cash_payment_confirmed' }
  );

const notifyMealPickedUp = (userId, riderName) =>
  notifyUser(userId, 'Meal picked up', `${riderName || 'Your rider'} picked up your meal.`, { type: 'picked_up' });

const notifyOutForDelivery = (userId, eta) =>
  notifyUser(userId, 'Meal out for delivery', eta ? `Your meal is on the way. ETA ${eta}.` : 'Your meal is on the way.', { type: 'on_the_way' });

const notifyDelivered = (userId, vendorName) =>
  notifyUser(userId, 'Meal delivered', `Your meal from ${vendorName || 'MealSetu'} has been delivered.`, { type: 'delivered' });

const notifyDeliveryFailed = (userId, reason) =>
  notifyUser(userId, 'Delivery could not be completed', reason || 'Please contact the kitchen to arrange another delivery.', { type: 'delivery_failed' });

const notifyAllUsers = async (userIds, title, body, data = {}) => {
  try {
    const User = require('../models/User');
    const users = await User.find({ _id: { $in: userIds }, fcmToken: { $exists: true, $ne: null } })
      .select('fcmToken')
      .lean();
    const tokens = users.map((user) => user.fcmToken).filter(Boolean);
    return sendMulticastNotification(tokens, title, body, data);
  } catch (err) {
    console.error('[FCM] notifyAllUsers error:', err.message);
    return { success: false, error: err.message };
  }
};

const notifyCommissionPaid = (userId, weekLabel, amount) =>
  notifyUser(userId, 'Commission paid', `${weekLabel || 'Your commission'} payment of ₹${amount || 0} has been sent.`, { type: 'commission_paid' });

const notifyFreeMealAdded = (userId, vendorName) =>
  notifyUser(userId, 'Free meal added', `${vendorName || 'Your kitchen'} added a complimentary meal to your plan.`, { type: 'free_meal_added' });

const notifyLeaveApplied = (userId, leaveDays, newExpiry) =>
  notifyUser(userId, 'Leave request processed', `${leaveDays || 0} leave day(s) have been applied. Your plan now expires ${newExpiry ? new Date(newExpiry).toLocaleDateString('en-IN') : 'later'}.`, { type: 'leave_applied' });

const notifyOfferRedeemed = (userId, vendorName, planType, amount) =>
  notifyUser(userId, 'Offer redeemed', `Your ${planType || 'meal'} offer from ${vendorName || 'the kitchen'} was redeemed for ₹${amount || 0}.`, { type: 'offer_redeemed' });

const notifyOrderFlagged = (userId, customerName, orderId) =>
  notifyUser(userId, 'Delivery issue reported', `${customerName || 'A customer'} reported an issue with order ${orderId || ''}.`, { type: 'order_flagged', orderId: orderId || '' });

const notifyPlanExpiring = (userId, vendorName, daysLeft) =>
  notifyUser(userId, 'Subscription expiring soon', `Your plan from ${vendorName || 'your kitchen'} expires in ${daysLeft} day(s).`, { type: 'plan_expiring', daysLeft: daysLeft || 0 });

const notifyPointsEarned = (userId, points, totalPoints) =>
  notifyUser(userId, 'Loyalty points earned', `You earned ${points || 0} points. Your balance is ${totalPoints || 0} points.`, { type: 'points_earned', points: points || 0, totalPoints: totalPoints || 0 });

const notifyRiderSalaryPaid = (userId, amount, month, paymentMethod) =>
  notifyUser(userId, 'Salary payment recorded', `Your ${month || ''} salary payment of ₹${amount || 0} was recorded via ${paymentMethod || 'payment'}.`, { type: 'rider_salary_paid', month: month || '' });

const notifySubscriptionExtended = (userId, vendorName, planType, expiryDate) =>
  notifyUser(userId, 'Subscription extended', `Your ${planType || 'meal'} plan from ${vendorName || 'your kitchen'} is extended${expiryDate ? ` until ${new Date(expiryDate).toLocaleDateString('en-IN')}` : ''}.`, { type: 'subscription_extended' });

const notifyTrialConfirmed = (userId, vendorName, orderId) =>
  notifyUser(userId, 'Trial confirmed', `Your trial from ${vendorName || 'the kitchen'} is confirmed.`, { type: 'trial_confirmed', orderId: orderId || '' });

const notifyVendorNewReview = (userId, customerName, rating) =>
  notifyUser(userId, 'New customer review', `${customerName || 'A customer'} left a ${rating || ''}-star review.`, { type: 'new_review', rating: rating || 0 });

const notifyVendorRejected = (userId, vendorName, reason) =>
  notifyUser(userId, 'Vendor application update', `${vendorName || 'Your kitchen'} was not approved${reason ? `: ${reason}` : '.'}`, { type: 'vendor_rejected' });

module.exports = {
  sendNotification,
  sendMulticastNotification,
  sendTopicNotification,
  notifyRiderNewBatch,
  notifyDeliveryAssigned,
  notifyOrderConfirmed,
  notifyVendorNewOrder,
  notifyVendorPayment,
  notifyCashPaymentConfirmed,
  notifyMealPickedUp,
  notifyOutForDelivery,
  notifyDelivered,
  notifyDeliveryFailed,
  notifyAllUsers,
  notifyCommissionPaid,
  notifyFreeMealAdded,
  notifyLeaveApplied,
  notifyOfferRedeemed,
  notifyOrderFlagged,
  notifyPlanExpiring,
  notifyPointsEarned,
  notifyRiderSalaryPaid,
  notifySubscriptionExtended,
  notifyTrialConfirmed,
  notifyVendorNewReview,
  notifyVendorRejected,
};
