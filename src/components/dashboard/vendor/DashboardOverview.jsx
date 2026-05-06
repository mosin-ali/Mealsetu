import React, { useState, useEffect } from 'react';
import './DashboardOverview.css';
import { getVendorPendingPayout } from '../../../utils/api';

const DashboardOverview = ({ 
  profile = {}, 
  revenue = 0, 
  ordersToday = 0, 
  activeUsers = 0, 
  pendingPayout = 0, 
  preparationList = { total: 0, regular: 0, jain: 0, veg: 0 },
  kitchenStatus = { isOpen: false },
  onToggleKitchen = () => {},
  onTabChange = () => {}
}) => {
  const [pendingPayoutData, setPendingPayoutData] = useState({ pendingAmount: 0, overdueAmount: 0, pendingCount: 0 });
  useEffect(() => {
    const fetchPendingPayout = async () => {
      try {
        const data = await getVendorPendingPayout();
        setPendingPayoutData(data);
      } catch (error) {
        console.error('Failed to fetch pending payout:', error);
        // Keep default zero values on error
      }
    };

    fetchPendingPayout();
  }, []);

  return (
    <div className="dashboard-overview">

      {/* Overdue Warning Banner */}
      {pendingPayoutData.overdueAmount > 0 && (
        <div className="overdue-banner">
          <span>⚠️ <strong>WARNING:</strong> You have an overdue commission payment of ₹{pendingPayoutData.overdueAmount}. Please pay now to avoid account suspension.</span>
          <button className="overdue-pay-btn" onClick={() => onTabChange('commission')}>
            Pay Now
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-image">
          {profile?.profileImage
            ? <img src={profile.profileImage} alt="Kitchen" />
            : '🍳'}
        </div>
        <div>
          <h2>{profile?.kitchenName || 'Your Kitchen'}</h2>
          <p>{profile?.address || 'Address not set'}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <p>Total Revenue</p>
          <h2>₹{revenue}</h2>
        </div>
        <div className="stat-card">
          <p>Orders Today</p>
          <h2>{ordersToday}</h2>
        </div>
        <div className="stat-card">
          <p>Active Users</p>
          <h2>{activeUsers}</h2>
        </div>
        <div
          className="stat-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onTabChange('commission')}
        >
          <p>Pending Payout</p>
          <h2 style={{ color: '#f26522' }}>
            ₹{pendingPayoutData.pendingAmount.toLocaleString()}
          </h2>
        </div>
      </div>

      {/* Main Grid - Preparation + Kitchen Status */}
      <div className="main-grid">
        <div className="preparation-card">
          <h3>Today's Preparation List</h3>
          <p>Total lunch boxes to pack: {preparationList.total}</p>
          <hr />
          <div className="preparation-item">
            <span>Regular Thali</span>
            <span>{preparationList.regular}</span>
          </div>
          <div className="preparation-item">
            <span>Jain Thali</span>
            <span>{preparationList.jain}</span>
          </div>
          <div className="preparation-item">
            <span>Veg Thali</span>
            <span>{preparationList.veg}</span>
          </div>
        </div>

        <div className="kitchen-status-card">
          <h3>Kitchen Status</h3>
          <div className="status-display">
            <span className="status-emoji">
              {kitchenStatus.isOpen ? '👨‍🍳' : '💤'}
            </span>
            <p className="status-text">
              {kitchenStatus.isOpen ? 'Kitchen is Live' : 'Kitchen is Resting'}
            </p>
            <p className="status-subtext">
              {kitchenStatus.isOpen
                ? 'Accepting new trial orders.'
                : 'Not accepting new orders.'}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardOverview;
