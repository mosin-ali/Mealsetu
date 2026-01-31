import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Register.css'; 

export default function Register() {
  const [role, setRole] = useState('user');
  const [profilePic, setProfilePic] = useState(null);
  
  // State for Vendor Document filenames
  const [docs, setDocs] = useState({ fssai: '', gst: '' });
  
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Handle Document selection text
  const handleDocChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setDocs(prev => ({ ...prev, [type]: file.name }));
    }
  };

  return (
    <div className="auth-container">
      <div className="modern-register-card">
        
        {/* Left Side: Brand & Image */}
        <div className="auth-sidebar">
          <div className="brand-header">
            <h1>MealSetu</h1>
            <p>Your daily meal partner</p>
          </div>
          
          <div className="profile-upload-section">
            <label htmlFor="regImage" className="circular-upload">
              {profilePic ? (
                <img src={profilePic} alt="Preview" />
              ) : (
                <div className="upload-placeholder">
                  <span>+</span>
                </div>
              )}
            </label>
            <p>Upload Profile Photo</p>
            <input id="regImage" type="file" onChange={handleImageChange} hidden />
          </div>

          <div className="auth-footer-text">
            Already have an account? <Link to="/login">Login</Link>
          </div>
        </div>

        {/* Right Side: Scroll-enabled Form Content */}
        <div className="auth-form-content">
          <div className="role-selector">
            <button className={role === 'user' ? 'active' : ''} onClick={() => setRole('user')}>Customer</button>
            <button className={role === 'vendor' ? 'active' : ''} onClick={() => setRole('vendor')}>Vendor</button>
            <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>Admin</button>
          </div>

          <form className="grid-form">
            {/* Common Fields */}
            <div className="input-field">
              <label>Full Name</label>
              <input type="text" placeholder="John Doe" required />
            </div>
            <div className="input-field">
              <label>Email Address</label>
              <input type="email" placeholder="john@example.com" required />
            </div>

            {/* --- CUSTOMER FIELDS --- */}
            {role === 'user' && (
              <>
                <div className="input-field">
                  <label>Phone Number</label>
                  <input type="tel" placeholder="9876543210" required />
                </div>
                <div className="input-field">
                  <label>Pincode</label>
                  <input type="text" placeholder="383001" required />
                </div>
                <div className="input-field full-width">
                  <label>Delivery Address</label>
                  <input type="text" placeholder="House No, Building, Area" required />
                </div>
              </>
            )}

            {/* --- VENDOR FIELDS (UPDATED) --- */}
            {role === 'vendor' && (
              <>
                <div className="input-field full-width">
                  <label>Kitchen Name</label>
                  <input type="text" placeholder="e.g. Annapurna Kitchen" required />
                </div>
                <div className="input-field">
                  <label>Kitchen Address</label>
                  <input type="text" placeholder="Full Location" required />
                </div>
                <div className="input-field">
                  <label>Pincode</label>
                  <input type="text" placeholder="6-digit Pincode" required />
                </div>
                
                {/* Document Uploads */}
                <div className="input-field">
                  <label>FSSAI License Document</label>
                  <div className="file-input-wrapper">
                    <input type="file" id="fssaiDoc" onChange={(e) => handleDocChange(e, 'fssai')} hidden required />
                    <label htmlFor="fssaiDoc" className="file-label">
                      {docs.fssai ? docs.fssai : "Choose File"}
                    </label>
                  </div>
                </div>
                <div className="input-field">
                  <label>GST Document</label>
                  <div className="file-input-wrapper">
                    <input type="file" id="gstDoc" onChange={(e) => handleDocChange(e, 'gst')} hidden required />
                    <label htmlFor="gstDoc" className="file-label">
                      {docs.gst ? docs.gst : "Choose File"}
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* --- ADMIN FIELDS --- */}
            {role === 'admin' && (
              <div className="input-field full-width">
                <label>Security Access Key</label>
                <input type="password" placeholder="System Admin Key" required />
              </div>
            )}

            {/* Passwords */}
            <div className="input-field">
              <label>Password</label>
              <input type="password" placeholder="••••••••" required />
            </div>
            <div className="input-field">
              <label>Confirm Password</label>
              <input type="password" placeholder="••••••••" required />
            </div>

            <button type="submit" className="submit-btn">Create {role} Account</button>
          </form>
        </div>

      </div>
    </div>
  );
}