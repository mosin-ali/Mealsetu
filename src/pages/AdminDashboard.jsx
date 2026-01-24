import React from 'react';

// Use 'export default' so App.jsx can import it properly
export default function AdminDashboard() {
  return (
    <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar - Matching your Screenshot */}
      <div className="sidebar" style={{ background: '#0f172a', width: '260px', padding: '30px 20px', color: 'white' }}>
        <h2 style={{ color: '#3b82f6', marginBottom: '40px' }}>MealSetu Admin</h2>
        <div style={{ marginBottom: '15px', cursor: 'pointer' }}>Vendor Requests</div>
        <div style={{ marginBottom: '15px', opacity: 0.7 }}>User Management</div>
        <div style={{ marginBottom: '15px', opacity: 0.7 }}>Commission Setup</div>
        <div style={{ marginTop: 'auto', color: '#f87171', cursor: 'pointer' }} onClick={() => window.location.href='/login'}>Logout</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '40px', background: '#f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h1>Vendor Verification Queue</h1>
          <span>System Online</span>
        </div>

        {/* Stats Section */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <div className="card" style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '12px' }}>
            <h3>12</h3><p>New Requests</p>
          </div>
          <div className="card" style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '12px' }}>
            <h3>154</h3><p>Active Vendors</p>
          </div>
          <div className="card" style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '12px' }}>
            <h3>₹8,450</h3><p>Total Commission</p>
          </div>
        </div>

        {/* Table Section */}
        <div style={{ marginTop: '30px', background: 'white', padding: '20px', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
              <tr>
                <th style={{ padding: '10px' }}>Vendor Name</th>
                <th>FSSAI Number</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '15px 10px' }}>Annapurna Kitchen</td>
                <td>12456789012345</td>
                <td><span style={{ background: '#fef3c7', padding: '4px 8px', borderRadius: '4px' }}>Pending</span></td>
                <td><button style={{ background: '#f26522', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '15px' }}>Approve</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}