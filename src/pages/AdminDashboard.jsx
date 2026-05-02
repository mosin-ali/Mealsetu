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
      {/* Mobile Hamburger Button - only visible on mobile */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg"
        onClick={() => setSidebarOpen(true)}
        style={{ background: '#1e293b', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar - hidden on mobile, fixed when open */}
      <AdminSidebar
        className={`hidden md:block ${sidebarOpen ? 'fixed inset-y-0 left-0 z-50' : ''}`}
        activeTab={activeTab}
        onTabChange={(tab) => { handleTabChange(tab); setSidebarOpen(false); }}
        onLogout={handleLogout}
      />

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="admin-content">
        {renderContent()}
      </div>
    </div>
  );
}