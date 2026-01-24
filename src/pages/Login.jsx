import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  // role can now be 'user', 'vendor', or 'admin'
  const [role, setRole] = useState('user');
  const navigate = useNavigate();

 const handleLogin = (e) => {
  e.preventDefault();
  if (role === 'admin') {
    navigate('/admin-dashboard'); // This must match path="/admin-dashboard"
  } else if (role === 'vendor') {
    navigate('/vendor-dashboard');
  } else {
    navigate('/user-dashboard');
  }
};

  return (
    /* We add a dynamic class 'admin-mode' when admin is selected to change the theme */
    <div className={`page-center ${role === 'admin' ? 'admin-mode' : ''}`}>
      <div className="auth-card">
        <h1 className="brand-name">MealSetu</h1>
        <p className="auth-subtitle">
          {role === 'admin' ? 'Admin Portal Access' : 'Welcome back! Please login.'}
        </p>

        {/* Updated Role Container with 3 Options */}
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

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input type="email" className="form-input" placeholder="e.g. user@gmail.com" required />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input type="password" className="form-input" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary">
            {role === 'admin' ? 'Authorize Login' : 'Sign In'}
          </button>
        </form>

        <p style={{marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b'}}>
          New to MealSetu? <Link to="/register" style={{color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none'}}>Create Account</Link>
        </p>
      </div>
    </div>
  );
}