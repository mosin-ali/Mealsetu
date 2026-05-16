import React, { useState, useEffect } from 'react';
import './DashboardOverview.css';
import { apiCall } from '../../../utils/api';
import { onEvent, offEvent } from '../../../utils/socket';

const EMPTY_SLOT = { total: 0, regular: 0, jain: 0 };

const DashboardOverview = ({
  profile = {},
  revenue = 0,
  ordersToday = 0,
  activeUsers = 0,
  kitchenStatus = { isOpen: false },
  onToggleKitchen = () => {},
  onTabChange = () => {}
}) => {
  const [prepList, setPrepList] = useState({ lunch: EMPTY_SLOT, dinner: EMPTY_SLOT, date: '' });
  const [pendingPayoutData, setPendingPayoutData] = useState({ pendingAmount: 0, overdueAmount: 0 });
  const [isDinnerTime, setIsDinnerTime] = useState(new Date().getHours() >= 15);
  const [selectedSlot, setSelectedSlot] = useState(new Date().getHours() >= 15 ? 'dinner' : 'lunch');

  const fetchData = async () => {
    try {
      const [prep, stats] = await Promise.all([
        apiCall('/vendor/preparation-list', { method: 'GET' }),
        apiCall('/vendor/dashboard-stats', { method: 'GET' })
      ]);
      setPrepList({
        lunch: prep.lunch || EMPTY_SLOT,
        dinner: prep.dinner || EMPTY_SLOT,
        date: prep.date || ''
      });
      setPendingPayoutData({
        pendingAmount: stats.pendingPayout || 0,
        overdueAmount: stats.overdueAmount || 0
      });
    } catch (error) {
      console.error('Dashboard overview fetch error:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(dataInterval);
  }, []);

  useEffect(() => {
    const handleNewOrder = () => fetchData();
    onEvent('new_order', handleNewOrder);
    onEvent('newOrder', handleNewOrder);
    return () => {
      offEvent('new_order', handleNewOrder);
      offEvent('newOrder', handleNewOrder);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timeInterval = setInterval(() => {
      const hrs = new Date().getHours();
      setIsDinnerTime(hrs >= 15);
    }, 60 * 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    setSelectedSlot(isDinnerTime ? 'dinner' : 'lunch');
  }, [isDinnerTime]);

  const activeSlot = selectedSlot === 'dinner' ? prepList.dinner : prepList.lunch;

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
          {prepList.date && (
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 14px 0' }}>
              {prepList.date}
            </p>
          )}

          {/* Slot pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setSelectedSlot('lunch')}
              style={{
                padding: '6px 18px',
                borderRadius: '50px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px',
                background: selectedSlot === 'lunch' ? '#f26522' : '#f4f7fe',
                color: selectedSlot === 'lunch' ? '#fff' : '#94a3b8',
                transition: 'all 0.2s'
              }}
            >
              ☀ Lunch
            </button>
            <button
              onClick={() => setSelectedSlot('dinner')}
              style={{
                padding: '6px 18px',
                borderRadius: '50px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px',
                background: selectedSlot === 'dinner' ? '#7c3aed' : '#f4f7fe',
                color: selectedSlot === 'dinner' ? '#fff' : '#94a3b8',
                transition: 'all 0.2s'
              }}
            >
              🌙 Dinner
            </button>
          </div>

          {/* Active slot breakdown */}
          {activeSlot.total === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
              No active subscriptions for today.
            </p>
          ) : (
            <>
              <p>Total {selectedSlot === 'dinner' ? 'dinner' : 'lunch'} boxes to pack: {activeSlot.total}</p>
              <hr />
              <div className="preparation-item">
                <span>Regular Thali</span>
                <span>{activeSlot.regular}</span>
              </div>
              <div className="preparation-item">
                <span>Jain Thali</span>
                <span>{activeSlot.jain}</span>
              </div>
            </>
          )}

          {/* Full day summary */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px 0' }}>
              Full Day Summary
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, background: '#fff5f0', borderRadius: '12px', padding: '12px', border: '1px solid #fed7aa' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#f26522' }}>☀ Lunch</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#2b3674' }}>{prepList.lunch.total}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>R: {prepList.lunch.regular} · J: {prepList.lunch.jain}</p>
              </div>
              <div style={{ flex: 1, background: '#f5f3ff', borderRadius: '12px', padding: '12px', border: '1px solid #ddd6fe' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#7c3aed' }}>🌙 Dinner</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#2b3674' }}>{prepList.dinner.total}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>R: {prepList.dinner.regular} · J: {prepList.dinner.jain}</p>
              </div>
            </div>
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
