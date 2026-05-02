import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { verifyRegisterOTP, resendRegisterOTP } from '../utils/api';
import './Register.css';

export default function Register() {
  const [role, setRole] = useState('user');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicFile, setProfilePicFile] = useState(null);
  
  // State for Kitchen Poster/Banner (for vendors)
  const [kitchenPoster, setKitchenPoster] = useState(null);
  const [kitchenPosterFile, setKitchenPosterFile] = useState(null);
  
  // State for Vendor Documents
  const [docs, setDocs] = useState({ fssai: '', gst: '' });
  const [docFiles, setDocFiles] = useState({ fssai: null, gst: null });
  
// Form data state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    pincode: '',
    address: '',
    kitchenName: '',
    kitchenAddress: ''
  });

  // Errors state for form validation
  const [errors, setErrors] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // OTP Verification Modal States
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpUserId, setOtpUserId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Refs for OTP inputs
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Countdown timer effect
  useEffect(() => {
    if (showOTPModal && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [showOTPModal, countdown]);

  // Handle OTP input change
  const handleOtpChange = (e, index) => {
    const value = e.target.value;
    
    if (value.length <= 1) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      
      // Auto-focus next input
      if (value && index < 5) {
        otpRefs[index + 1].current.focus();
      }

      // Auto-verify when all 6 digits are filled
      const otpValue = newOtp.join('');
      if (otpValue.length === 6) {
        handleVerifyOTP(otpValue);
      }
    }
  };

  const handleOtpKeyDown = (e, index) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

// Verify OTP
  const handleVerifyOTP = async (otpValue) => {
    if (!otpValue || otpValue.length !== 6) return;
    
    setOtpLoading(true);
    setOtpError('');

    try {
      const data = await verifyRegisterOTP(otpUserId, otpValue);
      
      // Close modal
      setShowOTPModal(false);
      
      // Show success message and redirect to login page
      alert('Email verified successfully! Please login with your credentials.');
      navigate('/login');
    } catch (err) {
      setOtpError(err.message || 'Invalid OTP. Please try again.');
      // Shake animation
      setOtp(['', '', '', '', '', '']);
      otpRefs[0].current.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setOtpLoading(true);
    setOtpError('');

    try {
      const data = await resendRegisterOTP(otpUserId);
      setMaskedEmail(data.maskedEmail);
      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      otpRefs[0].current.focus();
    } catch (err) {
      setOtpError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result);
      reader.readAsDataURL(file);
      setProfilePicFile(file);
    }
  };

  // Handle kitchen poster change
  const handleKitchenPosterChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setKitchenPoster(reader.result);
      reader.readAsDataURL(file);
      setKitchenPosterFile(file);
    }
  };

  const handleDocChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setDocs(prev => ({ ...prev, [type]: file.name }));
      setDocFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Create new errors object
    const newErrors = {};

    // Full Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Please enter your full name with at least 2 characters.';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Please enter your full name with at least 2 characters.';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.name.trim())) {
      newErrors.name = 'Please enter your full name with at least 2 characters.';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Please enter a valid email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    // Phone Number validation (for user and vendor roles)
    if (role === 'user' || role === 'vendor') {
      if (!formData.phone) {
        newErrors.phone = 'Please enter a valid 10 digit Indian mobile number starting with 6, 7, 8, or 9.';
      } else if (!/^[6-9]\d{9}$/.test(formData.phone)) {
        newErrors.phone = 'Please enter a valid 10 digit Indian mobile number starting with 6, 7, 8, or 9.';
      }
    }

    // Pincode validation (for user and vendor roles)
    if (role === 'user' || role === 'vendor') {
      if (!formData.pincode) {
        newErrors.pincode = 'Please enter a valid 6 digit pincode.';
      } else if (!/^\d{6}$/.test(formData.pincode)) {
        newErrors.pincode = 'Please enter a valid 6 digit pincode.';
      }
    }

    // Delivery Address validation (for user role)
    if (role === 'user') {
      if (!formData.address.trim()) {
        newErrors.address = 'Please enter your complete delivery address with at least 10 characters.';
      } else if (formData.address.trim().length < 10) {
        newErrors.address = 'Please enter your complete delivery address with at least 10 characters.';
      }
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#!!%^&*()]).{8,}$/.test(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.';
    }

    // Confirm Password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match. Please re-enter your password.';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match. Please re-enter your password.';
    }

    // Set errors and return if any validation failed
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // Vendor document validation (only for vendor role)
    if (role === 'vendor' && (!docFiles.fssai || !docFiles.gst)) {
      setError('Please upload required documents for vendor registration');
      return;
    }

    try {
      setLoading(true);

      // Create FormData for multipart/form-data
      const data = new FormData();
      
      // Common fields
      data.append('name', formData.name);
      data.append('email', formData.email);
      data.append('password', formData.password);
      data.append('role', role);

      // Profile pic
      if (profilePicFile) {
        data.append('profilePic', profilePicFile);
      }

      // Kitchen poster (for vendors)
      if (kitchenPosterFile) {
        data.append('kitchenPoster', kitchenPosterFile);
      }

      // User specific fields
      if (role === 'user') {
        data.append('phone', formData.phone);
        data.append('pincode', formData.pincode);
        data.append('address', formData.address);
      }

// Vendor specific fields
      if (role === 'vendor') {
        data.append('kitchenName', formData.kitchenName);
        data.append('kitchenAddress', formData.kitchenAddress);
        data.append('pincode', formData.pincode);
        data.append('phone', formData.phone);
        if (docFiles.fssai) data.append('fssaiDoc', docFiles.fssai);
        if (docFiles.gst) data.append('gstDoc', docFiles.gst);

      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        body: data, // Don't set Content-Type header; browser will set it with boundary
      });

      const responseData = await response.json();

      if (response.ok) {
        // Check if OTP verification is required
        if (responseData.requiresOTPVerification) {
          // Show OTP modal
          setOtpUserId(responseData.userId);
          setMaskedEmail(responseData.maskedEmail);
          setShowOTPModal(true);
          setCountdown(60);
          setCanResend(false);
          setOtp(['', '', '', '', '', '']);
          // Focus first OTP input after modal shows
          setTimeout(() => otpRefs[0].current?.focus(), 100);
          setLoading(false);
          return;
        }

        // The backend now returns full URLs for profilePic
        // We need to ensure the full URL is stored in localStorage
        
        // Get the profilePic from response (should already be full URL from backend)
        const storedUser = {
          _id: responseData._id,
          name: responseData.name,
          email: responseData.email,
          role: responseData.role,
          profilePic: responseData.profilePic || null,
          // Include kitchenPoster for vendors (if returned from backend)
          ...(role === 'vendor' && { kitchenPoster: responseData.kitchenPoster || null }),
          token: responseData.token
        };

        // Store token and user data
        localStorage.setItem('token', responseData.token);
        localStorage.setItem('user', JSON.stringify(storedUser));

        alert('Registration Successful!');
        
        // Check for trial intent and navigate accordingly
        const trialIntent = localStorage.getItem('trialIntent');
        
// Navigate to appropriate dashboard
        if (role === 'vendor') navigate('/vendor-dashboard');
        else {
          if (trialIntent === 'true') {
            // Clear trial intent and navigate to subscription tab
            localStorage.removeItem('trialIntent');
            navigate('/user-dashboard', { state: { activeTab: 'subscription' } });
          } else {
            navigate('/user-dashboard');
          }
        }
      } else {
        // Check if this is a disposable/temporary email error
        const errorMessage = responseData.message || 'Registration failed. Please try again.';
        
        if (errorMessage.toLowerCase().includes('disposable') || 
            errorMessage.toLowerCase().includes('temporary')) {
          // Show error under email field
          setErrors(prev => ({ ...prev, email: errorMessage }));
        } else {
          // Show general error
          setError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Registration Error:', err);
      setError('Unable to connect to the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

return (
    <div className="auth-container">
      <div className="modern-register-card flex flex-col md:flex-row">
        
        {/* Left Side: Brand & Image */}
        <div className="auth-sidebar w-full md:w-[35%] h-auto md:h-full">
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
            <input id="regImage" type="file" accept="image/*" onChange={handleImageChange} hidden />
          </div>

          <div className="auth-footer-text">
            Already have an account? <Link to="/login">Login</Link>
          </div>
        </div>

        {/* Right Side: Scroll-enabled Form Content */}
        <div className="auth-form-content w-full md:w-[65%]">
          <div className="role-selector">
<button className={role === 'user' ? 'active' : ''} onClick={() => setRole('user')}>Customer</button>
            <button className={role === 'vendor' ? 'active' : ''} onClick={() => setRole('vendor')}>Vendor</button>
          </div>

          {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}

          {/* Error Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="form-error-summary">
              Please fix the errors below before submitting.
            </div>
          )}

          <form className="grid-form" onSubmit={handleSubmit}>
            {/* Common Fields */}
            <div className="input-field">
              <label>Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe" 
                required 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? 'input-error' : (formData.name ? 'input-valid' : '')}
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div className="input-field">
              <label>Email Address</label>
              <input 
                type="email" 
                placeholder="john@example.com" 
                required 
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? 'input-error' : (formData.email ? 'input-valid' : '')}
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

            {/* --- CUSTOMER FIELDS --- */}
            {role === 'user' && (
              <>
                <div className="input-field">
                  <label>Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="9876543210" 
                    required 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={errors.phone ? 'input-error' : (formData.phone ? 'input-valid' : '')}
                  />
                  {errors.phone && <p className="field-error">{errors.phone}</p>}
                </div>
                <div className="input-field">
                  <label>Pincode</label>
                  <input 
                    type="text" 
                    placeholder="383001" 
                    required 
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    className={errors.pincode ? 'input-error' : (formData.pincode ? 'input-valid' : '')}
                  />
                  {errors.pincode && <p className="field-error">{errors.pincode}</p>}
                </div>
                <div className="input-field full-width">
                  <label>Delivery Address</label>
                  <input 
                    type="text" 
                    placeholder="House No, Building, Area" 
                    required 
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className={errors.address ? 'input-error' : (formData.address ? 'input-valid' : '')}
                  />
                  {errors.address && <p className="field-error">{errors.address}</p>}
                </div>
              </>
            )}

            {/* --- VENDOR FIELDS --- */}
            {role === 'vendor' && (
              <>
                <div className="input-field full-width">
                  <label>Kitchen Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Annapurna Kitchen" 
                    required 
                    name="kitchenName"
                    value={formData.kitchenName}
                    onChange={handleInputChange}
                    className={formData.kitchenName ? 'input-valid' : ''}
                  />
                </div>
                <div className="input-field">
                  <label>Kitchen Address</label>
                  <input 
                    type="text" 
                    placeholder="Full Location" 
                    required 
                    name="kitchenAddress"
                    value={formData.kitchenAddress}
                    onChange={handleInputChange}
                    className={formData.kitchenAddress ? 'input-valid' : ''}
                  />
                </div>
                <div className="input-field">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    required
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={errors.phone ? 'input-error' : (formData.phone ? 'input-valid' : '')}
                  />
                  {errors.phone && <p className="field-error">{errors.phone}</p>}
                </div>
                <div className="input-field">

                  <label>Pincode</label>
                  <input 
                    type="text" 
                    placeholder="6-digit Pincode" 
                    required 
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    className={errors.pincode ? 'input-error' : (formData.pincode ? 'input-valid' : '')}
                  />
                  {errors.pincode && <p className="field-error">{errors.pincode}</p>}
                </div>
                
                {/* Kitchen Poster/Banner Upload */}
                <div className="input-field full-width">
                  <label>Kitchen Banner/Poster Image</label>
                  <div className="file-input-wrapper">
                    <input type="file" id="kitchenPoster" onChange={handleKitchenPosterChange} hidden accept="image/*" />
                    <label htmlFor="kitchenPoster" className="file-label" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {kitchenPoster ? (
                        <img src={kitchenPoster} alt="Kitchen Poster Preview" style={{ width: '100px', height: '60px', objectFit: 'cover', borderRadius: '5px' }} />
                      ) : (
                        "Choose Kitchen Banner Image"
                      )}
                    </label>
                  </div>
                  <small style={{ color: '#666', fontSize: '11px' }}>This image will be displayed in the user dashboard as your kitchen's visual identity</small>
                </div>
                
                {/* Document Uploads */}
                <div className="input-field">
                  <label>FSSAI License Document</label>
                  <div className="file-input-wrapper">
                    <input type="file" id="fssaiDoc" onChange={(e) => handleDocChange(e, 'fssai')} hidden required accept=".pdf,.jpg,.jpeg,.png" />
                    <label htmlFor="fssaiDoc" className="file-label">
                      {docs.fssai ? docs.fssai : "Choose File"}
                    </label>
                  </div>
                </div>
                <div className="input-field">
                  <label>GST Document</label>
                  <div className="file-input-wrapper">
                    <input type="file" id="gstDoc" onChange={(e) => handleDocChange(e, 'gst')} hidden required accept=".pdf,.jpg,.jpeg,.png" />
                    <label htmlFor="gstDoc" className="file-label">
                      {docs.gst ? docs.gst : "Choose File"}
                    </label>
                  </div>
                </div>
              </>
            )}

{/* Passwords */}
            <div className="input-field">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={errors.password ? 'input-error' : (formData.password ? 'input-valid' : '')}
              />
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>
            <div className="input-field">
              <label>Confirm Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={errors.confirmPassword ? 'input-error' : (formData.confirmPassword ? 'input-valid' : '')}
              />
              {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : `Create ${role} Account`}
            </button>
          </form>
        </div>

      </div>

      {/* OTP Verification Modal */}
      {showOTPModal && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            <h2 className="otp-modal-title">Verify Your Email Address</h2>
            <p className="otp-modal-desc">
              We sent a 6 digit OTP to <strong style={{ color: '#f26522' }}>{maskedEmail}</strong>
            </p>

            {otpError && (
              <div className="otp-error-message">
                {otpError}
              </div>
            )}

            <div className="otp-inputs-container">
              {otp.map((digit, index) => (
                <input 
                  key={index}
                  ref={otpRefs[index]}
                  type="text"
                  maxLength="1"
                  className="otp-input-box"
                  value={digit}
                  onChange={(e) => handleOtpChange(e, index)}
                  onKeyDown={(e) => handleOtpKeyDown(e, index)}
                  disabled={otpLoading}
                />
              ))}
            </div>

            <div className="otp-countdown">
              {countdown > 0 ? (
                <span>Resend OTP in {countdown} seconds</span>
              ) : (
                <button 
                  type="button" 
                  className="otp-resend-btn" 
                  onClick={handleResendOTP}
                  disabled={otpLoading}
                >
                  {otpLoading ? 'Sending...' : 'Resend OTP'}
                </button>
              )}
            </div>

            <button 
              type="button" 
              className="otp-verify-btn" 
              onClick={() => handleVerifyOTP(otp.join(''))}
              disabled={otpLoading || otp.join('').length !== 6}
            >
              {otpLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
