const API_BASE_URL = '/api';

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
};

// ============ AUTH ENDPOINTS ============
export const loginUser = (email, password, role) => {
  return apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
};

export const registerUser = (formData) => {
  return apiCall('/auth/register', {
    method: 'POST',
    body: formData,
  });
};

export const sendOTP = (email) => {
  return apiCall('/auth/forgot-password/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const verifyOTP = (email, otp) => {
  return apiCall('/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
};

export const resetPasswordWithOTP = (email, password) => {
  return apiCall('/auth/forgot-password/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const forgotPassword = (email) => {
  return apiCall('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const resetPassword = (token, password) => {
  return apiCall(`/auth/reset-password/${token}`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
};

export const verifyRegisterOTP = (userId, otp) => {
  return apiCall('/auth/register-verify-otp', {
    method: 'POST',
    body: JSON.stringify({ userId, otp }),
  });
};

export const resendRegisterOTP = (userId) => {
  return apiCall('/auth/register-resend-otp', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// ============ USER ENDPOINTS ============
export const getCurrentUser = () => {
  return apiCall('/users/me', {
    method: 'GET',
  });
};

export const updateUserProfile = (userId, data) => {
  return apiCall(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const updateUserProfilePic = (userId, formData) => {
  return apiCall(`/users/${userId}/profile-pic`, {
    method: 'PUT',
    body: formData,
  });
};

export const changePassword = (userId, currentPassword, newPassword) => {
  return apiCall(`/users/${userId}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

export const getMenus = (date = null) => {
  const timestamp = Date.now();
  const url = date
    ? `/users/menus?date=${date}&_t=${timestamp}`
    : `/users/menus?_t=${timestamp}`;
  return apiCall(url, { method: 'GET' });
};

export const getUserOrders = () => {
  return apiCall('/users/orders', { method: 'GET' });
};

export const placeOrder = (vendorId, items, amount, deliverySlot, mealPreference, options = {}) => {
  return apiCall('/users/order', {
    method: 'POST',
    body: JSON.stringify({
      vendorId,
      items,
      amount,
      deliverySlot,
      mealPreference,
      plan: options.plan || 'ONEDAY',
      startDate: options.startDate || null,
      altMainSubji: options.altMainSubji || '',
      paymentMethod: options.payment || options.paymentMethod || 'Cash'
    }),
  });
};

export const addReview = (vendorId, rating, comment) => {
  return apiCall('/users/review', {
    method: 'POST',
    body: JSON.stringify({ vendorId, rating, comment }),
  });
};

export const applyLeave = (leaveDate, leaveEndDate, mealType) => {
  return apiCall('/users/apply-leave', {
    method: 'POST',
    body: JSON.stringify({ leaveDate, leaveEndDate, mealType }),
  });
};

export const getUserSubscription = () => {
  return apiCall('/users/subscription', { method: 'GET' });
};

export const getActiveSubscriptionStatus = () => {
  return apiCall('/users/subscription-status', { method: 'GET' });
};

export const extendSubscription = (plan, vendorId, paymentMethod = 'Cash') => {
  return apiCall('/users/extend-subscription', {
    method: 'POST',
    body: JSON.stringify({ plan, vendorId, paymentMethod }),
  });
};

export const getApprovedVendors = () => {
  return apiCall('/users/vendors', { method: 'GET' });
};

export const getUserVendorReviews = (vendorId) => {
  return apiCall(`/users/vendor-reviews/${vendorId}`, { method: 'GET' });
};

export const getUserVendorRating = (vendorId) => {
  return apiCall(`/users/vendor-rating/${vendorId}`, { method: 'GET' });
};

export const checkReviewEligibility = (vendorId) => {
  return apiCall(`/users/review-eligibility/${vendorId}`, { method: 'GET' });
};

export const getVendorStatus = (vendorId) => {
  return apiCall(`/users/vendor-status/${vendorId}`, { method: 'GET' });
};

// ============ SUBSCRIPTION ORDER ENDPOINTS ============
export const getMySubscription = () => {
  return apiCall('/users/orders/my-subscription', { method: 'GET' });
};

export const getUpcomingOrders = () => {
  return apiCall('/users/orders/upcoming', { method: 'GET' });
};

export const extendSubscriptionOrder = (plan, vendorId, paymentMethod = 'Cash') => {
  return apiCall('/users/orders/extend', {
    method: 'POST',
    body: JSON.stringify({ plan, vendorId, paymentMethod }),
  });
};

// ============ TRIAL ENDPOINTS ============
export const createTrialOrder = (vendorId, paymentMethod = 'Cash', mealPreference = 'Regular') => {
  return apiCall('/users/trial', {
    method: 'POST',
    body: JSON.stringify({ vendorId, paymentMethod, mealPreference }),
  });
};

export const getTrialEligibility = (vendorId) => {
  return apiCall(`/users/trial-eligibility/${vendorId}`, { method: 'GET' });
};

// ============ VENDOR ENDPOINTS ============
export const getVendorProfile = () => {
  return apiCall('/vendor/me', { method: 'GET' });
};

export const updateVendorProfile = (data) => {
  return apiCall('/vendor/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const updateVendorProfilePic = (formData) => {
  return apiCall('/vendor/me/profile-pic', {
    method: 'PUT',
    body: formData,
  });
};

export const updateKitchenPoster = (formData) => {
  return apiCall('/vendor/me/kitchen-poster', {
    method: 'PUT',
    body: formData,
  });
};

export const submitVendorCompliance = (formData) => {
  return apiCall('/vendor/compliance-submit', {
    method: 'POST',
    body: formData,
  });
};

export const getVendorMenus = () => {
  return apiCall('/vendor/menus', { method: 'GET' });
};

export const addMenu = (menuData) => {
  return apiCall('/vendor/menu', {
    method: 'POST',
    body: JSON.stringify(menuData),
  });
};

export const getVendorOrders = () => {
  return apiCall('/vendor/orders', { method: 'GET' });
};

export const getFilteredOrders = (filter) => {
  return apiCall(`/vendor/orders/filtered?filter=${filter}`, { method: 'GET' });
};

export const updateOrderStatus = (orderId, status) => {
  return apiCall(`/vendor/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

export const getVendorReviews = () => {
  return apiCall('/vendor/reviews', { method: 'GET' });
};

export const getVendorCustomers = () => {
  return apiCall('/vendor/customers', { method: 'GET' });
};

export const getVendorComplaints = () => {
  return apiCall('/vendor/complaints', { method: 'GET' });
};

export const resolveVendorComplaint = (complaintId, status, response) => {
  return apiCall(`/vendor/complaints/${complaintId}`, {
    method: 'PUT',
    body: JSON.stringify({ status, response }),
  });
};

export const getVendorReports = () => {
  return apiCall('/vendor/reports', { method: 'GET' });
};

export const getDashboardStats = () => {
  return apiCall('/vendor/dashboard-stats', { method: 'GET' });
};

export const saveWeeklyPlan = (weeklyPlan) => {
  return apiCall('/vendor/weekly-plan', {
    method: 'PUT',
    body: JSON.stringify({ weeklyPlan }),
  });
};

export const getWeeklyPlan = () => {
  return apiCall('/vendor/weekly-plan', { method: 'GET' });
};

export const getVendorWeeklyPlan = (vendorId) => {
  return apiCall(`/vendor-profile/${vendorId}`, { method: 'GET' });
};

export const toggleShopStatus = (isOpen, closureEndDate = null) => {
  return apiCall('/vendor/shop-status', {
    method: 'PUT',
    body: JSON.stringify({ isOpen, closureEndDate }),
  });
};

export const getVendorShopStatus = () => {
  return apiCall('/vendor/shop-status', { method: 'GET' });
};

export const updateVendorTrialSettings = (trialEnabled, trialFee) => {
  return apiCall('/vendor/trial-settings', {
    method: 'PATCH',
    body: JSON.stringify({ trialEnabled, trialFee }),
  });
};

// ============ OFFER ENDPOINTS ============
export const createOffer = (formData) => {
  return apiCall('/vendor/offers', {
    method: 'POST',
    body: formData,
  });
};

export const getVendorOffers = () => {
  return apiCall('/vendor/offers', { method: 'GET' });
};

export const deleteOffer = (offerId) => {
  return apiCall(`/vendor/offers/${offerId}`, { method: 'DELETE' });
};

export const getActiveOffers = () => {
  return apiCall('/users/active-offers', { method: 'GET' });
};

export const getClaimedOffers = () => {
  return apiCall('/users/claimed-offers', { method: 'GET' });
};

export const redeemOffer = (offerId, planType) => {
  return apiCall('/users/redeem-offer', {
    method: 'POST',
    body: JSON.stringify({ offerId, planType }),
  });
};

// ============ ADMIN ENDPOINTS ============
export const getPlatformSettings = () => {
  return apiCall('/admin/settings', { method: 'GET' });
};

export const updateCommissionRate = (commissionRate) => {
  return apiCall('/admin/settings/commission', {
    method: 'PUT',
    body: JSON.stringify({ commissionRate }),
  });
};

export const getPendingVendors = () => {
  return apiCall('/admin/vendors/pending', { method: 'GET' });
};

export const updateVendorStatus = (vendorId, status, rejectionReason = '') => {
  return apiCall(`/admin/vendors/${vendorId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, rejectionReason }),
  });
};

export const getAllUsers = () => {
  return apiCall('/admin/users', { method: 'GET' });
};

// ============ ADMIN COMMISSION ENDPOINTS ============
export const getAdminCommissionTiers = () => {
  return apiCall('/admin/commission/tiers');
};

export const updateAdminCommissionTiers = (tiers) => {
  return apiCall('/admin/commission/tiers', {
    method: 'PUT',
    body: JSON.stringify({ tiers }),
  });
};

export const getAdminCommissionVendors = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiCall(`/admin/commission/vendors?${query}`);
};

export const adminVerifyCommission = (paymentId, actionData) => {
  return apiCall(`/admin/commission/verify/${paymentId}`, {
    method: 'POST',
    body: JSON.stringify(actionData),
  });
};

export const downloadCommissionCSV = (month = '') => {
  window.open(`/api/admin/commission/report/csv?month=${month}`, '_blank');
};

export const seedDefaultTiers = () => {
  return apiCall('/admin/commission/seed-tiers', { method: 'POST' });
};

// ============ VENDOR COMMISSION ENDPOINTS ============
export const getVendorCommissionSummary = () => {
  return apiCall('/vendor/commission/summary');
};

export const getVendorCommissionHistory = () => {
  return apiCall('/vendor/commission/history');
};

export const vendorPayCommission = (formData) => {
  return apiCall('/vendor/commission/pay', {
    method: 'POST',
    body: formData,
  });
};

// ============ LEGACY COMPATIBILITY ============
export const getVendorPendingPayout = () => {
  return getDashboardStats().then(data => ({
    pendingAmount: data.pendingPayout || 0,
  }));
};