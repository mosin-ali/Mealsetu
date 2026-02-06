import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import './AdminProfile.css';

const AdminProfile = () => {
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    gender: 'male',
    profileImage: null
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load admin data on mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setProfileData(prev => ({
        ...prev,
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        profileImage: userData.profilePic || null
      }));
    }
  }, []);

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileData(prev => ({
          ...prev,
          profileImage: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));

      const response = await fetch(`/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          gender: profileData.gender
        })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage('Error updating profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match!');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long!');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));

      const response = await fetch(`/api/users/${user._id}/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        setMessage('Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await response.json();
        setMessage(error.message || 'Failed to change password');
      }
    } catch (err) {
      console.error('Error changing password:', err);
      setMessage('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-profile">
      <div className="header">
        <h1>Admin Profile</h1>
        <span>System Online</span>
      </div>

      {message && (
        <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="profile-container">
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={20} /> Profile Information
          </button>
          <button 
            className={`tab-btn ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            <Lock size={20} /> Change Password
          </button>
        </div>

        {activeTab === 'profile' && (
          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <div className="profile-picture-section">
              <label htmlFor="profilePic" className="profile-pic-label">
                {profileData.profileImage ? (
                  <img src={profileData.profileImage} alt="Profile" />
                ) : (
                  <div className="placeholder">
                    <Camera size={40} />
                  </div>
                )}
              </label>
              <input 
                id="profilePic" 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload} 
                hidden 
              />
              <p>Click to upload profile photo</p>
            </div>

            <div className="form-group">
              <label>
                <User size={18} /> Full Name
              </label>
              <input 
                type="text" 
                value={profileData.name}
                onChange={(e) => handleProfileChange('name', e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label>
                <Mail size={18} /> Email Address
              </label>
              <input 
                type="email" 
                value={profileData.email}
                disabled
                placeholder="Your email"
              />
              <small>Email cannot be changed</small>
            </div>

            <div className="form-group">
              <label>
                <Phone size={18} /> Phone Number
              </label>
              <input 
                type="tel" 
                value={profileData.phone}
                onChange={(e) => handleProfileChange('phone', e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select 
                value={profileData.gender}
                onChange={(e) => handleProfileChange('gender', e.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {activeTab === 'password' && (
          <form className="password-form" onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label>
                <Lock size={18} /> Current Password
              </label>
              <div className="password-input-wrapper">
                <input 
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPasswords(prev => ({...prev, current: !prev.current}))}
                >
                  {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>
                <Lock size={18} /> New Password
              </label>
              <div className="password-input-wrapper">
                <input 
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPasswords(prev => ({...prev, new: !prev.new}))}
                >
                  {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>
                <Lock size={18} /> Confirm New Password
              </label>
              <div className="password-input-wrapper">
                <input 
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPasswords(prev => ({...prev, confirm: !prev.confirm}))}
                >
                  {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminProfile;
