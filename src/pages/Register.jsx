import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
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
    <div className={`page-center ${role === 'admin' ? 'admin-mode' : ''}`}>
      <div className="auth-card">
        <h1 className="brand-name">MealSetu</h1>
        <p className="auth-subtitle">Join the platform as a {role}.</p>

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
        </div>

        <form onSubmit={handleRegister}>
          <div className="input-group">
            <label className="input-label">
              {role === 'vendor' ? 'Kitchen / Business Name' : 'Full Name'}
            </label>
            <input type="text" className="form-input" placeholder="Enter name" required />
          </div>

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input type="email" className="form-input" placeholder="name@example.com" required />
          </div>

          {/* Conditional Field for Vendors */}
          {role === 'vendor' && (
            <div className="input-group">
              <label className="input-label">FSSAI License Number</label>
              <input type="text" className="form-input" placeholder="14-digit license no." required />
            </div>
          )}

          {/* Conditional Field for Admin (Security Key) */}
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

           
        </form>

        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
          Already have an account? {' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}