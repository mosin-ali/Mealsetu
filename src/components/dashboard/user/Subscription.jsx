import React, { useState, useEffect, useRef } from 'react';
import './Subscription.css';
import './SubscriptionModal.css';
import { apiCall, getMySubscription, getUpcomingOrders, extendSubscriptionOrder, checkSubscriptionPaymentStatus } from '../../../utils/api';

const Subscription = ({ user, subscription, leaveStart, leaveEnd, mealType, onLeaveStartChange, onLeaveEndChange, onMealTypeChange, onApplyLeave, onExtendSubscription, onSubscriptionActivated, vendorId }) => {
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [upcomingPlans, setUpcomingPlans] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSubmittingRef = useRef(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    setError(null);
    try {
      const subData = await getMySubscription();
      setCurrentSubscription(subData);
      const upcomingData = await getUpcomingOrders();
      setUpcomingPlans(upcomingData || []);
      setPendingCount(upcomingData?.length || 0);
    } catch (err) {
      console.error('Error fetching subscription data:', err);
      setCurrentSubscription(null);
      setUpcomingPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('MONTHLY');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Cash');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [vendorDetails, setVendorDetails] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);

  // const plans = [
  //   { id: 'WEEKLY', name: 'Weekly', price: 560, days: 7 },
  //   { id: 'MONTHLY', name: 'Monthly', price: 2000, days: 30 },
  // ];


const [plans, setPlans] = useState([
    { id: 'WEEKLY', name: 'Weekly', price: 560, days: 7 },
    { id: 'MONTHLY', name: 'Monthly', price: 2000, days: 30 },
  ]);

  // Fetch vendor pricing dynamically
  useEffect(() => {
    const fetchVendorPricing = async () => {
      try {
        if (!vendorId) return;
        const vendorRes = await apiCall(`/users/vendors`);
        const vendorsList = Array.isArray(vendorRes) ? vendorRes : vendorRes.vendors || [];
        const matchedVendor = vendorsList.find(
          v => String(v._id) === String(vendorId) || String(v.vendorId) === String(vendorId)
        );
        if (!matchedVendor || !matchedVendor.pricing) return;

        const activePricing = matchedVendor.pricing.filter(p => p.active && p.price > 0);

        const updatedPlans = [];

        const weeklyPlan = activePricing.find(p => p.type === 'weekly');
        const monthlyPlan = activePricing.find(p => p.type === 'monthly');

        if (weeklyPlan) {
          updatedPlans.push({ id: 'WEEKLY', name: 'Weekly', price: weeklyPlan.price, days: 7 });
        }
        if (monthlyPlan) {
          updatedPlans.push({ id: 'MONTHLY', name: 'Monthly', price: monthlyPlan.price, days: 30 });
        }

        if (updatedPlans.length > 0) {
          setPlans(updatedPlans);
          setSelectedPlan(updatedPlans[updatedPlans.length > 1 ? 1 : 0].id);
        }
      } catch (err) {
        console.warn('Could not fetch vendor pricing, using defaults:', err.message);
      }
    };

    fetchVendorPricing();
  }, [vendorId]);

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
  };

  // ✅ SINGLE handleConfirmSubscribe — no duplicate
  const handleConfirmSubscribe = async () => {
    if (upcomingPlans.length >= 3) {
      alert("You have reached the maximum limit of 3 upcoming plan extensions.");
      return;
    }
    setIsProcessing(true);
    if (selectedPaymentMethod === 'UPI') {
      await createOrder('UPI');
    } else {
      await createOrder('Cash');
    }
  };

// ✅ FIXED UPI flow: fetch vendor FIRST, validate upiId, then create order
  const createOrder = async (paymentMethod) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);
    setIsExtending(true);

    try {
      const selectedVendorId = vendorId;
      if (!selectedVendorId) {
        throw new Error('No vendor available. Please try again later or contact support.');
      }

      // FIX 7: Check if user has NO active plan - call placeOrder instead of extendSubscriptionOrder
      if (!currentSubscription) {
        // User has NO active plan - create new active order immediately
        const today = new Date().toISOString().split('T')[0];
        
        const response = await apiCall('/users/order', {
          method: 'POST',
          body: JSON.stringify({
            vendorId: selectedVendorId,
            amount: selectedPlan === 'WEEKLY' ? 560 : 2000,
            plan: selectedPlan,
            paymentMethod: paymentMethod,
            startDate: today,  // Always today when no active plan
            deliverySlot: 'Lunch',
            mealPreference: 'Regular'
          })
        });
        
        console.log('Direct order response:', response);
        setCurrentOrderId(response.order?._id);
        
        // Cash payment success
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        await fetchSubscriptionData();
        closeAllModals();

        if (onSubscriptionActivated) {
          onSubscriptionActivated(response);
        }
        
        isSubmittingRef.current = false;
        setIsProcessing(false);
        setIsExtending(false);
        return;
      }

if (paymentMethod === 'UPI') {
        // Step 1: Fetch vendors FIRST
        const vendorRes = await apiCall(`/users/vendors`);
        console.log("Vendor API FULL:", vendorRes);
        // const matchedVendor = Array.isArray(vendorRes)
        //   ? vendorRes.find(v => v._id === selectedVendorId || v.vendorId === selectedVendorId)
        //   : null;

        const vendorsList = Array.isArray(vendorRes)
          ? vendorRes
          : vendorRes.vendors || [];
        
        console.log("Selected Vendor ID:", selectedVendorId);
        const matchedVendor = vendorsList.find(
          v =>
            String(v._id) === String(selectedVendorId) ||
            String(v.vendorId) === String(selectedVendorId)
        );
        console.log("Vendors List:", vendorsList);
        console.log("Matched Vendor:", matchedVendor);

        if (!matchedVendor) {
          alert("Vendor not found. Please try again.");
          return;
        }

        // Step 2: Check if upiId exists - STOP if missing
        if (!matchedVendor.upiId || matchedVendor.upiId.trim() === '') {
          alert('This vendor has not configured UPI payments yet. Please select Cash or try another vendor.');
          return;
        }

        // Step 3: Create order with real upiId available
        const response = await extendSubscriptionOrder(selectedPlan, selectedVendorId, paymentMethod);
        const orderId = response.order?._id;
        setCurrentOrderId(orderId);

        // Step 4: Set real vendor details
        setVendorDetails({
          upiId: matchedVendor.upiId?.trim(),
          kitchenName: matchedVendor.name || matchedVendor.kitchenName
        });

        // Step 5-7: Show QR modal, polling starts automatically
        setShowPaymentModal(false);   
        setShowQRCode(true);
        return;
      }

      // Cash flow - FIX 7: Check if user has active plan
      let response;
      if (currentSubscription) {
        // User has active plan — extend/queue the subscription
        response = await extendSubscriptionOrder(selectedPlan, selectedVendorId, paymentMethod);
      } else {
        // User has NO active plan — create new active order immediately
        response = await apiCall('/users/order', {
          method: 'POST',
          body: JSON.stringify({
            vendorId: selectedVendorId,
            amount: selectedPlanDetails?.price || (selectedPlan === 'WEEKLY' ? 560 : 2000),
            plan: selectedPlan,
            paymentMethod: paymentMethod,
            startDate: new Date().toISOString().split('T')[0],
            deliverySlot: 'Lunch',
            mealPreference: 'Regular'
          })
        });
      }
      const orderId = response.order?._id;
      setCurrentOrderId(orderId);

      // Cash payment success
      setShowPaymentModal(false);
      setShowSuccessModal(true);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      await fetchSubscriptionData();
      closeAllModals();

      if (onSubscriptionActivated) {
        onSubscriptionActivated(response);
      }

    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create subscription: ' + error.message);
    } finally {
      setIsProcessing(false);
      setIsExtending(false);
      isSubmittingRef.current = false;
    }
  };

  // ✅ FIXED: Reset isExtending on cancel
  const handleCancelQR = () => {
    setShowQRCode(false);
    setCurrentOrderId(null);
    setVendorDetails(null);
    setIsProcessing(false);
    setIsExtending(false);
  };

  // ✅ FIXED: Show full success modal on paid=true
  useEffect(() => {
    if (!showQRCode || !currentOrderId) return;

    const interval = setInterval(async () => {
      try {
        const response = await checkSubscriptionPaymentStatus(currentOrderId);
        if (response.paid) {
          clearInterval(interval);
          setShowQRCode(false);
          setCurrentOrderId(null);
          setVendorDetails(null);
          setShowSuccessModal(true);
          await fetchSubscriptionData();
        } else if (response.timeout) {
          clearInterval(interval);
          setShowQRCode(false);
          alert(response.message || 'Payment not received. Please try again.');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [showQRCode, currentOrderId]);

  const closeAllModals = () => {
    setShowPaymentModal(false);
    setShowQRCode(false);
    setShowSuccessModal(false);
  };

  const isConfirmDisabled = isProcessing || !selectedPlan || !selectedPaymentMethod;

  if (loading) {
    return (
      <div className="subscription-container">
        <div className="subscription-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading subscription data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-container">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="success-toast">
          ✓ Subscription extended successfully!
        </div>
      )}

      {/* Current Plan Card */}
      <div className="subscription-card">
        <h3>Meal Plan Status</h3>
        {currentSubscription ? (
          <div className="status-display">
            <p className="status-label">Current Plan</p>
            <h2 className="status-date" style={{ color: '#16a34a' }}>{currentSubscription.planType}</h2>
            <p className="status-label" style={{ marginTop: '10px' }}>Subscription Valid Until</p>
            <h2 className="status-date">{formatDate(currentSubscription.endDate)}</h2>
            {currentSubscription.status === 'active' ? (
              <p style={{ color: '#16a34a', marginTop: '5px' }}>✓ Active</p>
            ) : (
              <p style={{ color: '#dc2626', marginTop: '5px' }}>⚠ Expired</p>
            )}
          </div>
        ) : (
          <div className="status-display">
            <p className="status-label">Current Plan</p>
            <h2 className="status-date" style={{ color: '#6b7280' }}>No Active Plan</h2>
          </div>
        )}

        {currentSubscription && currentSubscription.status === 'active' && (
          <button
            className={`btn-primary extend-btn ${upcomingPlans.length >= 3 ? 'disabled' : ''}`}
            onClick={() => { setIsExtending(true); setShowPaymentModal(true); }}
            disabled={isExtending || upcomingPlans.length >= 3}
            title={upcomingPlans.length >= 3 ? "You have reached the maximum limit of 3 upcoming plan extensions." : ''}
          >
            {isExtending ? 'Processing...' : 'Extend Subscription'}
          </button>
        )}

        {!currentSubscription && (
          <button
            className="btn-primary extend-btn"
            onClick={() => { setIsExtending(true); setShowPaymentModal(true); }}
            disabled={isExtending}
          >
            {isExtending ? 'Processing...' : 'Subscribe Now'}
          </button>
        )}
      </div>

      {/* Upcoming Plan Card */}
      <div className="subscription-card">
        <h3>Upcoming Plan</h3>
        {upcomingPlans && upcomingPlans.length > 0 ? (
          <div className="upcoming-plans-list">
            {upcomingPlans.map((plan, index) => (
              <div key={plan._id || index} className="upcoming-plan-item">
                <div className="upcoming-plan-header">
                  <span className="upcoming-plan-type">{plan.planType}</span>
                  <span className="upcoming-plan-status" style={{ color: '#f59e0b' }}>Pending</span>
                </div>
                <div className="upcoming-plan-details">
                  <p><strong>Kitchen:</strong> {plan.vendorName}</p>
                  <p><strong>Starts:</strong> {formatDate(plan.scheduledStartDate)}</p>
                  <p><strong>Ends:</strong> {formatDate(plan.scheduledEndDate)}</p>
                  <p><strong>Amount:</strong> ₹{plan.amount}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="status-display">
            <p style={{ color: '#6b7280', textAlign: 'center' }}>No upcoming plans yet</p>
          </div>
        )}
      </div>

      {/* Leave/Pause Card */}
      <div className="subscription-card">
        <h3>Schedule Leave / Pause</h3>
        <div className="leave-form">
          <div>
            <label className="input-label">Start Date</label>
            <input type="date" className="input-field date-input" value={leaveStart} onChange={(e) => onLeaveStartChange(e.target.value)} />
          </div>
          <div>
            <label className="input-label">End Date</label>
            <input type="date" className="input-field date-input" value={leaveEnd} onChange={(e) => onLeaveEndChange(e.target.value)} />
          </div>
        </div>
        <label className="input-label">Which Meal to Skip?</label>
        <select className="input-field" value={mealType} onChange={(e) => onMealTypeChange(e.target.value)}>
          <option value="both">Both (Lunch & Dinner)</option>
          <option value="lunch">Lunch Only</option>
          <option value="dinner">Dinner Only</option>
        </select>
        <button className="btn-primary apply-leave-btn" onClick={onApplyLeave}>⏸ Apply Leave & Extend Plan</button>
      </div>

      {/* Subscribe Plan Modal */}
      {showPaymentModal && (
        <div className="subscribe-modal-overlay" onClick={() => { setShowPaymentModal(false); setIsExtending(false); }}>
          <div className="subscribe-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="subscribe-modal-close" onClick={() => { setShowPaymentModal(false); setIsExtending(false); }}>×</button>
            <div className="subscribe-modal-header">
              <h2 className="subscribe-modal-title">Subscribe Now</h2>
              <p className="subscribe-modal-subtitle">Choose a plan that works best for you</p>
            </div>

            <div className="plan-selection-grid">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-card-option ${selectedPlan === plan.id ? 'selected' : ''} ${plan.id === 'MONTHLY' ? 'monthly-plan' : ''}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.id === 'MONTHLY' && (
                    <span className="most-popular-badge">Most Popular</span>
                  )}
                  <h3 className="plan-name">{plan.name}</h3>
                  <p className="plan-price">₹{plan.price}</p>
                  <p className="plan-duration">{plan.days} Days</p>
                  <ul className="plan-benefits">
                    <li>Fresh meals delivered</li>
                    <li>Flexible pause option</li>
                    <li>Best value guarantee</li>
                  </ul>
                </div>
              ))}
            </div>

            <div className="payment-method-section">
              <h4 className="payment-method-heading">Payment Method</h4>
              <div className="payment-method-buttons">
                <button
                  className={`payment-method-btn ${selectedPaymentMethod === 'UPI' ? 'selected' : ''}`}
                  onClick={() => handlePaymentMethodSelect('UPI')}
                >
                  📱 UPI
                </button>
                <button
                  className={`payment-method-btn ${selectedPaymentMethod === 'Cash' ? 'selected' : ''}`}
                  onClick={() => handlePaymentMethodSelect('Cash')}
                >
                  💵 Cash
                </button>
              </div>
            </div>

            <div className="order-summary-box">
              {selectedPlan ? (
                <div className="order-summary-content">
                  <strong>{selectedPlanDetails?.name}</strong> Plan - ₹{selectedPlanDetails?.price}
                </div>
              ) : (
                <div className="order-summary-placeholder">
                  Select a plan to see summary
                </div>
              )}
            </div>

            <div className="subscribe-modal-button-row">
              <button className="btn-cancel" onClick={() => { setShowPaymentModal(false); setIsExtending(false); }}>
                Cancel
              </button>
              <button
                className={`btn-confirm-subscribe ${isConfirmDisabled ? 'disabled' : ''}`}
                onClick={handleConfirmSubscribe}
                disabled={isConfirmDisabled}
              >
                {isProcessing ? 'Processing...' : 'Confirm and Subscribe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPI QR Code Modal — ✅ Only Cancel button, no I've Paid */}
      {showQRCode && (
        <div className="subscribe-modal-overlay" onClick={handleCancelQR}>
          <div className="subscribe-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="subscribe-modal-close" onClick={handleCancelQR}>×</button>
            <div className="subscribe-modal-header">
              <h2 className="subscribe-modal-title">Scan to Pay</h2>
              <p className="subscribe-modal-subtitle">Amount: ₹{selectedPlanDetails?.price}</p>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {vendorDetails?.upiId ? (
                <>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=${vendorDetails.upiId}&pn=${encodeURIComponent(vendorDetails.kitchenName || 'MealSetu')}&am=${selectedPlanDetails?.price}&cu=INR&tn=${encodeURIComponent('MealSetu Subscription')}`)}`}
                    alt="UPI QR Code"
                    style={{ width: '200px', height: '200px', borderRadius: '8px' }}
                  />
                  <p style={{ marginTop: '12px', color: '#374151', fontWeight: '500' }}>
                    Paying to: {vendorDetails.kitchenName} ({vendorDetails.upiId})
                  </p>
                </>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: '#dc2626' }}>⚠ Payment not available. Please contact support.</p>
                </div>
              )}
            </div>
            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '8px' }}>
              Scan the QR code using any UPI app to pay ₹{selectedPlanDetails?.price}
            </p>
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
              ⏳ Waiting for payment confirmation automatically...
            </p>
            {/* ✅ Only Cancel button — no I've Paid, no Processing */}
            <div className="subscribe-modal-button-row">
              <button className="btn-cancel" onClick={handleCancelQR}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="subscribe-modal-overlay" onClick={closeAllModals}>
          <div className="subscribe-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <span style={{ fontSize: '40px', color: 'white' }}>✓</span>
              </div>
              <h2 className="subscribe-modal-title" style={{ marginBottom: '10px' }}>Payment Successful! 🎉</h2>
              <p className="subscribe-modal-subtitle" style={{ marginBottom: '20px' }}>
                Your subscription has been extended successfully.
              </p>
              <div className="order-summary-box" style={{ textAlign: 'left' }}>
                <p style={{ margin: '8px 0' }}><strong>Plan:</strong> {selectedPlanDetails?.name}</p>
                <p style={{ margin: '8px 0' }}><strong>Amount:</strong> ₹{selectedPlanDetails?.price}</p>
                <p style={{ margin: '8px 0' }}><strong>Payment Method:</strong> {selectedPaymentMethod}</p>
                <p style={{ margin: '8px 0' }}><strong>Valid For:</strong> {selectedPlanDetails?.days} days</p>
              </div>
              <button
                className="btn-confirm-subscribe"
                onClick={() => {
                  setShowSuccessModal(false);
                  setIsExtending(false);
                  setIsProcessing(false);
                }}
                style={{ marginTop: '20px', width: '100%' }}
              >
                Great!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
