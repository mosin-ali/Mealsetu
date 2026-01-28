import React from 'react';
import './AdminSidebar.css';

const AdminSidebar = ({ activeTab, onTabChange, onLogout }) => {
  const menuItems = [
    { key: 'requests', label: 'Vendor Requests' },
    { key: 'users', label: 'User Management' },
    { key: 'commission', label: 'Commission Setup' }
  ];

  return (
    <aside className="admin-sidebar">
      <h2 className="admin-title">MealSetu Admin</h2>
      <nav className="admin-nav">
        {menuItems.map((item) => (
          <div
            key={item.key}
            className={`admin-nav-item ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => onTabChange(item.key)}
          >
            {item.label}
          </div>
        ))}
      </nav>
      <div className="admin-logout" onClick={onLogout}>
        Logout
      </div>
    </aside>
  );
};

export default AdminSidebar;
