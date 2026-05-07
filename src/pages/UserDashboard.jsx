import React, { useState, useEffect } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import jsPDF from 'jspdf';

import autoTable from 'jspdf-autotable';

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

import { getCurrentUser, updateUserProfile, updateUserProfilePic, changePassword, getUserOrders, getMenus, placeOrder, addReview, applyLeave, getUserSubscription, getActiveSubscriptionStatus, extendSubscription, getVendorWeeklyPlan, checkReviewEligibility, getApprovedVendors, getActiveOffers, redeemOffer, getMySubscription, getUpcomingOrders, extendSubscriptionOrder, getClaimedOffers } from '../utils/api';
import { OrderProvider } from '../context/OrderContext';

import './UserDashbord.css';

export default function UserDashboard() {
  const navigate = useNavigate();

  // Sidebar state for mobile drawer
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 1. INITIALIZE STATE
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    pincode: "",
    profilePic: "",
    autoRenew: false,
    expiryDate: "2026-03-15",
    pausedDays: []
  });



  // Subscription state

  const [subscription, setSubscription] = useState(null);

  // State for tracking if user has active plan (to hide trial button)
  const [hasActivePlan, setHasActivePlan] = useState(false);



  // State for storing selected photo file

  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);



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

  // REVIEW ELIGIBILITY STATE
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [showReviewEligibilityPopup, setShowReviewEligibilityPopup] = useState(false);

  // Selected vendor for reviews
  const [selectedVendor, setSelectedVendor] = useState(null);

  // ACTIVE OFFERS STATE
  const [activeOffers, setActiveOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState(null);
  
  // CLAIMED OFFERS STATE - array of offer IDs that the current user has redeemed
  const [claimedOfferIds, setClaimedOfferIds] = useState([]);
  
  // Selected offer for redemption - when user clicks redeem, we navigate to order flow
  const [selectedOfferVendor, setSelectedOfferVendor] = useState(null);
  const [selectedOfferPlan, setSelectedOfferPlan] = useState(null);
const handleViewReviews = (vendor) => {
  setSelectedVendor(vendor);
  setShowAllReviewsModal(true);
};

  // Check if user can review a vendor
  const handleWriteReview = async (vendor) => {
    try {
      const vendorId = vendor.vendorId || vendor._id || vendor.id;
      const eligibility = await checkReviewEligibility(vendorId);
      setReviewEligibility(eligibility);
      
      if (eligibility.canReview) {
        // User can review - open the review modal
        setSelectedVendor(vendor);
        setShowReviewModal(true);
      } else {
        // User cannot review - show popup with message
        setSelectedVendor(vendor);
        setShowReviewEligibilityPopup(true);
      }
    } catch (error) {
      console.error('Error checking review eligibility:', error);
      // On error, allow trying to submit review anyway (fallback behavior)
      setSelectedVendor(vendor);
      setShowReviewModal(true);
    }
  };



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

    // Initialize user state with profilePic from localStorage if available
    if (parsedUser.profilePic) {
      setUser(prev => ({
        ...prev,
        ...parsedUser,
        profilePic: parsedUser.profilePic || prev.profilePic
      }));
    }

    fetchUserData();
  }, [navigate]);

  // Handle trial intent from login/register redirect
  useEffect(() => {
    // First check React Router state (from Login/Register navigation)
    const locationState = window.history.state;
    if (locationState && locationState.state && locationState.state.activeTab === 'subscription') {
      setActiveTab('subscription');
    }
    
    // Also check localStorage for trial intent (set by LandingPage)
    const trialIntent = localStorage.getItem('trialIntent');
    if (trialIntent === 'true') {
      // Clear the intent
      localStorage.removeItem('trialIntent');
      // Navigate to subscription tab
      setActiveTab('subscription');
    }
  }, []);

  // Polling to refresh menu data every 30 seconds for real-time updates
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const menus = await getMenus();
        // Map menus to tiffins UI shape - include kitchenPoster for vendor images
        const mapped = (menus || []).map(m => ({
          vendorId: m.vendorId || null,
          name: m.kitchenName || (m.vendorId && m.vendorId.kitchenName) || 'Partner Kitchen',
          price: m.menuPrice || m.price || 80,
          rating: m.rating || 4.5,
          type: m.dietaryCategory || 'Regular',
          fssai: m.fssaiNumber || '',
          workingDays: m.workingDays || 'Mon - Sat',
          timings: m.timings || '11:00 AM - 9:00 PM',
          // Include kitchenPoster from vendor data
          kitchenPoster: m.kitchenPoster || null,
          // Trial settings
          trialEnabled: m.trialEnabled === true,
          trialFee: m.trialFee || 0,
          reviews: []
        }));
        if (mapped.length > 0) setTiffins(mapped);
      } catch (e) {
        console.warn('Polling: Failed to refresh menus', e);
      }
    }, 30000); // 30 seconds polling interval

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Fetch claimed offers (offers already redeemed by current user)
  const fetchClaimedOffers = async () => {
    try {
      console.log('[UserDashboard] Fetching claimed offers...');
      const claimedIds = await getClaimedOffers();
      console.log('[UserDashboard] Claimed offer IDs:', claimedIds);
      // Ensure we set an array
      const idsArray = Array.isArray(claimedIds) ? claimedIds : [];
      setClaimedOfferIds(idsArray);
    } catch (error) {
      console.error('[UserDashboard] Error fetching claimed offers:', error);
      // Don't set error state for claimed offers - it's non-critical
    }
  };

  // Fetch active offers when offers tab is selected
  const fetchActiveOffers = async () => {
    try {
      setOffersLoading(true);
      setOffersError(null);
      console.log('[UserDashboard] Fetching active offers...');
      const offers = await getActiveOffers();
      console.log('[UserDashboard] Active offers response:', offers);
      console.log('[UserDashboard] Number of offers:', offers?.length || 0);
      
      // Ensure we set an array - handle both direct array and wrapped response
      const offersArray = Array.isArray(offers) ? offers : (offers?.offers || []);
      setActiveOffers(offersArray);
    } catch (error) {
      console.error('[UserDashboard] Error fetching active offers:', error);
      setOffersError('Failed to load offers. Please try again.');
    } finally {
      setOffersLoading(false);
    }
  };

  // Fetch offers when switching to offers tab
  useEffect(() => {
    if (activeTab === 'offers') {
      // Fetch both active offers and claimed offers for the current user
      fetchActiveOffers();
      fetchClaimedOffers();
    }
  }, [activeTab]);

  // Handle offer redemption - navigate to order flow with pre-selected vendor and plan
  const handleRedeemOffer = async (offer, planType) => {
    try {
      // Find the vendor in tiffins or create a basic vendor object
      const vendor = tiffins.find(t => t.vendorId === offer.vendorId) || {
        vendorId: offer.vendorId,
        name: offer.kitchenName,
        price: 80,
        menuPrice: 80
      };

      // Call the redeemOffer API to create the order with discount
      const response = await redeemOffer(offer._id, planType);

      // Show success message with offer details
      alert(`${response.message}\n\nVendor: ${response.offerDetails?.vendorName}\nPlan: ${response.offerDetails?.planType}\nOriginal Price: ₹${response.offerDetails?.originalPrice}\nDiscount: ${response.offerDetails?.discountPercentage}% OFF\nYou Pay: ₹${response.offerDetails?.discountedPrice}`);

      // IMMEDIATELY update claimedOfferIds state to show Claimed badge without page refresh
      setClaimedOfferIds(prevIds => {
        const newIds = [...prevIds];
        if (!newIds.includes(offer._id)) {
          newIds.push(offer._id);
        }
        return newIds;
      });

      // Refresh orders
      const userOrders = await getUserOrders();
      setOrders(userOrders || []);

      // Refresh user data to get updated expiry date
      const userData = await getCurrentUser();
      setUser(prev => ({ ...prev, expiryDate: userData.expiryDate }));

    } catch (error) {
      console.error('Error redeeming offer:', error);
      alert('Failed to redeem offer: ' + (error.message || 'Unknown error'));
    }
  };



  const fetchUserData = async () => {

    try {

      setLoading(true);

      const userData = await getCurrentUser();

      const updatedUser = {

        ...user,

        ...userData,

        pausedDays: user.pausedDays

      };

      setUser(updatedUser);

     

      // Update localStorage with fresh user data from backend
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        ...userData,
        profilePic: userData.profilePic || storedUser.profilePic
      }));

     

      const userOrders = await getUserOrders();

      setOrders(userOrders || []);

     

      // Fetch subscription data - 404 expected if no active sub
      try {
        const subData = await getUserSubscription();
        setSubscription(subData);
      } catch (subErr) {
        if (subErr.message?.includes('No active subscription')) {
          console.log('[UserDashboard] No active subscription found - normal');
        } else {
          console.warn('Subscription fetch error:', subErr.message);
        }
        setSubscription(null);
      }
     
      // Fetch active subscription status (for trial button visibility) - 404 expected
      try {
        const statusData = await getActiveSubscriptionStatus();
        setHasActivePlan(statusData.hasActivePlan || false);
      } catch (statusErr) {
        if (statusErr.message?.includes('No active subscription')) {
          console.log('[UserDashboard] No active plan found - trial available');
        } else {
          console.warn('Subscription status error:', statusErr.message);
        }
        setHasActivePlan(false);
      }

      // Fetch claimed offers on initial dashboard load so badges appear immediately
      try {
        const claimedIds = await getClaimedOffers();
        console.log('[UserDashboard] Initial claimed offer IDs:', claimedIds);
        const idsArray = Array.isArray(claimedIds) ? claimedIds : [];
        setClaimedOfferIds(idsArray);
      } catch (claimedErr) {
        console.warn('Could not fetch claimed offers');
      }

     

      try {
        const menus = await getMenus();
        // Map menus to tiffins UI shape - include full menu data for dynamic display
        let mapped = (menus || []).map(m => ({
          // Vendor info
          vendorId: m.vendorId || null,
          name: m.kitchenName || 'Partner Kitchen',
          address: m.address || '',
          price: m.menuPrice || m.price || 80,
          rating: m.rating || 4.5,
          type: m.dietaryCategory || 'Regular',
          fssai: m.fssaiNumber || '',
          workingDays: m.workingDays || 'Mon - Sat',
          timings: m.timings || '11:00 AM - 9:00 PM',
          pricing: m.pricing || [],
          offersJainMenu: m.offersJainMenu || false,
          upiId: m.upiId || null,
          jainWeeklyPlan: m.jainWeeklyPlan || {},

          // Menu items from Menu collection
          menuId: m._id,
          mainSabji: m.mainSabji || '',
          altSabji: m.altSabji || '',
          sweetItem: m.sweetItem || '',
          menuDate: m.date,
          // Include kitchenPoster from vendor data
          kitchenPoster: m.kitchenPoster || null,
          // Trial settings
          trialEnabled: m.trialEnabled === true,
          trialFee: m.trialFee || 0,
          reviews: []
        }));

        
        // If no menus found, fetch approved vendors as fallback
        if (mapped.length === 0) {
          try {
            const vendors = await getApprovedVendors();
            mapped = (vendors || []).map(v => ({
              vendorId: v.vendorId || v._id || null,
              name: v.name || v.kitchenName || 'Partner Kitchen',
              address: v.address || '',
              price: v.menuPrice || v.price || 80,
              rating: v.rating || 4.5,
              type: v.type || 'Regular',
              fssai: v.fssaiNumber || v.fssai || '',
              workingDays: v.workingDays || 'Mon - Sat',
              timings: v.timings || '11:00 AM - 9:00 PM',
              pricing: v.pricing || [],
              offersJainMenu: v.offersJainMenu || false,
              upiId: v.upiId || null,
              jainWeeklyPlan: v.jainWeeklyPlan || {},
              weeklyPlan: v.weeklyPlan,
              // Include kitchenPoster from vendor data
              kitchenPoster: v.kitchenPoster || null,
              // Trial settings
              trialEnabled: v.trialEnabled === true,
              trialFee: v.trialFee || 0,
              reviews: []
            }));

          } catch (vendorErr) {
            console.warn('Failed to load vendors', vendorErr);
          }
        }
        
        if (mapped.length > 0) setTiffins(mapped);
      } catch (e) {
        console.warn('Failed to load menus', e);
        
        // Try fetching vendors as final fallback
        try {
          const vendors = await getApprovedVendors();
          const mapped = (vendors || []).map(v => ({
            vendorId: v.vendorId || v._id || null,
            name: v.name || v.kitchenName || 'Partner Kitchen',
            address: v.address || '',
            price: v.menuPrice || v.price || 80,
            rating: v.rating || 4.5,
            type: v.type || 'Regular',
            fssai: v.fssaiNumber || v.fssai || '',
            workingDays: v.workingDays || 'Mon - Sat',
            timings: v.timings || '11:00 AM - 9:00 PM',
            weeklyPlan: v.weeklyPlan,
            // Include kitchenPoster from vendor data
            kitchenPoster: v.kitchenPoster || null,
            // Trial settings
            trialEnabled: v.trialEnabled === true,
            trialFee: v.trialFee || 0,
            reviews: []
          }));
          if (mapped.length > 0) setTiffins(mapped);
        } catch (vendorErr) {
          console.warn('Failed to load vendors as fallback', vendorErr);
        }
      }

    } catch (err) {

      console.error('Error fetching user data:', err);

      setError('Failed to load user data');

    } finally {

      setLoading(false);

    }

  };



  // --- FUNCTIONS ---



  // Handle Photo Change - store the file for upload

  const handlePhotoChange = (e) => {

    const file = e.target.files[0];

    if (file) {

      // Store the file for later upload

      setSelectedPhotoFile(file);

     

      // Also show preview immediately

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

      let newProfilePic = null;
     

      // If there's a new profile picture, upload it first

      if (selectedPhotoFile) {

        const formData = new FormData();

        formData.append('profilePic', selectedPhotoFile);

       

        const picResponse = await updateUserProfilePic(userData._id, formData);

       

        // Update user state with new profile pic URL from backend

        newProfilePic = picResponse.profilePic;
        
        setUser(prev => ({

          ...prev,

          ...profileData,

          profilePic: newProfilePic

        }));

       

        // Update localStorage with both profile data and new picture URL

        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

        localStorage.setItem('user', JSON.stringify({

          ...storedUser,

          ...profileData,

          profilePic: newProfilePic

        }));

       

        // Clear the selected file

        setSelectedPhotoFile(null);

      }

     

      // Update other profile fields
      const updated = await updateUserProfile(userData._id, profileData);

      
      // FIX Bug 5: Merge all updates, applying newProfilePic LAST to preserve the full URL
      const finalUpdate = {
        ...user,
        ...updated,
        ...profileData,
        ...(newProfilePic && { profilePic: newProfilePic })
      };
      
      setUser(finalUpdate);

      
      // Update localStorage with final merged data
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        ...profileData,
        ...(newProfilePic && { profilePic: newProfilePic })
      }));

      // Re-fetch user data to ensure ProfileModal shows fresh data on next open
      try {
        const freshUserData = await getCurrentUser();
        setUser(prev => ({
          ...prev,
          ...freshUserData,
          profilePic: freshUserData.profilePic || newProfilePic || prev.profilePic
        }));
      } catch (fetchErr) {
        console.warn('Failed to refresh user data after save:', fetchErr);
      }

      setShowProfileModal(false);

      alert("Profile updated successfully!");

    } catch (err) {

      console.error('Error updating profile:', err);

      alert('Failed to update profile: ' + err.message);

    }

  };



