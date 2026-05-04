import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../components/dashboard/admin/AdminSidebar';
import VendorManagement from '../components/dashboard/admin/VendorManagement';
import UserManagement from '../components/dashboard/admin/UserManagement';
import Reports from '../components/dashboard/admin/Reports';
import AdminProfile from '../components/dashboard/admin/AdminProfile';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('requests');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) {
      navigate('/login');
      return;
    }
    try {
      const userData = JSON.parse(user);
      if (userData.role !== 'admin') {
        navigate('/');
      }
    } catch (e) {
      navigate('/login');
    }
  }, [navigate]);

  const handleTabChange = (tab) => {
    console.log('Tab changed to:', tab);
    setActiveTab(tab);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const renderContent = () => {
    console.log('Rendering tab:', activeTab);
    switch (activeTab) {
      case 'requests':
        return <VendorManagement />;
      case 'users':
        return <UserManagement />;
      case 'commission':
        return <Reports />;
      case 'profile':
        return <AdminProfile />;
      default:
        return <VendorManagement />;
    }
  };

return (
  <div className="admin-dashboard">

    {/* Mobile Topbar */}
    <div className="admin-topbar">
      <span className="admin-topbar-brand">MealSetu Admin</span>
      <button
        className="admin-hamburger"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>

    {/* Backdrop */}
    <div
      className={`admin-backdrop ${sidebarOpen ? 'show' : ''}`}
      onClick={() => setSidebarOpen(false)}
    />

    {/* Sidebar */}
    <AdminSidebar
      activeTab={activeTab}
      onTabChange={(tab) => { handleTabChange(tab); setSidebarOpen(false); }}
      onLogout={handleLogout}
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    />

    <div className="admin-content">
      {renderContent()}
    </div>

  </div>
);
}