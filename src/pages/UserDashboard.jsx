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

export default function UserDashboard() {
  const navigate = useNavigate();

  // 1. INITIALIZE STATE
  const [user, setUser] = useState({
    name: localStorage.getItem('userName') || "Mosin Ali",
    email: localStorage.getItem('userEmail') || "mosin@example.com",
    phone: localStorage.getItem('userPhone') || "9876543210",
    address:localStorage.getItem('address')|| "Himatnagr , Gujarat",
    pincode:localStorage.getItem('pincode')||"3830010",
    // address: "Himatnagar, Gujarat",
    // pincode: "383001",
    profilePic: localStorage.getItem('userAvatar') || "https://via.placeholder.com/150",
    autoRenew: false,
    expiryDate: localStorage.getItem('expiryDate') || "2026-03-15",
    pausedDays: JSON.parse(localStorage.getItem('pausedDates')) || []
  });

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

  const handleSaveProfile = (profileData) => {
    setUser({ ...user, ...profileData });
    localStorage.setItem('userName', profileData.name);
    localStorage.setItem('userEmail', profileData.email);
    localStorage.setItem('userPhone', profileData.phone);
    localStorage.setItem('userAvatar', user.profilePic);
    setShowProfileModal(false);
    alert("Profile updated successfully!");
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

  const handleLogout = () => navigate('/login');

  const handleAutoLocation = () => {
    setUser({ ...user, address: "Detecting...", pincode: "..." });
    setTimeout(() => {
      setUser({ ...user, address: "Sector 21, Gandhinagar", pincode: "382021" });
    }, 1000);
  };

  const submitReview = (vendor, rating, comment) => {
    alert(`Review for ${vendor.name} submitted!`);
    setShowReviewModal(false);
    setUserComment("");
  };

  const handleExtendSubscription = () => {
    alert("Redirecting to payment gateway...");
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Promo code ${code} copied to clipboard!`);
  };

  // --- DATA ---
  const tiffins = [
    {
      name: "Annapurna Kitchen",
      price: "80",
      rating: "4.8",
      type: "Pure Veg",
      fssai: "20240011002233",
      workingDays: "Mon - Sat",
      timings: "11:00 AM - 10:00 PM",
      reviews: [
        { user: "Rahul", comment: "Excellent home taste!", stars: 5 },
        { user: "Sonal", comment: "Very hygienic and fresh.", stars: 4 },
        { user: "Deepak", comment: "Good portion size.", stars: 5 }
      ]
    },
    {
      name: "Mom's Magic",
      price: "100",
      rating: "4.9",
      type: "Veg/Jain",
      fssai: "20240055006677",
      workingDays: "All Days",
      timings: "09:00 AM - 09:00 PM",
      reviews: [
        { user: "Amit", comment: "The Jain food is amazing.", stars: 5 },
        { user: "Priya", comment: "Tastes just like home.", stars: 5 }
      ]
    }
  ];

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
            onOrder={() => navigate('/order')}
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
            paymentHistory={paymentHistory}
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
