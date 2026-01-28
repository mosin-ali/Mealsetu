import React from 'react';
import './WelcomeCard.css';

const WelcomeCard = ({ user, onDetectLocation, onSecuritySettings }) => {
  return (
    <div className="welcome-card">
      <div className="welcome-content">
        <img src={user.profilePic} className="welcome-avatar" alt="Profile" />
        <div className="welcome-text">
          <h1>Welcome, {user.name}!</h1>
          <p>{user.email} | {user.address}</p>
        </div>
      </div>
      <div className="welcome-actions">
        <button className="btn-primary detect-btn" onClick={onDetectLocation}>Detect Location</button>
        <button className="security-btn" onClick={onSecuritySettings}>Security Settings</button>
      </div>
    </div>
  );
};

export default WelcomeCard;
