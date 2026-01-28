import React from 'react';
import './Subscription.css';

const Subscription = ({ user, leaveStart, leaveEnd, mealType, onLeaveStartChange, onLeaveEndChange, onMealTypeChange, onApplyLeave, onExtendSubscription }) => {
  return (
    <div className="subscription-container">
      <div className="subscription-card">
        <h3>Meal Plan Status</h3>
        <div className="status-display">
          <p className="status-label">Subscription Valid Until</p>
          <h2 className="status-date">{user.expiryDate}</h2>
        </div>
        <button className="btn-primary extend-btn" onClick={onExtendSubscription}>Extend Subscription</button>
      </div>
      <div className="subscription-card">
        <h3>Schedule Leave / Pause</h3>
        <div className="leave-form">
          <div>
            <label className="input-label">Start Date</label>
            <input type="date" className="input-field date-input" value={leaveStart} onChange={(e) => onLeaveStartChange(e.target.value)} />
          </div>
          <div>
            <label className="input-label">End Date</label>
            <input type="date" className="input-field date-input" value={leaveEnd} onChange={(e) => onLeaveEndChange(e.target.value)} />
          </div>
        </div>
        <label className="input-label">Which Meal to Skip?</label>
        <select className="input-field" value={mealType} onChange={(e) => onMealTypeChange(e.target.value)}>
          <option value="both">Both (Lunch & Dinner)</option>
          <option value="lunch">Lunch Only</option>
          <option value="dinner">Dinner Only</option>
        </select>
        <button className="btn-primary apply-leave-btn" onClick={onApplyLeave}>⏸ Apply Leave & Extend Plan</button>
      </div>
    </div>
  );
};

export default Subscription;
