import React from 'react';
import './DashboardOverview.css';

const DashboardOverview = ({ profile, revenue, ordersToday, activeUsers, pendingPayout, preparationList, kitchenStatus, onToggleKitchen }) => {
  return (
    <div className="dashboard-overview">
      <div className="profile-card">
        <div className="profile-image">
          {profile.image ? <img src={profile.image} alt="Kitchen" /> : '🍳'}
        </div>
        <div>
          <h2>{profile.kitchenName}</h2>
          <p>{profile.address}</p>
        </div>
      </div>

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
        <div className="stat-card">
          <p>Pending Payout</p>
          <h2 style={{ color: '#f26522' }}>₹{pendingPayout}</h2>
        </div>
      </div>

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
            <div className="status-emoji">{kitchenStatus.isOpen ? '👨‍🍳' : '💤'}</div>
            <p className="status-text">{kitchenStatus.isOpen ? 'Kitchen is Live' : 'Kitchen is Resting'}</p>
            <p className="status-subtext">{kitchenStatus.isOpen ? 'Accepting new trial orders.' : 'Not accepting new orders.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
