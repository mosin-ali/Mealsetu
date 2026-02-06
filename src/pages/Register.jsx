import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Register.css'; 

export default function Register() {
  const [role, setRole] = useState('user');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicFile, setProfilePicFile] = useState(null);
  
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
    kitchenAddress: '',
    adminKey: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result);
      reader.readAsDataURL(file);
      setProfilePicFile(file);
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

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
        if (docFiles.fssai) data.append('fssaiDoc', docFiles.fssai);
        if (docFiles.gst) data.append('gstDoc', docFiles.gst);
      }

      // Admin specific fields
      if (role === 'admin') {
        data.append('adminKey', formData.adminKey);
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        body: data, // Don't set Content-Type header; browser will set it with boundary
      });

      const responseData = await response.json();

      if (response.ok) {
        // Store token and user data
        localStorage.setItem('token', responseData.token);
        localStorage.setItem('user', JSON.stringify(responseData));

        alert('Registration Successful!');
        
        // Navigate to appropriate dashboard
        if (role === 'admin') navigate('/admin-dashboard');
        else if (role === 'vendor') navigate('/vendor-dashboard');
        else navigate('/user-dashboard');
      } else {
        setError(responseData.message || 'Registration failed. Please try again.');
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
            <input id="regImage" type="file" accept="image/*" onChange={handleImageChange} hidden />
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

          {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}

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
              />
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
              />
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
                  />
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
                  />
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
                  />
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
                  />
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
                  />
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

            {/* --- ADMIN FIELDS --- */}
            {role === 'admin' && (
              <div className="input-field full-width">
                <label>Security Access Key</label>
                <input 
                  type="password" 
                  placeholder="System Admin Key" 
                  required 
                  name="adminKey"
                  value={formData.adminKey}
                  onChange={handleInputChange}
                />
              </div>
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
              />
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
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : `Create ${role} Account`}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}