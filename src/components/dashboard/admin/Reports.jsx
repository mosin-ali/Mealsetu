import React, { useState, useEffect } from 'react';
import { getAdminCommissionTiers, updateAdminCommissionTiers, getAdminCommissionVendors, adminVerifyCommission, seedDefaultTiers } from '../../../utils/api.js';
import './Reports.css';

const Reports = () => {
  const [tiers, setTiers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ month: '', status: 'all', search: '' });

  const downloadCommissionCSV = async () => {
    try {
      const response = await fetch('/api/admin/commission/export', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'commissions.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tiersData, vendorsData] = await Promise.all([
        getAdminCommissionTiers(),
        getAdminCommissionVendors()
      ]);
      setTiers(tiersData.tiers || []);
      setVendors(vendorsData.vendors || []);
    } catch (error) {
      console.error('Admin commission load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredVendors = vendors.filter(v => {
    if (filters.status !== 'all' && v.status !== filters.status) return false;
    if (filters.month && v.month !== filters.month) return false;
    if (filters.search && !v.vendor_name?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const handleSaveTiers = async () => {
    try {
      if (tiers.some(t => t.ratePercent < 0 || t.ratePercent > 100)) {
        alert('Rate must be between 0 and 100');
        return;
      }
      await updateAdminCommissionTiers(tiers);
      alert('✅ All tiers saved successfully');
      loadData();
    } catch (error) {
      alert('❌ Save failed: ' + error.message);
    }
  };

  const handleVerifyPayment = async (paymentId, action) => {
    try {
      const notes = action === 'reject' ? prompt('Rejection notes:') : '';
      await adminVerifyCommission(paymentId, { action, notes });
      loadData();
    } catch (error) {
      alert('Verification failed: ' + error.message);
    }
  };

  const handleSeedTiers = async () => {
    if (!window.confirm('Seed default tiers? (only if empty)')) return;
    try {
      await seedDefaultTiers();
      loadData();
    } catch (error) {
      alert('Seed failed: ' + error.message);
    }
  };

  if (loading) {
    return <div className="admin-loading">⏳ Loading commission dashboard...</div>;
  }

  return (
    <div className="admin-reports">

      {/* HEADER */}
      <div className="admin-reports-header">
        <h1>⚙️ Commission Setup</h1>
        <div className="header-actions">
          <button onClick={downloadCommissionCSV} className="csv-btn">
            📥 Export CSV
          </button>
          <button onClick={handleSeedTiers} className="seed-btn">
            🌱 Seed Default Tiers
          </button>
        </div>
      </div>

      {/* TIER SETTINGS */}
      <div className="reports-section">
        <h2>Tier Settings</h2>
        <div className="table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Tier Name</th>
                <th>Min Earning (₹)</th>
                <th>Max Earning (₹)</th>
                <th>Commission Rate</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tiers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    No tiers configured. Click Seed Default Tiers to get started.
                  </td>
                </tr>
              ) : (
                tiers.map((tier, index) => (
                  <tr key={tier._id || index}>
                    <td>
                      <input
                        type="text"
                        value={tier.tierName}
                        className="tier-input"
                        onChange={(e) => {
                          const updated = [...tiers];
                          updated[index].tierName = e.target.value;
                          setTiers(updated);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={tier.minEarning}
                        className="tier-input"
                        onChange={(e) => {
                          const updated = [...tiers];
                          updated[index].minEarning = Number(e.target.value);
                          setTiers(updated);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={tier.maxEarning || ''}
                        placeholder="No limit"
                        className="tier-input"
                        onChange={(e) => {
                          const updated = [...tiers];
                          updated[index].maxEarning = e.target.value ? Number(e.target.value) : null;
                          setTiers(updated);
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.ratePercent}
                          className="tier-rate-input"
                          onChange={(e) => {
                            const updated = [...tiers];
                            updated[index].ratePercent = Number(e.target.value);
                            setTiers(updated);
                          }}
                        />
                        <span style={{ fontWeight: '700', color: '#f97316' }}>%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={tier.isActive !== false}
                            onChange={(e) => {
                              const updated = [...tiers];
                              updated[index].isActive = e.target.checked;
                              setTiers(updated);
                            }}
                          />
                          <span className="slider"></span>
                        </label>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: tier.isActive !== false ? '#16a34a' : '#ef4444'
                        }}>
                          {tier.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button onClick={handleSaveTiers} className="save-all-btn">
                        Save All
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VENDORS OVERVIEW */}
      <div className="reports-section">
        <h2>Vendor Commissions ({filteredVendors.length})</h2>
        <div className="reports-filters">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <input
            placeholder="🔍 Search vendors..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="filter-input"
          />
          <select
            value={filters.month}
            onChange={(e) => handleFilterChange('month', e.target.value)}
            className="filter-select"
          >
            <option value="">All Months</option>
            <option value="2024-01">Jan 2024</option>
          </select>
        </div>
        <div className="table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Month</th>
                <th>Earnings</th>
                <th>Rate</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">No vendor commission records found.</td>
                </tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr key={v._id}>
                    <td style={{ fontWeight: '600' }}>{v.vendor_name}</td>
                    <td>{v.month}</td>
                    <td>₹{v.total_earning?.toLocaleString()}</td>
                    <td>{v.commission_rate}%</td>
                    <td>₹{v.commission_amount?.toLocaleString()}</td>
                    <td>₹{v.amount_paid?.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${
                        v.status === 'pending' ? 'status-pending' :
                        v.status === 'paid' ? 'status-paid' : 'status-overdue'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td>
                      {v.proof_url ? (
                        <a href={v.proof_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>
                          View Proof
                        </a>
                      ) : (
                        <button className="remind-btn">Remind</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PENDING VERIFICATIONS */}
      <div className="reports-section">
        <h2>Pending Verifications</h2>
        <div className="table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.filter(v => v.payment_status === 'pending').length === 0 ? (
                <tr>
                  <td colSpan="4" className="no-data">✅ No pending verifications.</td>
                </tr>
              ) : (
                vendors.filter(v => v.payment_status === 'pending').map((v) => (
                  <tr key={v._id}>
                    <td style={{ fontWeight: '600' }}>{v.vendor_name}</td>
                    <td>₹{v.amount_paid}</td>
                    <td>
                      {v.proof_url ? (
                        <a href={v.proof_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#3b82f6', fontWeight: '600' }}>
                          View
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>N/A</span>
                      )}
                    </td>
                    <td>
                      <button className="confirm-btn" onClick={() => handleVerifyPayment(v._id, 'confirm')}>
                        ✓ Confirm
                      </button>
                      <button className="reject-btn" onClick={() => handleVerifyPayment(v._id, 'reject')}>
                        ✕ Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Reports;