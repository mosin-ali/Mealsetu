import React, { useState, useRef } from 'react'; // Added useRef
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [role, setRole] = useState('user');
  const [showForgot, setShowForgot] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Refs for OTP auto-focus
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  const handleLogin = (e) => {
    e.preventDefault();
    if (role === 'admin') navigate('/admin-dashboard');
    else if (role === 'vendor') navigate('/vendor-dashboard');
    else navigate('/user-dashboard');
  };

  // Logic to move cursor to next box
  const handleOtpChange = (e, index) => {
    if (e.target.value.length > 0 && index < 3) {
      otpRefs[index + 1].current.focus();
    }
  };

  return (
    <div className={`page-center ${role === 'admin' ? 'admin-mode' : ''}`}>
      <div className="auth-card">
        <h1 className="brand-name">MealSetu</h1>
        <p className="auth-subtitle">
          {role === 'admin' ? 'Admin Portal Access' : 'Welcome back! Please login.'}
        </p>

        <div className="role-container">
          <button className={`role-tab ${role === 'user' ? 'active' : ''}`} onClick={() => setRole('user')}>Customer</button>
          <button className={`role-tab ${role === 'vendor' ? 'active' : ''}`} onClick={() => setRole('vendor')}>Vendor</button>
          <button className={`role-tab ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>Admin</button>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input type="email" className="form-input" placeholder="e.g. user@gmail.com" required />
          </div>
          
          <div className="input-group">
            <label className="input-label">Password</label>
            <input type="password" className="form-input" placeholder="••••••••" required />
            
            {/* Moved Forgot Password below the field */}
            {role !== 'admin' && (
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <span 
                  onClick={() => {setShowForgot(true); setStep(1);}} 
                  className="forgot-link-text"
                >
                  Forgot Password?
                </span>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary">
            {role === 'admin' ? 'Authorize Login' : 'Sign In'}
          </button>
        </form>

        <p className="footer-signup-text">
          New to MealSetu? <Link to="/register">Create Account</Link>
        </p>
      </div>

      {/* --- FORGOT PASSWORD MODAL --- */}
      {showForgot && (
        <div className="modal-overlay">
          <div className="forgot-modal">
            <button className="close-modal" onClick={() => setShowForgot(false)}>&times;</button>
            <h2 className="modal-title">Reset Password</h2>
            <p className="modal-desc">
              {step === 1 && "Enter your email to receive an OTP."}
              {step === 2 && "Enter the 4-digit code sent to your email."}
              {step === 3 && "Create a strong new password."}
            </p>

            {step === 1 && (
              <div className="modal-form">
                <input type="email" className="form-input" placeholder="Enter registered email" />
                <button className="btn-primary" onClick={() => setStep(2)}>Send OTP</button>
              </div>
            )}

            {step === 2 && (
              <div className="modal-form">
                <div className="otp-container">
                  {[0, 1, 2, 3].map((index) => (
                    <input 
                      key={index}
                      ref={otpRefs[index]}
                      type="text" 
                      maxLength="1" 
                      className="otp-input" 
                      onChange={(e) => handleOtpChange(e, index)}
                    />
                  ))}
                </div>
                <button className="btn-primary" onClick={() => setStep(3)}>Verify OTP</button>
                <p className="resend-text">Didn't get code? <span>Resend</span></p>
              </div>
            )}

            {step === 3 && (
              <div className="modal-form">
                <input type="password" className="form-input" placeholder="New Password" style={{marginBottom: '10px'}} />
                <input type="password" className="form-input" placeholder="Confirm New Password" />
                <button className="btn-primary" onClick={() => setShowForgot(false)}>Update Password</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}