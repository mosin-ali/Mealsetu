import React, { useState, useEffect } from 'react';
import './OrderMeals.css';
import './OrderMealsFlow.css';
import { getVendorWeeklyPlan, getVendorStatus, getUserVendorRating, createTrialOrder } from '../../../utils/api';


const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const OrderMeals = ({ tiffins, user, hasActivePlan, onOrder, onViewReviews, onWriteReview }) => {
  const userTrialHistory = user?.trialHistory || [];
  
  const hasUsedTrial = (vendorId) => {
    return userTrialHistory.some(trial => 
      trial.vendorId && trial.vendorId.toString() === vendorId.toString()
    );
  };
  
  const [selectedTiffin, setSelectedTiffin] = useState(null);
  const [orderStep, setOrderStep] = useState(0);
  const [orderData, setOrderData] = useState({ 
    plan: 'MONTHLY', 
    payment: 'Cash',
    startDate: '',
    altMainSubji: ''
  });
  
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [vendorStatuses, setVendorStatuses] = useState({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [vendorRatings, setVendorRatings] = useState({});
  const [showClosedPopup, setShowClosedPopup] = useState(false);
  const [closedVendorName, setClosedVendorName] = useState('');

  useEffect(() => {
    fetchVendorStatuses();
    fetchVendorRatings();
  }, [tiffins]);

  const fetchVendorStatuses = async () => {
    if (!tiffins || tiffins.length === 0) {
      setLoadingStatuses(false);
      return;
    }
    try {
      const statuses = {};
      await Promise.all(
        tiffins.map(async (tiffin) => {
          const vendorId = tiffin.vendorId || tiffin._id || tiffin.id;
          if (vendorId) {
            try {
              const status = await getVendorStatus(vendorId);
              statuses[vendorId] = status;
            } catch (e) {
              statuses[vendorId] = { isOpen: true };
            }
          }
        })
      );
      setVendorStatuses(statuses);
    } catch (error) {
      console.warn('Failed to fetch vendor statuses:', error);
    } finally {
      setLoadingStatuses(false);
    }
  };

  const fetchVendorRatings = async () => {
    if (!tiffins || tiffins.length === 0) return;
    try {
      const ratings = {};
      await Promise.all(
        tiffins.map(async (tiffin) => {
          const vendorId = tiffin.vendorId || tiffin._id || tiffin.id;
          if (vendorId) {
            try {
              const ratingData = await getUserVendorRating(vendorId);
              ratings[vendorId] = ratingData;
            } catch (e) {
              ratings[vendorId] = { rating: tiffin.rating || 4.5, reviewCount: 0 };
            }
          }
        })
      );
      setVendorRatings(ratings);
    } catch (error) {
      console.warn('Failed to fetch vendor ratings:', error);
    }
  };

  const getVendorRating = (tiffin) => {
    const vendorId = tiffin.vendorId || tiffin._id || tiffin.id;
    const ratingData = vendorRatings[vendorId];
    if (ratingData && ratingData.rating) return ratingData.rating;
    return tiffin.rating || 4.5;
  };

  const getVendorReviewCount = (tiffin) => {
    const vendorId = tiffin.vendorId || tiffin._id || tiffin.id;
    const ratingData = vendorRatings[vendorId];
    if (ratingData && ratingData.reviewCount !== undefined) return ratingData.reviewCount;
    return 0;
  };

  const isVendorOpen = (tiffin) => {
    const vendorId = tiffin.vendorId || tiffin._id || tiffin.id;
    const status = vendorStatuses[vendorId];
    return status ? status.isOpen : true;
  };

  const handleClosedVendorClick = (tiffin, e) => {
    e.preventDefault();
    e.stopPropagation();
    setClosedVendorName(tiffin.name || 'This Kitchen');
    setShowClosedPopup(true);
  };

  const getDayFromDate = (dateString) => {
    if (!dateString) return DAYS_OF_WEEK[new Date().getDay()];
    const date = new Date(dateString);
    return DAYS_OF_WEEK[date.getDay()];
  };

  const startOrder = async (tiffin) => {
    setSelectedTiffin(tiffin);
    setOrderStep(1);
    const today = new Date().toISOString().split('T')[0];
    setOrderData({ plan: 'MONTHLY', payment: 'Cash', startDate: today, altMainSubji: '' });
    await fetchWeeklyMenu(tiffin);
  };

  const fetchWeeklyMenu = async (tiffin) => {
    const vendorId = tiffin.vendorId || tiffin._id || tiffin.id;
    if (!vendorId) return;
    try {
      setMenuLoading(true);
      const data = await getVendorWeeklyPlan(vendorId);
      if (data.weeklyPlan) setWeeklyPlan(data.weeklyPlan);
    } catch (e) {
      setWeeklyPlan(null);
    } finally {
      setMenuLoading(false);
    }
  };

  const getMenuForSelectedDate = () => {
    if (!weeklyPlan || !orderData.startDate) return null;
    const day = getDayFromDate(orderData.startDate);
    return weeklyPlan[day] || null;
  };

  const PLAN_PRICES = { 'ONEDAY': 80, 'WEEKLY': 560, 'MONTHLY': 2000 };

  const getPlanDays = () => {
    switch (orderData.plan) {
      case 'ONEDAY': return 1;
      case 'WEEKLY': return 7;
      case 'MONTHLY': return 30;
      default: return 1;
    }
  };

  const getPlanPrice = () => PLAN_PRICES[orderData.plan] || 80;

  const getPlanName = () => {
    switch (orderData.plan) {
      case 'ONEDAY': return '1 Day';
      case 'WEEKLY': return 'Weekly';
      case 'MONTHLY': return 'Monthly';
      default: return orderData.plan;
    }
  };

  const goBack = () => {
    if (orderStep === 1) {
      setOrderStep(0);
      setSelectedTiffin(null);
      setWeeklyPlan(null);
    } else {
      setOrderStep(orderStep - 1);
    }
  };

  const handlePaymentChange = (payment) => setOrderData({...orderData, payment: payment});

  const handleConfirmClick = () => {
    if (orderData.payment === 'UPI') {
      setShowQRCode(true);
    } else {
      confirmOrder();
    }
  };

  const handleQRPaymentConfirm = () => {
    setShowQRCode(false);
    confirmOrder();
  };

  const confirmOrder = async () => {
    try {
      await onOrder(selectedTiffin, orderData);
      alert("Order Placed Successfully!");
      setOrderStep(0);
      setSelectedTiffin(null);
      setWeeklyPlan(null);
    } catch (error) {
      alert('Failed to place order: ' + error.message);
    }
  };

  const handleTrialClick = async (tiffin, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const vendorId = tiffin.vendorId || tiffin._id || tiffin.id;
    if (!vendorId) {
      alert('Unable to start trial: missing vendor id');
      return;
    }
    
    if (!tiffin.trialEnabled) {
      alert('This vendor does not offer trials');
      return;
    }
    
    if (hasUsedTrial(vendorId)) {
      alert('You have already used a trial for this vendor');
      return;
    }
    
    const confirmTrial = window.confirm(
      tiffin.trialFee > 0 
        ? `Start a 2-day trial for Rs${tiffin.trialFee}?`
        : 'Start a 2-day free trial?'
    );
    
    if (!confirmTrial) return;
    
    try {
      const result = await createTrialOrder(vendorId, 'Cash', 'Regular');
      alert(`Trial Activated!\n\nKitchen: ${result.trialDetails.vendorName}\nStart: ${new Date(result.trialDetails.startDate).toLocaleDateString('en-IN')}\nEnd: ${new Date(result.trialDetails.endDate).toLocaleDateString('en-IN')}\nFee: ${result.trialDetails.isFree ? 'FREE' : 'Rs' + result.trialDetails.trialFee}`);
    } catch (error) {
      alert('Failed to start trial: ' + error.message);
    }
  };

  if (orderStep === 0) {
    return (
      <div className="order-meals-grid">
        {loadingStatuses ? (
          <div style={{ textAlign: 'center', padding: '40px', width: '100%' }}>
            <p>Loading kitchen status...</p>
          </div>
        ) : (
          tiffins.map((t, i) => {
            const vendorId = t.vendorId || t._id || t.id;
            const isOpen = isVendorOpen(t);
            const dynamicRating = getVendorRating(t);
            const reviewCount = getVendorReviewCount(t);
            
            return (
              <div key={i} className={`tiffing-card ${!isOpen ? 'kitchen-closed' : ''}`}>
                <div className="kitchen-image-wrapper">
                  {t.kitchenPoster ? (
                    <img 
                      src={t.kitchenPoster} 
                      alt="Kitchen Banner" 
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        display: 'block',
                        ...(!isOpen ? { filter: 'grayscale(100%) opacity(0.6)' } : {})
                      }}
                      onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=500"; }}
                    />
                  ) : (
                    <img 
                      src="https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=500"
                      alt="Kitchen" 
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        display: 'block',
                        ...(!isOpen ? { filter: 'grayscale(100%) opacity(0.6)' } : {})
                      }}
                    />
                  )}
                  <div className="rating-badge">⭐ {dynamicRating.toFixed(1)}</div>
                  {!isOpen && (
                    <div className="kitchen-closed-overlay">
                      <span className="closed-badge">Kitchen Closed</span>
                    </div>
                  )}
                </div>
                <div className="card-details">
                  <div className="vendor-header">
                    <div>
                      <h3 className="vendor-name">{t.name}</h3>
                      <p className="vendor-type">{t.type}</p>
                    </div>
                    <span className="fssai-pill">FSSAI: {t.fssai}</span>
                  </div>
                  <button className="view-reviews-link" onClick={() => onViewReviews(t)}>
                    View {reviewCount} Reviews
                  </button>
                  <div className="info-grid">
                    <div className="info-item"><span>Days</span><strong>{t.workingDays}</strong></div>
                    <div className="info-item"><span>Timings</span><strong>{t.timings}</strong></div>
                  </div>
                  <div className="price-section">
                    <div className="price-text">₹{t.price} <small>/ meal</small></div>
                    {isOpen ? (
                      <button className="modern-order-btn" onClick={() => startOrder(t)}>Order Now</button>
                    ) : (
                      <button className="modern-order-btn kitchen-closed-btn" onClick={(e) => handleClosedVendorClick(t, e)} disabled>Kitchen Closed</button>
                    )}
                  </div>
                  
                  {t.trialEnabled === true && !hasActivePlan && (
                    <div style={{ marginTop: '10px' }}>
                      {hasUsedTrial(vendorId) ? (
                        <div style={{ 
                          width: '100%', 
                          padding: '10px 12px', 
                          background: '#f3f4f6', 
                          color: '#6b7280', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px', 
                          textAlign: 'center',
                          fontWeight: '600', 
                          fontSize: '13px' 
                        }}>
                          ✓ Trial Already Used
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => handleTrialClick(t, e)} 
                          style={{ 
                            width: '100%', 
                            padding: '10px 12px', 
                            background: !t.trialFee || t.trialFee === 0 ? '#16a34a' : '#f26522',
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px', 
                            cursor: 'pointer', 
                            fontWeight: '600', 
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          {!t.trialFee || t.trialFee === 0 ? (
                            <>2 Day Free Trial</>
                          ) : (
                            <>2 Day Trial - Just Rs {t.trialFee}</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  
                  <button className="write-review-btn-link" onClick={() => onWriteReview(t)}>Write Review</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="order-flow-container">
      <div className="order-header-nav">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h2>Order from {selectedTiffin?.name}</h2>
      </div>

      <div className="step-indicator">
        <div className={`step ${orderStep >= 1 ? 'active' : ''}`}> Plan</div>
        <div className={`step ${orderStep >= 2 ? 'active' : ''}`}>Menu</div>
        <div className={`step ${orderStep >= 3 ? 'active' : ''}`}>Payment</div>
      </div>

      {orderStep === 1 && (
        <div className="step-content">
          <h3>Select Your Plan</h3>
          <div className="plan-grid">
            {['ONEDAY', 'WEEKLY', 'MONTHLY'].map(plan => (
              <div key={plan} className={`plan-card ${orderData.plan === plan ? 'selected' : ''}`} onClick={() => setOrderData({...orderData, plan})}>
                <strong>{plan === 'ONEDAY' ? '1 Day' : plan === 'WEEKLY' ? 'Weekly' : 'Monthly'}</strong>
                <span>₹{PLAN_PRICES[plan]}</span>
              </div>
            ))}
          </div>
          <label className="input-label">START DATE</label>
          <input type="date" className="date-input" value={orderData.startDate} onChange={(e) => setOrderData({...orderData, startDate: e.target.value})} min={new Date().toISOString().split('T')[0]} />
          <button className="primary-order-btn" onClick={() => setOrderStep(2)} disabled={!orderData.startDate}>Next: View Menu</button>
        </div>
      )}

      {orderStep === 2 && (
        <div className="step-content">
          <h3>Weekly Menu</h3>
          {menuLoading ? <p>Loading menu...</p> : weeklyPlan ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {DAYS_OF_WEEK.map(day => (
                  weeklyPlan[day] && (weeklyPlan[day].mainCourse || weeklyPlan[day].sides) ? (
                    <div key={day} style={{ background: day === getDayFromDate(orderData.startDate) ? '#fef3c7' : '#f8fafc', padding: '10px', borderRadius: '8px', border: day === getDayFromDate(orderData.startDate) ? '2px solid #f59e0b' : '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: '12px', color: '#2b3674' }}>{day}</strong>
                      <p style={{ fontSize: '11px', margin: '5px 0 0 0', color: '#555' }}>{weeklyPlan[day].mainCourse || 'N/A'}</p>
                    </div>
                  ) : null
                ))}
              </div>
              <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '2px solid #f26522', marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#f26522' }}>Menu for {getDayFromDate(orderData.startDate)} ({orderData.startDate})</h4>
                {getMenuForSelectedDate() ? (
                  <>
                    <div style={{ marginBottom: '8px' }}><strong>Main Course:</strong><p style={{ margin: '3px 0 0 0', color: '#555' }}>{getMenuForSelectedDate().mainCourse || 'Not specified'}</p></div>
                    {getMenuForSelectedDate().altSabji && <div style={{ marginBottom: '8px' }}><strong>Alternatives:</strong><p style={{ margin: '3px 0 0 0', color: '#555' }}>{getMenuForSelectedDate().altSabji}</p></div>}
                    <div style={{ marginBottom: '8px' }}><strong>Sides:</strong><p style={{ margin: '3px 0 0 0', color: '#555' }}>{getMenuForSelectedDate().sides || 'Not specified'}</p></div>
                    <div><strong>Special Add-ons:</strong><p style={{ margin: '3px 0 0 0', color: '#555' }}>{getMenuForSelectedDate().specialAddOns || 'Not specified'}</p></div>
                  </>
                ) : <p style={{ color: '#888' }}>Menu not set for this day</p>}
              </div>
            </>
          ) : <p>Vendor hasn't set their weekly menu yet.</p>}
          
          <label className="input-label">ALTER MAIN SUBJI</label>
          <select className="form-input" value={orderData.altMainSubji} onChange={(e) => setOrderData({...orderData, altMainSubji: e.target.value})}>
            <option value="">Use Default Menu</option>
            {getMenuForSelectedDate()?.mainCourse && <option value={getMenuForSelectedDate().mainCourse}>{getMenuForSelectedDate().mainCourse} (Default)</option>}
            {getMenuForSelectedDate()?.altSabji && <option value={getMenuForSelectedDate().altSabji}>{getMenuForSelectedDate().altSabji} (Alt)</option>}
          </select>
          <button className="primary-order-btn" onClick={() => setOrderStep(3)}>Next: Final Payment</button>
        </div>
      )}

      {orderStep === 3 && (
        <div className="step-content">
          <h3>Payment Method</h3>
          <div className="payment-options">
            <label className={`pay-option ${orderData.payment === 'Cash' ? 'active' : ''}`}>
              <input type="radio" name="pay" checked={orderData.payment === 'Cash'} onChange={() => handlePaymentChange('Cash')} />💵 Cash
            </label>
            <label className={`pay-option ${orderData.payment === 'UPI' ? 'active' : ''}`}>
              <input type="radio" name="pay" checked={orderData.payment === 'UPI'} onChange={() => handlePaymentChange('UPI')} />📱 UPI
            </label>
          </div>
          <div className="order-summary">
            <h4>Order Summary</h4>
            <p><strong>Plan:</strong> {getPlanName()}</p>
            <p><strong>Duration:</strong> {getPlanDays()} days</p>
            <p><strong>Start Date:</strong> {orderData.startDate} ({getDayFromDate(orderData.startDate)})</p>
            <p><strong>Meal Type:</strong> {orderData.altMainSubji || 'Default Menu'}</p>
            <p><strong>Payment:</strong> {orderData.payment}</p>
          </div>
          <div className="total-box">Total Payable: ₹{getPlanPrice()}</div>
          <button className="primary-order-btn" onClick={handleConfirmClick}>{orderData.payment === 'UPI' ? 'Show QR Code' : 'Confirm & Pay'}</button>
        </div>
      )}

      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Scan to Pay</h2>
            <div className="qr-code-container">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=mealsetu@okhdfcbank&pn=MealSetu&am=${getPlanPrice()}&cu=INR&tn=Order Payment`)}`} alt="UPI QR Code" className="qr-code" />
            </div>
            <p className="qr-amount">Amount: ₹{getPlanPrice()}</p>
            <p className="qr-instruction">Scan the QR code using any UPI app to pay</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowQRCode(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleQRPaymentConfirm}>I've Paid</button>
            </div>
          </div>
        </div>
      )}

      {showClosedPopup && (
        <div className="modal-overlay" onClick={() => setShowClosedPopup(false)}>
          <div className="closed-kitchen-popup" onClick={(e) => e.stopPropagation()}>
            <div className="closed-icon">🏠</div>
            <h2>Kitchen Temporarily Closed</h2>
            <p>We're sorry, but <strong>{closedVendorName}</strong> is currently closed for orders.</p>
            <div className="closed-info">
              <p>📧 You will be notified via email when the kitchen reopens.</p>
              <p>⏰ Your subscription will be automatically extended to compensate for this downtime.</p>
            </div>
            <p className="closed-apology">We apologize for any inconvenience caused!</p>
            <button className="btn-primary" onClick={() => setShowClosedPopup(false)}>Understood</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderMeals;