const handleDownloadInvoice = async (historyItem) => {
  const doc = new jsPDF();

  // ===== COLORS =====
  const primary = [242, 101, 34];
  const dark = [33, 37, 41];
  const gray = [120, 120, 120];
  const lightGray = [240, 240, 240];
  const green = [34, 197, 94]; // Success green
  const orange = [249, 115, 22]; // Pending orange

  // ===== SAFE DATA =====
  const vendorName = historyItem.vendorName || 'Partner Kitchen';
  const vendorAddress = historyItem.vendorAddress || '';
  const customerName = historyItem.customerName || user.name || 'Customer';
  const customerPhone = historyItem.customerPhone || user.phone || '';
  const customerEmail = historyItem.customerEmail || user.email || '';
  const customerAddress = historyItem.customerAddress || user.address || '';
  const mealPreference = historyItem.mealPreference || 'Regular';
  const paymentMethod = historyItem.paymentMethod || 'Cash';
  const transactionId = historyItem.transactionId || 'N/A';
  const orderStatus = historyItem.status || 'Pending';
  const orderAmount = Number(historyItem.amount) || 0;
  
  // Get order date for meal description lookup
  const orderDate = historyItem.orderDate ? new Date(historyItem.orderDate) : new Date();
  const dayOfWeek = orderDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Try to fetch vendor's weekly plan for meal description
  let mealDescription = '';
  try {
    if (historyItem.vendorId) {
      const vendorPlan = await getVendorWeeklyPlan(historyItem.vendorId);
      if (vendorPlan.weeklyPlan && vendorPlan.weeklyPlan[dayOfWeek]) {
        const dayMenu = vendorPlan.weeklyPlan[dayOfWeek];
        mealDescription = `Main Course: ${dayMenu.mainCourse || 'N/A'}\nSides: ${dayMenu.sides || 'N/A'}\nSpecial Add-ons: ${dayMenu.specialAddOns || 'N/A'}`;
      }
    }
  } catch (e) {
    console.warn('Could not fetch vendor weekly plan for invoice:', e);
    // Fallback to basic meal description
    mealDescription = `Meal Preference: ${mealPreference}`;
  }
  
  if (!mealDescription) {
    mealDescription = `Meal Preference: ${mealPreference}`;
  }

  // ================= HEADER BAR =================
  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 30, "F");

  doc.setTextColor(255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("MealSetu", 20, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Quality Food, Delivered with Care", 20, 24);

  // Invoice title right
  doc.setFontSize(16);
  doc.text("TAX INVOICE", 150, 18);

  doc.setFontSize(9);
  doc.text(`Invoice #: ${historyItem.id}`, 150, 23);
  doc.text(`Date: ${historyItem.date}`, 150, 27);

  // ================= VENDOR CARD =================
  doc.setFillColor(...lightGray);
  doc.roundedRect(20, 40, 80, 40, 3, 3, "F");

  doc.setTextColor(...primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VENDOR", 24, 48);

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(vendorName, 24, 55);

  if (vendorAddress) {
    const lines = doc.splitTextToSize(vendorAddress, 70);
    doc.text(lines, 24, 61);
  }

  // ================= CUSTOMER CARD =================
  doc.setFillColor(...lightGray);
  doc.roundedRect(110, 40, 80, 40, 3, 3, "F");

  doc.setTextColor(...primary);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER", 114, 48);

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.text(customerName, 114, 55);

  if (customerPhone) doc.text(`Phone: ${customerPhone}`, 114, 61);
  if (customerEmail) doc.text(`Email: ${customerEmail}`, 114, 67);

  // ================= CONDITIONAL STATUS BADGE =================
  // Payment Method Check: CASH = PENDING (orange), UPI/Online = PAID (green)
  const isCashPayment = /cash/i.test(paymentMethod);
  const statusColor = isCashPayment ? orange : green;
  const statusText = isCashPayment ? 'STATUS: PENDING' : 'STATUS: PAID';
  
  doc.setFillColor(...statusColor);
  doc.roundedRect(140, 85, 55, 10, 2, 2, "F");

  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, 167.5, 91.5, { align: "center" });

  // ================= TABLE with Meal Description =================
  autoTable(doc, {
    startY: 100,
    theme: "grid",
    head: [["Description", "Amount"]],
    body: [
      [
        `Tiffin Subscription: ${historyItem.plan}
Meal for ${dayOfWeek}:
${mealDescription}
Meal Preference: ${mealPreference}
Payment Method: ${paymentMethod}
Transaction: ${transactionId}`,
        "Rs. " + orderAmount.toFixed(2),
      ],
    ],
    styles: {
      fontSize: 10,
      cellPadding: 6,
    },
    headStyles: {
      fillColor: primary,
      textColor: 255,
      halign: "left",
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { halign: "right" },
    },
  });

  // ================= TOTAL BOX =================
  const y = doc.lastAutoTable.finalY + 15;

  doc.setFillColor(...lightGray);
  doc.roundedRect(120, y - 8, 70, 25, 3, 3, "F");

  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", 125, y);
  doc.text("Rs. " + orderAmount.toFixed(2), 185, y, { align: "right" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primary);
  doc.text("Grand Total:", 125, y + 10);
  doc.text("Rs. " + orderAmount.toFixed(2), 185, y + 10, {
    align: "right",
  });

  // ================= PAYMENT STATUS FOOTER =================
  doc.setFontSize(10);
  doc.setFillColor(...statusColor);
  doc.roundedRect(20, y + 25, 170, 12, 2, 2, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${isCashPayment ? '⚠ PAYMENT PENDING - Cash on Delivery' : '✓ PAYMENT RECEIVED - Online Payment'}`, 
    105, 
    y + 32, 
    { align: "center" }
  );

  // ================= FOOTER =================
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Thank you for using MealSetu. This is a computer-generated invoice.",
    105,
    285,
    { align: "center" }
  );

  // ================= SAVE =================
  doc.save(`MealSetu_Invoice_${historyItem.id}.pdf`);
};





  const handleApplyLeave = async () => {

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

      try {

        // Call the backend API to apply leave

        const response = await applyLeave(leaveStart, leaveEnd, mealType);

       

        // Update local state with the new expiry date from backend

        const newExpiryDate = new Date(response.newExpiryDate).toISOString().split('T')[0];

       

        const newLeaveRecord = { from: leaveStart, to: leaveEnd, type: mealType, days: diffDays };

        const updatedPausedDays = [...user.pausedDays, newLeaveRecord];



        setUser({ ...user, expiryDate: newExpiryDate, pausedDays: updatedPausedDays });



        localStorage.setItem('expiryDate', newExpiryDate);

        localStorage.setItem('pausedDates', JSON.stringify(updatedPausedDays));



        // Show success message as per requirement

        alert("Subscription extended successfully");

        setLeaveStart('');

        setLeaveEnd('');

      } catch (error) {

        console.error('Error applying leave:', error);

        alert('Failed to apply leave: ' + error.message);

      }

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
        await addReview(vendor.vendorId || vendor._id || vendor.id, rating, comment);
        alert('Review submitted');
        setShowReviewModal(false);
      } catch (e) {
        alert('Failed to submit review: ' + e.message);
      }
    })();
  };



  const handleOrder = async (vendor, orderData = {}) => {
    try {
      const vendorId = vendor.vendorId || vendor._id || vendor.id;
      if (!vendorId) return alert('Unable to place order: missing vendor id');

      // ✅ FIXED: Dynamic pricing from vendor.pricing using orderData.plan
      const planTypeMap = { 'ONEDAY': 'daily', 'WEEKLY': 'weekly', 'MONTHLY': 'monthly' };
      const selectedPlanKey = orderData?.plan || 'ONEDAY';
      const selectedPlanType = planTypeMap[selectedPlanKey] || 'daily';
      const activePricing = (vendor.pricing || []).filter(p => (p.active || p.is_active) && p.price > 0);
      const matchedPlan = activePricing.find(p => p.type === selectedPlanType);
      const amount = matchedPlan ? matchedPlan.price : (orderData?.totalAmount || orderData?.price || parseInt(vendor.price || 80, 10));

      if (!amount || amount <= 0) return alert('Unable to place order: invalid amount');

      // Ensure mealPreference matches backend enum: 'Regular' or 'Jain'
      const mealPrefRaw = (vendor.type || '').toString();
      const mealPreference = /jain/i.test(mealPrefRaw) ? 'Jain' : 'Regular';

      // Call API with optional order data (plan, startDate, etc.)
      await placeOrder(vendorId, [], amount, 'Lunch', mealPreference, orderData);

      alert('Order placed successfully');

      const userOrders = await getUserOrders();
      setOrders(userOrders || []);
    } catch (e) {
      // If backend returned structured error, show it
      alert('Failed to place order: ' + (e.message || JSON.stringify(e)));
    }
  };



  const handleExtendSubscription = async (plan, paymentMethod = 'Cash') => {

    try {

      // Get the first available vendor ID (for demo purposes)

      const vendorId = tiffins[0]?.vendorId || '65f000000000000000000001';

     

      // Call the API with payment method

      const response = await extendSubscription(plan, vendorId, paymentMethod);

     

      // Update subscription state with the new data

      if (response.subscription) {

        setSubscription({

          subscription: response.subscription,

          isActive: true,

          isExpired: false,

          daysRemaining: response.subscription.days || 30

        });

      }

     

      // Refresh user data

      const userData = await getCurrentUser();

      setUser(prev => ({ ...prev, expiryDate: userData.expiryDate }));

     

      // Refresh orders

      const userOrders = await getUserOrders();

      setOrders(userOrders || []);

     

    } catch (error) {

      console.error('Error extending subscription:', error);

      alert('Failed to extend subscription: ' + error.message);

    }

  };



  // --- DATA ---

  // All tiffin/menu data now comes from backend via `tiffins` state

  // Active offers are fetched dynamically from the API and passed to the Offers component



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
  <div className="user-container">

    {/* Mobile Topbar - shows on mobile only */}
    <div className="user-topbar">
      <span className="user-topbar-brand">MealSetu</span>
      <button
        className="user-hamburger"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>

    {/* Backdrop */}
    <div
      className={`user-sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
      onClick={() => setSidebarOpen(false)}
    />

    {/* Sidebar */}
    <Sidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
      onLogout={handleLogout}
      userInfo={userInfo}
    />

    {/* Main Content */}
    <main className="user-main">
      <WelcomeCard
        user={user}
        onDetectLocation={handleAutoLocation}
        onSecuritySettings={() => setShowPasswordModal(true)}
      />

      {activeTab === 'services' && (
        <OrderProvider>
        <OrderMeals
  tiffins={tiffins}
  user={user}
  hasActivePlan={hasActivePlan}
  activeSubscription={subscription}
  onOrder={handleOrder}
  onViewReviews={handleViewReviews}
  onWriteReview={handleWriteReview}
/>
        </OrderProvider>
      )}

      {activeTab === 'subscription' && (
 <Subscription
  user={user}
  subscription={subscription}
  leaveStart={leaveStart}
  leaveEnd={leaveEnd}
  mealType={mealType}
  onLeaveStartChange={setLeaveStart}
  onLeaveEndChange={setLeaveEnd}
  onMealTypeChange={setMealType}
  onApplyLeave={handleApplyLeave}
  onExtendSubscription={handleExtendSubscription}
  // onSubscriptionActivated={fetchUserData}
  vendorId={subscription?.vendorId}
  onNavigateToOrderMeals={() => setActiveTab('services')}

          onSubscriptionActivated={(response) => {
            setHasActivePlan(true);
            if (response.subscription) {
              setSubscription({
                subscription: response.subscription,
                isActive: true,
                isExpired: false,
                daysRemaining: response.subscription.days || 30
              });
            }
            if (response.subscription && response.subscription.expiryDate) {
              const newExpiryDate = new Date(response.subscription.expiryDate).toISOString().split('T')[0];
              setUser(prev => ({ ...prev, expiryDate: newExpiryDate }));
            }
            getUserOrders().then(orders => setOrders(orders || []));
          }}
        />
      )}

      {activeTab === 'history' && (
        <History
          paymentHistory={(orders || []).map(o => ({
            id: o._id ? o._id.slice(-8).toUpperCase() : 'N/A',
            date: o.orderDate ? new Date(o.orderDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            plan: o.planType || o.mealPreference || 'Tiffin',
            amount: Number(o.amount) || 0,
            status: o.paymentStatus || 'Pending',
            vendorId: o.vendorId?._id || o.vendorId || null,
            vendorName: o.vendorId?.kitchenName || 'Partner Kitchen',
            vendorAddress: o.vendorId?.address || '',
            mealPreference: o.mealPreference || 'Regular',
            deliverySlot: o.deliverySlot || 'Lunch',
            paymentMethod: o.paymentMethod || 'Cash',
            transactionId: o.transactionId || 'N/A',
            orderId: o._id || '',
            orderDate: o.orderDate || new Date().toISOString(),
            customerName: user.name || '',
            customerPhone: user.phone || '',
            customerEmail: user.email || '',
            customerAddress: user.address || ''
          }))}
          onDownloadInvoice={handleDownloadInvoice}
        />
      )}

      {activeTab === 'offers' && (
        <Offers
          activeOffers={activeOffers}
          offersLoading={offersLoading}
          offersError={offersError}
          onRedeemOffer={handleRedeemOffer}
          claimedOfferIds={claimedOfferIds}
        />
      )}

      {activeTab === 'safety' && <Safety />}
    </main>

    {/* Modals */}
    {showProfileModal && (
      <ProfileModal
        user={user}
        onSave={handleSaveProfile}
        onClose={() => { setShowProfileModal(false); setSelectedPhotoFile(null); }}
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

    {showReviewEligibilityPopup && (
      <div className="modal-overlay" onClick={() => setShowReviewEligibilityPopup(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📋</div>
          <h3 className="modal-title" style={{ marginBottom: '15px' }}>Review Status</h3>
          <p style={{ color: '#555', marginBottom: '20px', lineHeight: '1.5' }}>
            {reviewEligibility?.message || 'Unable to submit review at this time.'}
          </p>
          {reviewEligibility?.hasOrdered && (
            <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              <strong>Current Order Status:</strong> {reviewEligibility?.orderStatus || 'N/A'}
            </div>
          )}
          {!reviewEligibility?.hasOrdered && (
            <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              Please place an order first to be able to leave a review.
            </div>
          )}
          <div className="modal-actions">
            <button className="btn-primary"
              onClick={() => setShowReviewEligibilityPopup(false)}>OK</button>
          </div>
        </div>
      </div>
    )}

  </div>
);

}