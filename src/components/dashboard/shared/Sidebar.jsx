import React from 'react';
import './Sidebar.css';

const Sidebar = ({ menuItems, activeTab, onTabChange, onLogout, userInfo }) => {
  // Handle missing or empty profile picture with fallback
  const profilePic = userInfo?.profilePic || '';
  const defaultPic = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNlMmU4ZjAiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjU1IiByPSI0MCIgZmlsbD0iI2YzZjVmMiIvPjxwYXRoIGQ9Ik0zNSAxMzBDMzUgMTAyLjM4NCA1Mi4zODQgODAgODAgODBINzBDOTcuNjE2IDgwIDExNSAxMDIuMzg0IDExNSAxMzBWMTUwSDMzek0xMjUgMTUwaC05MG0xMjUgMGgtOTBtLTEyNSAwaC05MCIgZmlsbD0iI2U0ZThmMCIvPjwvc3ZnPg==';
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">MealSetu</h2>
        {userInfo && (
          <div className="sidebar-profile">
            <img 
              src={profilePic || defaultPic} 
              className="sidebar-avatar" 
              alt="User" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = defaultPic;
              }}
            />
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
