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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
        return;
      }
      setLoading(false);
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #f1f5f9', borderTop: '4px solid #f26522', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading your dashboard...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚙️</div>
          <h2 style={{ color: '#2b3674', margin: '0 0 8px 0', fontSize: '22px' }}>Admin Panel Unavailable</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.6' }}>
            Could not connect to server. Check backend status.
          </p>
          <button
            onClick={() => { setError(''); setLoading(true); window.location.reload(); }}
            style={{ background: '#f26522', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', width: '100%', marginBottom: '12px' }}
          >
            🔄 Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', padding: '10px 28px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', width: '100%' }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

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