import React, { useState } from 'react';
import './OrderMeals.css';

const OrderMeals = ({ tiffins, onOrder, onViewReviews, onWriteReview }) => {
  const [selectedTiffin, setSelectedTiffin] = useState(null);
  const [orderStep, setOrderStep] = useState(0); // 0: List, 1: Plan, 2: Menu, 3: Payment
  const [orderData, setOrderData] = useState({ plan: 'MONTHLY', payment: 'Cash' });

  // Function to enter the ordering flow
  const startOrder = (tiffin) => {
    setSelectedTiffin(tiffin);
    setOrderStep(1);
  };

  // Reset to list
  const goBack = () => {
    if (orderStep === 1) setOrderStep(0);
    else setOrderStep(orderStep - 1);
  };

  // ---------------- VIEW 1: TIFFIN GRID ----------------
  if (orderStep === 0) {
    return (
      <div className="order-meals-grid">
        {tiffins.map((t, i) => (
          <div key={i} className="tiffing-card">
            <div className="kitchen-image-wrapper">
              <img 
                src={t.name === "Annapurna Kitchen" 
                  ? "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500" 
                  : "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=500"} 
                alt="Kitchen" 
              />
              <div className="rating-badge">⭐ {t.rating}</div>
              {/* NEW: View Image Button */}
              <button className="view-img-overlay" onClick={() => window.open(t.image || "https://images.unsplash.com/photo-1556910103-1c02745aae4d", "_blank")}>
                View Kitchen
              </button>
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
                View {t.reviews.length} Reviews
              </button>

              <div className="info-grid">
                <div className="info-item"><span>Days</span><strong>{t.workingDays}</strong></div>
                <div className="info-item"><span>Timings</span><strong>{t.timings}</strong></div>
              </div>

              <div className="price-section">
                <div className="price-text">₹{t.price} <small>/ meal</small></div>
                <button className="modern-order-btn" onClick={() => startOrder(t)}>
                  Order Now
                </button>
              </div>

              <button className="write-review-btn-link" onClick={() => onWriteReview(t)}>
                Write Review
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---------------- VIEW 2: MULTI-STEP ORDER FLOW ----------------
  return (
    <div className="order-flow-container">
      <div className="order-header-nav">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h2>Order from {selectedTiffin.name}</h2>
      </div>

      <div className="step-indicator">
        <div className={`step ${orderStep >= 1 ? 'active' : ''}`}>1. Plan</div>
        <div className={`step ${orderStep >= 2 ? 'active' : ''}`}>2. Menu</div>
        <div className={`step ${orderStep >= 3 ? 'active' : ''}`}>3. Payment</div>
      </div>

      {/* Step 1: Select Plan */}
      {orderStep === 1 && (
        <div className="step-content">
          <h3>Select Your Plan</h3>
          <div className="plan-grid">
            {['ONEDAY', 'WEEKLY', 'MONTHLY'].map(p => (
              <div 
                key={p} 
                className={`plan-card ${orderData.plan === p ? 'selected' : ''}`}
                onClick={() => setOrderData({...orderData, plan: p})}
              >
                <strong>{p}</strong>
                <span>₹{p === 'MONTHLY' ? selectedTiffin.price * 25 : selectedTiffin.price}</span>
              </div>
            ))}
          </div>
          <label className="input-label">START DATE</label>
          <input type="date" className="date-input" />
          <button className="primary-order-btn" onClick={() => setOrderStep(2)}>Next: View Menu</button>
        </div>
      )}

      {/* Step 2: Menu Preview */}
      {orderStep === 2 && (
        <div className="step-content">
          <h3>Today's Menu</h3>
          <ul className="menu-list">
            <li>• Aloo Gobhi</li>
            <li>• Dal Fry</li>
            <li>• Jeera Rice</li>
            <li>• 3 Rotis</li>
            <li>• Salad</li>
          </ul>
          <label className="input-label">ALTER MAIN SUBJI</label>
          <select className="form-input">
            <option>Aloo Gobhi</option>
            <option>Paneer Masala</option>
          </select>
          <button className="primary-order-btn" onClick={() => setOrderStep(3)}>Next: Final Payment</button>
        </div>
      )}

      {/* Step 3: Payment (Restricted to Cash/UPI) */}
      {orderStep === 3 && (
        <div className="step-content">
          <h3>Payment Method</h3>
          <div className="payment-options">
            <label className={`pay-option ${orderData.payment === 'Cash' ? 'active' : ''}`}>
              <input type="radio" name="pay" checked={orderData.payment === 'Cash'} onChange={() => setOrderData({...orderData, payment: 'Cash'})} />
              💵 Cash
            </label>
            <label className={`pay-option ${orderData.payment === 'UPI' ? 'active' : ''}`}>
              <input type="radio" name="pay" checked={orderData.payment === 'UPI'} onChange={() => setOrderData({...orderData, payment: 'UPI'})} />
              📱 UPI
            </label>
          </div>
          <div className="total-box">Total Payable: ₹2000</div>
          <button className="primary-order-btn" onClick={() => { 
            alert("Order Placed Successfully!"); 
            setOrderStep(0); 
          }}>
            Confirm & Pay
          </button>
        </div>
      )}
    </div>
  );
};

export default OrderMeals;