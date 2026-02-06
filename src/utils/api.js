const API_BASE_URL = '/api';

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
  };

  // Only set Content-Type if not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Add token if it exists
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

export const changePassword = (userId, currentPassword, newPassword) => {
  return apiCall(`/users/${userId}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

export const getMenus = (date = null) => {
  const url = date ? `/users/menus?date=${date}` : '/users/menus';
  return apiCall(url, {
    method: 'GET',
  });
};

export const getUserOrders = () => {
  return apiCall('/users/orders', {
    method: 'GET',
  });
};

export const placeOrder = (vendorId, items, amount, deliverySlot, mealPreference) => {
  return apiCall('/users/order', {
    method: 'POST',
    body: JSON.stringify({ vendorId, items, amount, deliverySlot, mealPreference }),
  });
};

export const addReview = (vendorId, rating, comment) => {
  return apiCall('/users/review', {
    method: 'POST',
    body: JSON.stringify({ vendorId, rating, comment }),
  });
};

// ============ VENDOR ENDPOINTS ============
export const getVendorProfile = () => {
  return apiCall('/vendor/me', {
    method: 'GET',
  });
};

export const updateVendorProfile = (data) => {
  return apiCall('/vendor/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const getVendorMenus = () => {
  return apiCall('/vendor/menus', {
    method: 'GET',
  });
};

export const addMenu = (menuData) => {
  return apiCall('/vendor/menu', {
    method: 'POST',
    body: JSON.stringify(menuData),
  });
};

export const getVendorOrders = () => {
  return apiCall('/vendor/orders', {
    method: 'GET',
  });
};

export const updateOrderStatus = (orderId, status) => {
  return apiCall(`/vendor/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

export const getVendorReviews = () => {
  return apiCall('/vendor/reviews', {
    method: 'GET',
  });
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
    body: JSON.stringify({ status, response })
  });
};

export const getVendorReports = () => {
  return apiCall('/vendor/reports', { method: 'GET' });
};

// ============ ADMIN ENDPOINTS ============
export const getPlatformSettings = () => {
  return apiCall('/admin/settings', {
    method: 'GET',
  });
};

export const updateCommissionRate = (commissionRate) => {
  return apiCall('/admin/settings/commission', {
    method: 'PUT',
    body: JSON.stringify({ commissionRate }),
  });
};

export const getPendingVendors = () => {
  return apiCall('/admin/vendors/pending', {
    method: 'GET',
  });
};

export const updateVendorStatus = (vendorId, status, rejectionReason = '') => {
  return apiCall(`/admin/vendors/${vendorId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, rejectionReason }),
  });
};

export const getAllUsers = () => {
  return apiCall('/admin/users', {
    method: 'GET',
  });
};