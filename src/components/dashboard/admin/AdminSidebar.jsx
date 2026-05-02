import React from 'react';
import './AdminSidebar.css';

const AdminSidebar = ({ activeTab, onTabChange, onLogout, className = '' }) => {
  const menuItems = [
    { key: 'requests', label: 'Vendor Requests' },
    { key: 'users', label: 'User Management' },
    { key: 'commission', label: 'Commission Setup' },
    { key: 'profile', label: 'Admin Profile' },
  ];

return (
    <aside className={`admin-sidebar ${className}`}>
      <div className="admin-sidebar-logo">MealSetu Admin</div>
      <nav className="admin-nav">
        {menuItems.map((item) => (
          <div
            key={item.key}
            className={`admin-nav-item ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => {
              console.log('Sidebar clicked:', item.key);
              onTabChange(item.key);
            }}
          >
            {item.label}
          </div>
        ))}
      </nav>
      <div className="admin-sidebar-logout" onClick={onLogout}>
        Logout
      </div>
    </aside>
  );
};

export default AdminSidebar;