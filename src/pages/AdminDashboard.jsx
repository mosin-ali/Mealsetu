import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from "../components/dashboard/admin/AdminSidebar";
import VendorManagement from '../components/dashboard/admin/VendorManagement';
import UserManagement from '../components/dashboard/admin/UserManagement';
import Reports from '../components/dashboard/admin/Reports';
import AdminProfile from '../components/dashboard/admin/AdminProfile';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('requests');
  const [loading, setLoading] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const navigate = useNavigate();

  // Verify admin is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      navigate('/login');
      return;
    }

    const userData = JSON.parse(user);
    if (userData.role !== 'admin') {
      navigate('/');
      return;
    }

    setAdminData(userData);
  }, [navigate]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!adminData) {
    return <div>Loading...</div>;
  }

  const renderContent = () => {
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
      <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />
      <div className="admin-content">
        {renderContent()}
      </div>
    </div>
  );
}
