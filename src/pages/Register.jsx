import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
<<<<<<< HEAD
  const [role, setRole] = useState('user'); 
  const [profilePic, setProfilePic] = useState(null); // State for image preview
  const navigate = useNavigate();

  // Function to handle image selection and conversion to preview URL
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // const handleRegister = (e) => {
  //   e.preventDefault();
  //   alert(`Account created successfully as a ${role.toUpperCase()}! Redirecting to Login...`);
  //   navigate('/login');
  // };

  const handleRegister = (e) => {
  e.preventDefault();
  
  // Save the profile picture to localStorage so Dashboard can read it
  if (profilePic) {
    localStorage.setItem('userAvatar', profilePic);
  }
  localStorage.setItem('userName', e.target[0].value); // Saves the name input

  alert(`Account created successfully as a ${role.toUpperCase()}!`);
  navigate('/login');
};
  return (
=======
  // role can now be 'user', 'vendor', or 'admin'
  const [role, setRole] = useState('user'); 
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    // Static Redirection for MCA Project Demo
    alert(`Account created successfully as a ${role.toUpperCase()}! Redirecting to Login...`);
    navigate('/login');
  };

  return (
    /* Dynamic class 'admin-mode' applied when Admin is selected */
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
    <div className={`page-center ${role === 'admin' ? 'admin-mode' : ''}`}>
      <div className="auth-card">
        <h1 className="brand-name">MealSetu</h1>
        <p className="auth-subtitle">Join the platform as a {role}.</p>

<<<<<<< HEAD
        {/* --- CIRCULAR PROFILE UPLOAD START --- */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <label htmlFor="regImage" style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              border: '3px dashed #f26522',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: '#fffaf8'
            }}>
              {profilePic ? (
                <img src={profilePic} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '30px', color: '#f26522' }}>+</span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#f26522', marginTop: '5px', fontWeight: 'bold' }}>Upload Photo</p>
          </label>
          <input 
            id="regImage" 
            type="file" 
            accept="image/*" 
            onChange={handleImageChange} 
            style={{ display: 'none' }} 
          />
        </div>
        {/* --- CIRCULAR PROFILE UPLOAD END --- */}

        <div className="role-container">
          <button className={`role-tab ${role === 'user' ? 'active' : ''}`} onClick={() => setRole('user')}>Customer</button>
          <button className={`role-tab ${role === 'vendor' ? 'active' : ''}`} onClick={() => setRole('vendor')}>Vendor</button>
          <button className={`role-tab ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>Admin</button>
=======
        {/* Updated Role Selection Toggle with 3 Roles */}
        <div className="role-container">
          <button 
            className={`role-tab ${role === 'user' ? 'active' : ''}`} 
            onClick={() => setRole('user')}
          >
            Customer
          </button>
          <button 
            className={`role-tab ${role === 'vendor' ? 'active' : ''}`} 
            onClick={() => setRole('vendor')}
          >
            Vendor
          </button>
          <button 
            className={`role-tab ${role === 'admin' ? 'active' : ''}`} 
            onClick={() => setRole('admin')}
          >
            Admin
          </button>
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
        </div>

        <form onSubmit={handleRegister}>
          <div className="input-group">
<<<<<<< HEAD
            <label className="input-label">{role === 'vendor' ? 'Kitchen / Business Name' : 'Full Name'}</label>
=======
            <label className="input-label">
              {role === 'vendor' ? 'Kitchen / Business Name' : 'Full Name'}
            </label>
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
            <input type="text" className="form-input" placeholder="Enter name" required />
          </div>

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input type="email" className="form-input" placeholder="name@example.com" required />
          </div>

<<<<<<< HEAD
=======
          {/* Conditional Field for Vendors */}
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
          {role === 'vendor' && (
            <div className="input-group">
              <label className="input-label">FSSAI License Number</label>
              <input type="text" className="form-input" placeholder="14-digit license no." required />
            </div>
          )}

<<<<<<< HEAD
=======
          {/* Conditional Field for Admin (Security Key) */}
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
          {role === 'admin' && (
            <div className="input-group">
              <label className="input-label">Security Access Key</label>
              <input type="password" className="form-input" placeholder="Enter System Admin Key" required />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Password</label>
            <input type="password" className="form-input" placeholder="Create a password" required />
          </div>

          <button type="submit" className="btn-primary">
            Register {role === 'admin' ? 'System Admin' : 'Account'}
          </button>
<<<<<<< HEAD
=======

           
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
        </form>

        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
          Already have an account? {' '}
<<<<<<< HEAD
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>Login here</Link>
=======
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>
            Login here
          </Link>
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
        </p>
      </div>
    </div>
  );
}