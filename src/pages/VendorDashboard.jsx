import React from 'react';

export default function VendorDashboard() {
  return (
    <div>
      <nav className="nav-bar">
        <h2 style={{color: 'var(--primary)', fontWeight: '800'}}>MealSetu Partner</h2>
        <button onClick={() => window.location.href='/login'} className="tag" style={{border: 'none', cursor: 'pointer'}}>Logout</button>
      </nav>
      <div className="container">
        <div className="grid" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
          <div className="card"><h3>24</h3><p>Active Subs</p></div>
          <div className="card"><h3>12</h3><p>Orders Today</p></div>
          <div className="card"><h3>₹4,200</h3><p>Revenue</p></div>
        </div>

        <div className="card" style={{marginTop: '30px'}}>
          <h3>Today's Menu Setup</h3>
          <div className="input-group" style={{marginTop: '15px'}}>
            <input className="form-input" placeholder="Enter Sabji Name" />
          </div>
          <button className="btn-primary" style={{width: 'auto', padding: '10px 30px'}}>Update Menu</button>
        </div>
      </div>
    </div>
  );
} 