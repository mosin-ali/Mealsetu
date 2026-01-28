import React, { useState } from 'react';
import AdminSidebar from "../components/dashboard/admin/AdminSidebar";
import VendorRequests from '../components/dashboard/admin/VendorRequests';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('requests');

  const vendors = [
    { id: 1, name: 'Annapurna Kitchen', fssai: '12456789012345' }
  ];

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleLogout = () => {
    window.location.href = '/login';
  };

  const handleApprove = (vendorId) => {
    alert(`Vendor ${vendorId} approved!`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'requests':
        return <VendorRequests vendors={vendors} onApprove={handleApprove} />;
      case 'users':
        return <div>User Management - Coming Soon</div>;
      case 'commission':
        return <div>Commission Setup - Coming Soon</div>;
      default:
        return <VendorRequests vendors={vendors} onApprove={handleApprove} />;
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />
      <main className="admin-main">
        {renderContent()}
      </main>
    </div>
  );
}
