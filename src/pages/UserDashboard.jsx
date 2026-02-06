import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/dashboard/shared/Sidebar';
import WelcomeCard from '../components/dashboard/user/WelcomeCard';
import OrderMeals from '../components/dashboard/user/OrderMeals';
import Subscription from '../components/dashboard/user/Subscription';
import History from '../components/dashboard/user/History';
import Offers from '../components/dashboard/user/Offers';
import Safety from '../components/dashboard/user/Safety';
import ProfileModal from '../components/dashboard/user/ProfileModal';
import ReviewModal from '../components/dashboard/user/ReviewModal';
import AllReviewsModal from '../components/dashboard/user/AllReviewsModal';
import PasswordModal from '../components/dashboard/user/PasswordModal';
import { getCurrentUser, updateUserProfile, changePassword, getUserOrders, getMenus, placeOrder, addReview } from '../utils/api';

export default function UserDashboard() {
  const navigate = useNavigate();

  // 1. INITIALIZE STATE
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    pincode: "",
    profilePic: "https://via.placeholder.com/150",
    autoRenew: false,
    expiryDate: "2026-03-15",
    pausedDays: []
  });

  const [orders, setOrders] = useState([]);
  const [tiffins, setTiffins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // LEAVE FORM STATE
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [mealType, setMealType] = useState('both');

  // MODAL & OTP STATES
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAllReviewsModal, setShowAllReviewsModal] = useState(false);

  // FEATURE STATE: ACTIVE TAB
  const [activeTab, setActiveTab] = useState('services');

  // REVIEW FORM STATE
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState("");

  // Load user data on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'user') {
      navigate('/');
      return;
    }

    fetchUserData();
  }, [navigate]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const userData = await getCurrentUser();
      setUser({
        ...user,
        ...userData,
        pausedDays: user.pausedDays
      });
      
      const userOrders = await getUserOrders();
      setOrders(userOrders || []);
      try {
        const menus = await getMenus();
        // Map menus to tiffins UI shape
        const mapped = (menus || []).map(m => {
          // Backend returns vendor-enriched fields already (vendorId may be an id string)
          return {
            vendorId: m.vendorId || null,
            name: m.kitchenName || (m.vendorId && m.vendorId.kitchenName) || 'Partner Kitchen',
            price: m.menuPrice || m.price || 80,
            rating: m.rating || 4.5,
            type: m.dietaryCategory || 'Regular',
            fssai: m.fssaiNumber || '',
            workingDays: m.workingDays || 'Mon - Sat',
            timings: m.timings || '11:00 AM - 9:00 PM',
            reviews: []
          };
        });
        if (mapped.length > 0) setTiffins(mapped);
      } catch (e) {
        console.warn('Failed to load menus', e);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCTIONS ---

  // Handle Photo Change
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUser({ ...user, profilePic: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (profileData) => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      const updated = await updateUserProfile(userData._id, profileData);
      setUser({ ...user, ...updated });
      localStorage.setItem('user', JSON.stringify(updated));
      setShowProfileModal(false);
      alert("Profile updated successfully!");
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile: ' + err.message);
    }
  };

  const handleDownloadInvoice = (historyItem) => {
    const invoiceContent = `
      INVOICE - MealSetu
      -------------------------
      Order ID: ${historyItem.id}
      Date: ${historyItem.date}
      Plan: ${historyItem.plan}
      Customer: ${user.name}
      Amount: ₹${historyItem.amount}
      Status: ${historyItem.status}
      -------------------------
      Thank you for choosing MealSetu!
    `;

    const element = document.createElement("a");
    const file = new Blob([invoiceContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Invoice_${historyItem.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleApplyLeave = () => {
    if (!leaveStart || !leaveEnd) {
      alert("Please select both Start and End dates.");
      return;
    }

    const start = new Date(leaveStart);
    const end = new Date(leaveEnd);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (start < today) {
      alert("Leave cannot start in the past.");
      return;
    }
    if (end < start) {
      alert("End date cannot be before Start date.");
      return;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const confirmLeave = window.confirm(
      `Confirm Leave: ${leaveStart} to ${leaveEnd} (${diffDays} days).\nYour subscription will extend by ${diffDays} day(s).`
    );

    if (confirmLeave) {
      const currentExpiry = new Date(user.expiryDate);
      currentExpiry.setDate(currentExpiry.getDate() + diffDays);
      const newExpiryStr = currentExpiry.toISOString().split('T')[0];

      const newLeaveRecord = { from: leaveStart, to: leaveEnd, type: mealType, days: diffDays };
      const updatedPausedDays = [...user.pausedDays, newLeaveRecord];

      setUser({ ...user, expiryDate: newExpiryStr, pausedDays: updatedPausedDays });

      localStorage.setItem('expiryDate', newExpiryStr);
      localStorage.setItem('pausedDates', JSON.stringify(updatedPausedDays));

      alert(`Leave applied successfully! New Expiry Date: ${newExpiryStr}`);
      setLeaveStart('');
      setLeaveEnd('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleAutoLocation = () => {
    setUser({ ...user, address: "Detecting...", pincode: "..." });
    setTimeout(() => {
      setUser({ ...user, address: "Sector 21, Gandhinagar", pincode: "382021" });
    }, 1000);
  };

  const submitReview = (vendor, rating, comment) => {
    (async () => {
      try {
        await addReview(vendor.vendorId || vendor.vendorId || vendor._id || vendor.id, rating, comment);
        alert('Review submitted');
        setShowReviewModal(false);
        setUserComment('');
      } catch (e) {
        alert('Failed to submit review: ' + e.message);
      }
    })();
  };

  const handleOrder = async (vendor) => {
    try {
      const vendorId = vendor.vendorId || vendor._id || vendor.id;
      if (!vendorId) return alert('Unable to place order: missing vendor id');

      const amount = parseInt(vendor.price || vendor.menuPrice || 80, 10);
      if (!amount || amount <= 0) return alert('Unable to place order: invalid amount');

      // Ensure mealPreference matches backend enum: 'Regular' or 'Jain'
      const mealPrefRaw = (vendor.type || '').toString();
      const mealPreference = /jain/i.test(mealPrefRaw) ? 'Jain' : 'Regular';
      await placeOrder(vendorId, [], amount, 'Lunch', mealPreference);
      alert('Order placed successfully');
      const userOrders = await getUserOrders();
      setOrders(userOrders || []);
    } catch (e) {
      // If backend returned structured error, show it
      alert('Failed to place order: ' + (e.message || JSON.stringify(e)));
    }
  };

  const handleExtendSubscription = () => {
    alert("Redirecting to payment gateway...");
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Promo code ${code} copied to clipboard!`);
  };

  // --- DATA ---
  // All tiffin/menu data now comes from backend via `tiffins` state

  const paymentHistory = [
    { id: 'MS-9921', date: '2026-01-20', plan: 'Monthly', amount: 2000, status: 'Paid' },
  ];

  const offersList = [
    { code: 'MEALSETU20', desc: 'Get 20% OFF on your first Monthly Plan subscription.', color: '#f26522', tag: 'Limited Time' },
    { code: 'WELCOMESETU', desc: 'Flat ₹100 discount on your very first order over ₹500.', color: '#16a34a', tag: 'New User' },
    { code: 'WEEKEND50', desc: 'Enjoy 50% discount on every Sunday dinner tiffin.', color: '#334155', tag: 'Special' },
  ];

  const menuItems = [
    { key: 'services', label: 'Order Meals' },
    { key: 'subscription', label: 'Subscription' },
    { key: 'history', label: 'History' },
    { key: 'offers', label: 'Offers' },
    { key: 'safety', label: 'Safety' }
  ];

  const userInfo = {
    profilePic: user.profilePic,
    name: user.name,
    onEditProfile: () => setShowProfileModal(true)
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      <Sidebar
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        userInfo={userInfo}
      />

      {/* --- MAIN CONTENT --- */}
      <main style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>

        <WelcomeCard
          user={user}
          onDetectLocation={handleAutoLocation}
          onSecuritySettings={() => setShowPasswordModal(true)}
        />

        {activeTab === 'services' && (
          <OrderMeals
            tiffins={tiffins}
            onOrder={(vendor) => handleOrder(vendor)}
            onViewReviews={(vendor) => { setSelectedVendor(vendor); setShowAllReviewsModal(true); }}
            onWriteReview={(vendor) => { setSelectedVendor(vendor); setShowReviewModal(true); }}
          />
        )}

        {activeTab === 'subscription' && (
          <Subscription
            user={user}
            leaveStart={leaveStart}
            leaveEnd={leaveEnd}
            mealType={mealType}
            onLeaveStartChange={setLeaveStart}
            onLeaveEndChange={setLeaveEnd}
            onMealTypeChange={setMealType}
            onApplyLeave={handleApplyLeave}
            onExtendSubscription={handleExtendSubscription}
          />
        )}

        {activeTab === 'history' && (
          <History
            paymentHistory={(orders || []).map(o => ({ id: o._id, date: new Date(o.orderDate).toLocaleDateString('en-IN'), plan: 'Tiffin', amount: o.amount || 0, status: o.paymentStatus || 'Paid' }))}
            onDownloadInvoice={handleDownloadInvoice}
          />
        )}

        {activeTab === 'offers' && (
          <Offers
            offersList={offersList}
            onCopyCode={handleCopyCode}
          />
        )}

        {activeTab === 'safety' && (
          <Safety />
        )}

      </main>

      {/* --- MODALS --- */}
      {showProfileModal && (
        <ProfileModal
          user={user}
          onSave={handleSaveProfile}
          onClose={() => setShowProfileModal(false)}
          onPhotoChange={handlePhotoChange}
        />
      )}

      {showAllReviewsModal && (
        <AllReviewsModal
          vendor={selectedVendor}
          onClose={() => setShowAllReviewsModal(false)}
        />
      )}

      {showReviewModal && (
        <ReviewModal
          vendor={selectedVendor}
          onSubmit={submitReview}
          onClose={() => setShowReviewModal(false)}
        />
      )}

      {showPasswordModal && (
        <PasswordModal
          user={user}
          onClose={() => setShowPasswordModal(false)}
          onForgotPassword={() => {}}
        />
      )}

    </div>
  );
}
