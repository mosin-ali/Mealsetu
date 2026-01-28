import React, { useState } from 'react';
import AdminSidebar from "../components/dashboard/admin/AdminSidebar";
import VendorManagement from '../components/dashboard/admin/VendorManagement';
import UserManagement from '../components/dashboard/admin/UserManagement';
import Reports from '../components/dashboard/admin/Reports';
import AdminProfile from '../components/dashboard/admin/AdminProfile';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('requests');

  const [vendors, setVendors] = useState([
    { id: 1, name: 'Annapurna Kitchen', fssai: '12456789012345', status: 'pending' },
    { id: 2, name: 'Tasty Bites', fssai: '98765432109876', status: 'pending' }
  ]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleLogout = () => {
    window.location.href = '/login';
  };

  const handleApprove = (vendorId) => {
    setVendors(vendors.map(vendor =>
      vendor.id === vendorId ? { ...vendor, status: 'approved' } : vendor
    ));
    alert(`Vendor ${vendorId} approved!`);
  };

  const handleReject = (vendorId) => {
    setVendors(vendors.map(vendor =>
      vendor.id === vendorId ? { ...vendor, status: 'rejected' } : vendor
    ));
    alert(`Vendor ${vendorId} rejected!`);
  };

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
    <div className="admin-layout">
      <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />
      <main className="admin-main">
        {renderContent()}
      </main>
    </div>
  );
}
