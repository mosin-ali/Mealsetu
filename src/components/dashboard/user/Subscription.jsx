import React, { useState, useEffect, useRef } from 'react';
import './Subscription.css';
import './SubscriptionModal.css';
import { apiCall, getMySubscription, getUpcomingOrders, extendSubscriptionOrder } from '../../../utils/api';

const Subscription = ({ user, subscription, leaveStart, leaveEnd, mealType, onLeaveStartChange, onLeaveEndChange, onMealTypeChange, onApplyLeave, onExtendSubscription, onSubscriptionActivated, vendorId }) => {
  // State for dynamic subscription data
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [upcomingPlans, setUpcomingPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ref to prevent duplicate API calls
  const isSubmittingRef = useRef(false);

  // Fetch subscription data on mount
  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch current subscription
      const subData = await getMySubscription();
      setCurrentSubscription(subData);

      // Fetch upcoming plans
      const upcomingData = await getUpcomingOrders();
      setUpcomingPlans(upcomingData || []);
    } catch (err) {
      console.error('Error fetching subscription data:', err);
      // Don't set error - just means user has no subscription
      setCurrentSubscription(null);
      setUpcomingPlans([]);
    } finally {
      setLoading(false);
    }
  };

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('MONTHLY');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Cash');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  // Plan details
  const plans = [
    { id: 'WEEKLY', name: 'Weekly', price: 560, days: 7 },
    { id: 'MONTHLY', name: 'Monthly', price: 2000, days: 30 },
  ];

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle payment method selection
  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
  };

  // Handle confirm and subscribe button click
  const handleConfirmSubscribe = async () => {
    // Immediately disable button to prevent double-clicks
    setIsProcessing(true);
    
    if (selectedPaymentMethod === 'UPI') {
      // Show QR code modal for UPI payment
      setShowQRCode(true);
    } else {
      // For Cash, call order API directly
      await createOrder('Cash');
    }
  };

  // Create order API call
  const createOrder = async (paymentMethod) => {
    // Prevent duplicate API calls using ref
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    
    setIsProcessing(true);
    setIsExtending(true);
    try {
      const selectedVendorId = vendorId;
      
      if (!selectedVendorId) {
        throw new Error('No vendor available. Please try again later or contact support.');
      }

      const response = await extendSubscriptionOrder(selectedPlan, selectedVendorId, paymentMethod);

      // Success - close modals and show success
      setShowPaymentModal(false);
      setShowQRCode(false);
      setShowSuccessModal(true);

      // Show success toast
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

      // Refresh the subscription data to show the new upcoming plan
      await fetchSubscriptionData();

      // Call the callback to update parent state
      if (onSubscriptionActivated) {
        onSubscriptionActivated(response);
      }
      
      // Also call the existing onExtendSubscription for backward compatibility
      // if (onExtendSubscription) {
      //   onExtendSubscription(selectedPlan, paymentMethod);
      // }

    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create subscription: ' + error.message);
    } finally {
      setIsProcessing(false);
      setIsExtending(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle QR code payment confirmed
  const handleQRPaymentConfirm = async () => {
    setShowQRCode(false);
    // Call order API with UPI payment
    await createOrder('UPI');
  };

  // Close all modals
  const closeAllModals = () => {
    setShowPaymentModal(false);
    setShowQRCode(false);
    setShowSuccessModal(false);
  };

  // Check if confirm button should be disabled
  const isConfirmDisabled = isProcessing || !selectedPlan || !selectedPaymentMethod;

  // Loading state
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
        
        {/* Show Extend Subscription button always when user has an active or trial plan */}
        {currentSubscription && currentSubscription.status === 'active' && (
          <button className="btn-primary extend-btn" onClick={() => { setIsExtending(true); setShowPaymentModal(true); }} disabled={isExtending}>
            {isExtending ? 'Processing...' : 'Extend Subscription'}
          </button>
        )}
        {/* Show Subscribe Now button only when user has no active plan */}
        {!currentSubscription && (
          <button className="btn-primary extend-btn" onClick={() => { setIsExtending(true); setShowPaymentModal(true); }} disabled={isExtending}>
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
        <div className="subscribe-modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="subscribe-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button className="subscribe-modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
            
            {/* Header */}
            <div className="subscribe-modal-header">
              <h2 className="subscribe-modal-title">Subscribe Now</h2>
              <p className="subscribe-modal-subtitle">Choose a plan that works best for you</p>
            </div>
            
            {/* Plan Selection */}
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

            {/* Payment Method Selection */}
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

            {/* Order Summary */}
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

            {/* Button Row */}
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

      {/* UPI QR Code Modal */}
      {showQRCode && (
        <div className="subscribe-modal-overlay" onClick={() => { setShowQRCode(false); setIsProcessing(false); }}>
          <div className="subscribe-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="subscribe-modal-close" onClick={() => { setShowQRCode(false); setIsProcessing(false); }}>×</button>
            <div className="subscribe-modal-header">
              <h2 className="subscribe-modal-title">Scan to Pay</h2>
              <p className="subscribe-modal-subtitle">Amount: ₹{selectedPlanDetails?.price}</p>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=mealsetu@okhdfcbank&pn=MealSetu&am=${selectedPlanDetails?.price}&cu=INR&tn=Subscription Payment`)}`}
                alt="UPI QR Code" 
                style={{ width: '200px', height: '200px', borderRadius: '8px' }}
              />
            </div>
            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '20px' }}>
              Scan the QR code using any UPI app to pay ₹{selectedPlanDetails?.price}
            </p>
            <div className="subscribe-modal-button-row">
              <button className="btn-cancel" onClick={() => { setShowQRCode(false); setIsProcessing(false); }}>
                Cancel
              </button>
              <button 
                className={`btn-confirm-subscribe ${isProcessing ? 'disabled' : ''}`}
                onClick={handleQRPaymentConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : "I've Paid"}
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
              <h2 className="subscribe-modal-title" style={{ marginBottom: '10px' }}>Payment Successful!</h2>
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
                onClick={closeAllModals}
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

