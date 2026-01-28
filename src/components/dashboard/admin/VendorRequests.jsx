import React from 'react';
import './VendorRequests.css';

const VendorRequests = ({ vendors, onApprove }) => {
  return (
    <div className="vendor-requests">
      <div className="header">
        <h1>Vendor Verification Queue</h1>
        <span>System Online</span>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>12</h3>
          <p>New Requests</p>
        </div>
        <div className="stat-card">
          <h3>154</h3>
          <p>Active Vendors</p>
        </div>
        <div className="stat-card">
          <h3>₹8,450</h3>
          <p>Total Commission</p>
        </div>
      </div>
      <div className="table-container">
        <table className="vendors-table">
          <thead>
            <tr>
              <th>Vendor Name</th>
              <th>FSSAI Number</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor, index) => (
              <tr key={index}>
                <td>{vendor.name}</td>
                <td>{vendor.fssai}</td>
                <td>
                  <span className="status-badge pending">Pending</span>
                </td>
                <td>
                  <button className="approve-btn" onClick={() => onApprove(vendor.id)}>
                    Approve
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorRequests;
