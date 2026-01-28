import React from 'react';
import { CheckCircle, Users, DollarSign, User, LogOut } from 'lucide-react';
import './AdminSidebar.css';

const AdminSidebar = ({ activeTab, onTabChange, onLogout }) => {
  const menuItems = [
    { key: 'requests', label: 'Vendor Requests', icon: CheckCircle },
    { key: 'users', label: 'User Management', icon: Users },
    { key: 'commission', label: 'Commission Setup', icon: DollarSign },
    { key: 'profile', label: 'Admin Profile', icon: User }
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
            <item.icon size={20} className="nav-icon" />
            {item.label}
          </div>
        ))}
      </nav>
      <div className="admin-logout" onClick={onLogout}>
        <LogOut size={20} className="nav-icon" />
        Logout
      </div>
    </aside>
  );
};

export default AdminSidebar;
