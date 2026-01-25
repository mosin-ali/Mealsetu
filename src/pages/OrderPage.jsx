// 1. IMPORT useState HERE
import React, { useState } from 'react'; 
import { useNavigate } from 'react-router-dom';

export default function OrderPage() {
  const navigate = useNavigate();
  
  // 2. Now this line will work perfectly
  const [step, setStep] = useState(1);
  const [planType, setPlanType] = useState('monthly');
  const [startDate, setStartDate] = useState(''); 
  const [preferences, setPreferences] = useState({
    jain: false,
    noGarlic: false,
    alterSabji: false
  });
  const [address, setAddress] = useState({
    area: 'Auto-detecting...',
    pincode: '382010',
    phone: '9876543210'
  });

  // Mock Vendor Data
  const vendor = {
    name: "Annapurna Kitchen",
    fssai: "12345678901234",
    menu: {
      today: ["Paneer Butter Masala", "Dal Fry", "Jeera Rice", "3 Rotis", "Salad"],
      special: "Gulab Jamun"
    }
  };

  const handleAutoLocation = () => {
    alert("Location Detected: Sector 21, Gandhinagar");
    setAddress({ ...address, area: "Sector 21, Gandhinagar" });
  };

  return (
    <div className="page-bg">
      <div className="order-container">
        
        {/* Header */}
        <div className="order-header">
          <button onClick={() => navigate('/user-dashboard')} className="back-btn">← Back</button>
          <h2>Order from {vendor.name}</h2>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Menu</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Plan</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Payment</div>
        </div>

        <div className="order-content">
          
          {/* STEP 1: MENU */}
          {step === 1 && (
            <div className="step-content">
              <h3>Today's Menu</h3>
              <div className="menu-card">
                <ul>{vendor.menu.today.map((item, i) => <li key={i}>{item}</li>)}</ul>
                <div className="special-item">Special: {vendor.menu.special}</div>
              </div>
              <button className="btn-primary full-width" onClick={() => setStep(2)}>Next: Select Plan</button>
            </div>
          )}

          {/* STEP 2: PLAN & DATE */}
          {step === 2 && (
            <div className="step-content">
              <h3>Select Plan</h3>
              <div className="plan-options">
                <button className={`plan-card ${planType === 'monthly' ? 'selected' : ''}`} onClick={() => setPlanType('monthly')}>
                  <h4>Monthly</h4><p>₹2400</p>
                </button>
                <button className={`plan-card ${planType === 'weekly' ? 'selected' : ''}`} onClick={() => setPlanType('weekly')}>
                  <h4>Weekly</h4><p>₹700</p>
                </button>
              </div>

              <div className="input-group">
                <label>Start Date</label>
                {/* 3. This input uses the state */}
                <input 
                  type="date" 
                  className="form-input" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>

              <button className="btn-primary full-width" onClick={() => setStep(3)}>Next: Payment</button>
            </div>
          )}

          {/* STEP 3: PAYMENT */}
          {step === 3 && (
            <div className="step-content">
              <h3>Payment Summary</h3>
              <div className="summary-box">
                <div className="row"><span>Total</span><span>₹2400</span></div>
              </div>
              <button className="btn-primary full-width" onClick={() => alert("Order Placed Successfully!")}>
                Pay Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}