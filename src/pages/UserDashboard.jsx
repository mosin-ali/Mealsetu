import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UserDashboard() {
  const navigate = useNavigate();

  // 1. INITIALIZE STATE
  const [user, setUser] = useState({
    name: localStorage.getItem('userName') || "Mosin Ali",
    email: localStorage.getItem('userEmail') || "mosin@example.com",
    phone: localStorage.getItem('userPhone') || "9876543210", // Added Phone to state
    address: "Himatnagar, Gujarat",
    pincode: "383001",
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
  // const [showProfileModal, setShowProfileModal] = useState(false);
  // const [showPasswordModal, setShowPasswordModal] = useState(false);
  // const [showReviewModal, setShowReviewModal] = useState(false);
  // const [showAllReviewsModal, setShowAllReviewsModal] = useState(false);
  // const [forgotStep, setForgotStep] = useState('login'); 
  // const [otpInput, setOtpInput] = useState('');
  // const [generatedOtp, setGeneratedOtp] = useState('');

  
// MODAL & OTP STATES
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAllReviewsModal, setShowAllReviewsModal] = useState(false);
  
  // IMPLEMENTED FORGOT PASSWORD STATES
  const [forgotStep, setForgotStep] = useState('login'); 
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [newPass, setNewPass] = useState('');

  
  

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

  const handleSaveProfile = () => {
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userPhone', user.phone);
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

  // --- FORGOT PASSWORD NEW FUNCTIONS ---
  const sendEmailOtp = () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    alert(`OTP sent to ${user.email}: ${otp}`); // Simulating Email send
    setForgotStep('otp');
  };

  const verifyOtp = () => {
    if(otpInput === generatedOtp) {
        setForgotStep('create');
    } else {
        alert("Invalid OTP! Please check again.");
    }
  };

  const finalizeNewPassword = () => {
    if(newPass.length < 6) {
        alert("Password too short!");
        return;
    }
    alert("Password updated successfully via Email OTP!");
    setShowPasswordModal(false);
    setForgotStep('login');
    setNewPass('');
    setOtpInput('');
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

  const submitReview = () => {
    alert(`Review for ${selectedVendor.name} submitted!`);
    setShowReviewModal(false);
    setUserComment("");
  };

  const handleExtendSubscription = () => {
    alert("Redirecting to payment gateway...");
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* --- SIDEBAR --- */}
      <aside style={sidebarStyle}>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2 style={{ color: '#f26522', fontWeight: '800', marginBottom: '30px' }}>MealSetu</h2>
          <div style={{ marginBottom: '30px' }}>
            <img src={user.profilePic} style={sidebarAvatarStyle} alt="User" />
            <h4 style={{ margin: '10px 0 5px 0' }}>{user.name}</h4>
            <button style={editProfileLinkStyle} onClick={() => setShowProfileModal(true)}>Edit Profile</button>
          </div>
        </div>
        <nav style={sidebarNavStyle}>
          <button style={activeTab === 'services' ? sidebarActiveTab : sidebarTab} onClick={() => setActiveTab('services')}>🍱 Order Meals</button>
          <button style={activeTab === 'subscription' ? sidebarActiveTab : sidebarTab} onClick={() => setActiveTab('subscription')}>⏳ Subscription</button>
          <button style={activeTab === 'history' ? sidebarActiveTab : sidebarTab} onClick={() => setActiveTab('history')}>📜 History</button>
          <button style={activeTab === 'offers' ? sidebarActiveTab : sidebarTab} onClick={() => setActiveTab('offers')}>🎁 Offers</button>
          <button style={activeTab === 'safety' ? sidebarActiveTab : sidebarTab} onClick={() => setActiveTab('safety')}>🛡️ Safety</button>
          <div style={{ marginTop: 'auto', paddingBottom: '20px' }}>
            <button style={sidebarLogoutBtn} onClick={handleLogout}>Logout</button>
          </div>
        </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        
        <div style={welcomeCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
             <img src={user.profilePic} style={bigAvatarStyle} alt="Profile" />
             <div>
                <h1 style={{ margin: 0, fontSize: '24px' }}>Welcome, {user.name}!</h1>
                <p style={{ color: '#64748b', margin: '5px 0' }}>{user.email} | {user.address}</p>
             </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleAutoLocation}>📍 Detect Location</button>
            <button className="tag" style={securityBtnStyle} onClick={() => { setForgotStep('login'); setShowPasswordModal(true); }}>Security Settings</button>
            
          </div>
        </div>

        {activeTab === 'services' && (
          <div style={gridStyle}>
            {tiffins.map((t, i) => (
              <div key={i} className="card" style={cardStyle}>
                <div style={fssaiBadgeStyle}>FSSAI: {t.fssai}</div>
                <div style={{ fontSize: '40px' }}>🍱</div>
                <h3>{t.name}</h3>
                <p style={{ color: '#64748b' }}>{t.type} • ⭐ {t.rating}</p>
                <button 
                   style={{ background: 'none', border: 'none', color: '#f26522', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', marginBottom: '10px' }}
                   onClick={() => { setSelectedVendor(t); setShowAllReviewsModal(true); }}
                >
                  View {t.reviews.length} Reviews
                </button>
                <div style={{ margin: '10px 0', fontSize: '12px', color: '#475569', background: '#f1f5f9', padding: '8px', borderRadius: '8px' }}>
                  <div>📅 {t.workingDays}</div>
                  <div>⏰ {t.timings}</div>
                </div>
                <h4 style={{ color: '#f26522' }}>₹{t.price} / meal</h4>
                <button className="btn-primary" style={{ width: '100%', marginBottom: '10px' }} onClick={() => navigate('/order')}>Order Now</button>
                <button onClick={() => { setSelectedVendor(t); setShowReviewModal(true); }} style={writeReviewBtnStyle}>Write Review</button>
              </div>
            ))}
          </div>
        )}

        {/* ... Other Tabs remain same ... */}
        {activeTab === 'subscription' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={contentCardStyle}>
              <h3>Meal Plan Status</h3>
              <div style={{ background: '#fff3ed', padding: '20px', borderRadius: '15px', border: '1px solid #f26522' }}>
                <p style={{ color: '#64748b', marginBottom: '5px' }}>Subscription Valid Until</p>
                <h2 style={{ margin: 0, color: '#f26522' }}>{user.expiryDate}</h2>
              </div>
              <button className="btn-primary" style={{ marginTop: '15px', width: '100%' }} onClick={handleExtendSubscription}>🚀 Extend Subscription</button>
            </div>
            <div style={contentCardStyle}>
              <h3>Schedule Leave / Pause</h3>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" style={inputStyle} value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>End Date</label>
                  <input type="date" style={inputStyle} value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
                </div>
              </div>
              <label style={labelStyle}>Which Meal to Skip?</label>
              <select style={inputStyle} value={mealType} onChange={(e) => setMealType(e.target.value)}>
                <option value="both">Both (Lunch & Dinner)</option>
                <option value="lunch">Lunch Only</option>
                <option value="dinner">Dinner Only</option>
              </select>
              <button className="btn-primary" style={{ width: '100%', background: '#334155' }} onClick={handleApplyLeave}>⏸️ Apply Leave & Extend Plan</button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div style={contentCardStyle}>
            <h3>Payment History</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '10px' }}>ID</th>
                  <th style={{ padding: '10px' }}>Date</th>
                  <th style={{ padding: '10px' }}>Amount</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px' }}>{h.id}</td>
                    <td style={{ padding: '10px' }}>{h.date}</td>
                    <td style={{ padding: '10px' }}>₹{h.amount}</td>
                    <td style={{ padding: '10px', color: '#16a34a' }}>{h.status}</td>
                    <td style={{ padding: '10px' }}>
                      <button 
                        style={{ background: '#f26522', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                        onClick={() => handleDownloadInvoice(h)}
                      >
                        📥 Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'offers' && (
          <div style={gridStyle}>
            {offersList.map((offer, idx) => (
              <div key={idx} style={{ ...contentCardStyle, borderLeft: `6px solid ${offer.color}`, position: 'relative' }}>
                <span style={{ 
                  position: 'absolute', top: '15px', right: '15px', 
                  fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase',
                  background: offer.color, color: 'white', padding: '2px 8px', borderRadius: '5px' 
                }}>{offer.tag}</span>
                <h2 style={{ color: offer.color, margin: '0 0 10px 0' }}>{offer.code}</h2>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>{offer.desc}</p>
                <button 
                  className="btn-primary" 
                  style={{ background: offer.color, width: 'auto', padding: '8px 20px', fontSize: '13px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(offer.code);
                    alert(`Promo code ${offer.code} copied to clipboard!`);
                  }}
                >
                  📋 Copy Code
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'safety' && (
          <div style={contentCardStyle}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🛡️ Safety & Hygiene Protocols</h3>
            <p style={{ color: '#64748b' }}>Your health is our priority. MealSetu ensures all vendors follow strict safety standards.</p>
            <div style={{ marginTop: '20px' }}>
              <div style={{ padding: '15px', background: '#f0fdf4', borderRadius: '12px', marginBottom: '10px', border: '1px solid #16a34a' }}>
                <strong style={{ color: '#16a34a' }}>✓ FSSAI Verified Kitchens</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>Every tiffin provider on our platform is licensed by the Food Safety and Standards Authority of India.</p>
              </div>
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '12px', marginBottom: '10px', border: '1px solid #e2e8f0' }}>
                <strong>✓ Daily Sanitization</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>Kitchens are cleaned and sanitized twice daily to ensure a germ-free environment.</p>
              </div>
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong>✓ Temperature Checks</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>Delivery staff and kitchen members undergo regular temperature screenings.</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- MODALS --- */}
      
      {/* UPDATED EDIT PROFILE MODAL */}
      {showProfileModal && (
        <div style={modalOverlayStyle}>
          <div style={{...modalContentStyle, maxWidth: '450px'}}>
            <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Edit Profile</h3>
            
            {/* Profile Picture Upload Display */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img src={user.profilePic} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f26522', marginBottom: '10px' }} alt="Avatar Preview" />
              <label style={{ display: 'block', fontSize: '12px', color: '#f26522', cursor: 'pointer', fontWeight: 'bold' }}>
                Change Photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              </label>
            </div>

            <label style={labelStyle}>Full Name</label>
            <input type="text" style={inputStyle} value={user.name} onChange={(e) => setUser({...user, name: e.target.value})} placeholder="Enter Full Name" />
            
            <label style={labelStyle}>Email Address</label>
            <input type="email" style={inputStyle} value={user.email} onChange={(e) => setUser({...user, email: e.target.value})} placeholder="Enter Email" />

            <label style={labelStyle}>Phone Number</label>
            <input type="tel" style={inputStyle} value={user.phone} onChange={(e) => setUser({...user, phone: e.target.value})} placeholder="Enter Phone Number" />

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveProfile}>Save Changes</button>
              <button className="tag" style={{ flex: 1, border: '1px solid #ddd' }} onClick={() => setShowProfileModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* OTHER MODALS ... */}
      {showAllReviewsModal && (
        <div style={modalOverlayStyle}>
          <div style={{...modalContentStyle, maxWidth: '500px'}}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Reviews for {selectedVendor?.name}</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '10px 0' }}>
              {selectedVendor?.reviews.map((rev, idx) => (
                <div key={idx} style={{ marginBottom: '15px', padding: '10px', background: '#f8fafc', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold' }}>{rev.user}</span>
                    <span style={{ color: '#f26522' }}>{"⭐".repeat(rev.stars)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>{rev.comment}</p>
                </div>
              ))}
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={() => setShowAllReviewsModal(false)}>Close Reviews</button>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Review {selectedVendor?.name}</h3>
            <label style={labelStyle}>Rating</label>
            <select style={inputStyle} value={userRating} onChange={(e) => setUserRating(e.target.value)}>
              <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
              <option value="4">⭐⭐⭐⭐ Good</option>
              <option value="3">⭐⭐⭐ Average</option>
            </select>
            <textarea style={{...inputStyle, height: '80px'}} value={userComment} onChange={(e) => setUserComment(e.target.value)} placeholder="Share your experience..." />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" style={{ flex: 2 }} onClick={submitReview}>Submit</button>
              <button className="tag" style={{ flex: 1 }} onClick={() => setShowReviewModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* {showPasswordModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Security Settings</h3>
            <input type="password" style={inputStyle} placeholder="Current Password" />
            <input type="password" style={inputStyle} placeholder="New Password" />
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowPasswordModal(false)}>Update</button>
            <button className="tag" style={{ width: '100%', marginTop: '10px' }} onClick={() => setShowPasswordModal(false)}>Close</button>
          </div>
        </div>
      )} */}
  {/* UPDATED SECURITY MODAL WITH FORGOT PASSWORD IMPLEMENTATION */}
      {showPasswordModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{textAlign: 'center', marginBottom: '15px'}}>Security Settings</h3>
            
            {forgotStep === 'login' && (
                <>
                    <input type="password" style={inputStyle} placeholder="Current Password" />
                    <input type="password" style={inputStyle} placeholder="New Password" />
                    <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowPasswordModal(false)}>Update</button>
                    <button 
                        style={{background:'none', border:'none', color:'#f26522', cursor:'pointer', display:'block', margin:'10px auto', fontSize:'13px', textDecoration:'underline'}}
                        onClick={sendEmailOtp}
                    >
                        Forgot Password? (Email OTP)
                    </button>
                </>
            )}

            {forgotStep === 'otp' && (
                <>
                    <p style={{fontSize:'13px', textAlign:'center'}}>Enter OTP sent to {user.email}</p>
                    <input type="text" style={{...inputStyle, textAlign:'center', letterSpacing:'5px'}} maxLength="4" value={otpInput} onChange={(e)=>setOtpInput(e.target.value)} placeholder="0000" />
                    <button className="btn-primary" style={{ width: '100%' }} onClick={verifyOtp}>Verify OTP</button>
                </>
            )}

            {forgotStep === 'create' && (
                <>
                    <p style={{fontSize:'13px', textAlign:'center'}}>Create New Password</p>
                    <input type="password" style={inputStyle} value={newPass} onChange={(e)=>setNewPass(e.target.value)} placeholder="New Password" />
                    <button className="btn-primary" style={{ width: '100%', background:'#16a34a' }} onClick={finalizeNewPassword}>Save New Password</button>
                </>
            )}

            <button className="tag" style={{ width: '100%', marginTop: '10px' }} onClick={() => {setShowPasswordModal(false); setForgotStep('login');}}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
}

// --- CSS-IN-JS STYLES ---
const sidebarStyle = { width: '260px', background: 'white', height: '100vh', boxShadow: '2px 0 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0 };
const sidebarAvatarStyle = { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f26522' };
const editProfileLinkStyle = { background: 'none', border: 'none', color: '#f26522', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', textDecoration: 'underline' };
const sidebarNavStyle = { display: 'flex', flexDirection: 'column', padding: '0 15px', flex: 1 };
const sidebarTab = { padding: '12px 20px', margin: '5px 0', border: 'none', background: 'none', textAlign: 'left', color: '#64748b', cursor: 'pointer', fontWeight: '600', borderRadius: '10px', fontSize: '15px' };
const sidebarActiveTab = { ...sidebarTab, background: '#fff3ed', color: '#f26522' };
const sidebarLogoutBtn = { padding: '12px 20px', width: '100%', border: 'none', background: '#334155', color: 'white', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' };
const bigAvatarStyle = { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f26522' };
const welcomeCardStyle = { background: 'white', padding: '25px', borderRadius: '20px', marginBottom: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eef2f6' };
const securityBtnStyle = { border: '1px solid #cbd5e1', cursor: 'pointer', background: 'white', padding: '5px 15px', borderRadius: '8px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' };
const cardStyle = { background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', textAlign: 'center', border: '1px solid #f1f5f9', position: 'relative' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 };
const modalContentStyle = { background: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' };
const inputStyle = { width: '100%', padding: '12px', margin: '8px 0 15px 0', border: '1px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' };
const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block' };
const contentCardStyle = { background: 'white', padding: '25px', borderRadius: '20px', border: '1px solid #eef2f6', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const fssaiBadgeStyle = { background: '#f0fdf4', color: '#16a34a', borderBottom: '1px solid #16a34a', padding: '5px', fontWeight: 'bold', fontSize: '10px', marginBottom: '10px' };
const writeReviewBtnStyle = { background: 'none', border: 'none', color: '#f26522', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' };
