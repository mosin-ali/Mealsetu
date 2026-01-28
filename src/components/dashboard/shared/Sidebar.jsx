import React from 'react';
import './Sidebar.css';

const Sidebar = ({ menuItems, activeTab, onTabChange, onLogout, userInfo }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">MealSetu</h2>
        {userInfo && (
          <div className="sidebar-profile">
            <img src={userInfo.profilePic} className="sidebar-avatar" alt="User" />
            <h4>{userInfo.name}</h4>
            <button className="edit-profile-link" onClick={userInfo.onEditProfile}>Edit Profile</button>
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={`sidebar-tab ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => onTabChange(item.key)}
          >
            {item.label}
          </button>
        ))}
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={onLogout}>Logout</button>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
