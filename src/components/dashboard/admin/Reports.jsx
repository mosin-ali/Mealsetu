import React, { useState, useEffect } from 'react';
import { getAdminCommissionTiers, updateAdminCommissionTiers, getAdminCommissionVendors, adminVerifyCommission, seedDefaultTiers } from '../../../utils/api.js';
import './Reports.css';

const Reports = () => {
  const [tiers, setTiers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ month: '', status: 'all', search: '' });
  const [editingTier, setEditingTier] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);

  const styles = {
    adminReports: {
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      fontFamily: 'sans-serif'
    },
    adminHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '30px'
    },
    headerActions: {
      display: 'flex',
      gap: '10px'
    },
    csvBtn: {
      padding: '10px 20px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      backgroundColor: '#10b981',
      color: 'white'
    },
    seedBtn: {
      padding: '10px 20px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      backgroundColor: '#f59e0b',
      color: 'white'
    },
    section: {
      backgroundColor: 'white',
      marginBottom: '30px',
      padding: '25px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '20px'
    },
    th: {
      backgroundColor: '#1e293b',
      color: 'white',
      padding: '12px',
      textAlign: 'left'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #e5e7eb'
    },
    filters: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    },
    filterInput: {
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px'
    },
    status: {
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600'
    },
    confirmBtn: {
      padding: '6px 12px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '12px',
      marginRight: '5px',
      backgroundColor: '#10b981',
      color: 'white'
    },
    rejectBtn: {
      padding: '6px 12px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '12px',
      backgroundColor: '#ef4444',
      color: 'white'
    },
    noData: {
      textAlign: 'center',
      color: '#6b7280',
      padding: '40px',
      fontStyle: 'italic'
    },
    adminLoading: {
      textAlign: 'center',
      padding: '60px',
      color: '#6b7280'
    }
  };

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

  const updateTier = async (tier) => {
    try {
      await updateAdminCommissionTiers(tiers);
      setEditingTier(null);
      loadData();
    } catch (error) {
      alert('Update failed: ' + error.message);
    }
  };

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
    if (!confirm('Seed default tiers? (only if empty)')) return;
    try {
      await seedDefaultTiers();
      loadData();
    } catch (error) {
      alert('Seed failed: ' + error.message);
    }
  };

  if (loading) {
    return <div style={styles.adminLoading}>Loading commission dashboard...</div>;
  }

  return (
    <div style={styles.adminReports}>
      {/* HEADER */}
      <div style={styles.adminHeader}>
        <h1>Commission Dashboard</h1>
        <div style={styles.headerActions}>
          <button onClick={downloadCommissionCSV} style={styles.csvBtn}>
            📥 Export CSV
          </button>
          <button onClick={handleSeedTiers} style={styles.seedBtn}>
            Seed Default Tiers
          </button>
        </div>
      </div>

      {/* TIER SETTINGS */}
      <div style={styles.section}>
        <h2>Tier Settings</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Tier</th>
              <th style={styles.th}>Min Earning</th>
              <th style={styles.th}>Max Earning</th>
              <th style={styles.th}>Rate (%)</th>
              <th style={styles.th}>Active</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => (
              <tr key={tier._id || index}>
                <td>
                  <input
                    type="text"
                    value={tier.tierName}
                    onChange={(e) => {
                      const updated = [...tiers];
                      updated[index].tierName = e.target.value;
                      setTiers(updated);
                    }}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      width: '100px',
                      fontSize: '14px'
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={tier.minEarning}
                    onChange={(e) => {
                      const updated = [...tiers];
                      updated[index].minEarning = Number(e.target.value);
                      setTiers(updated);
                    }}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      width: '110px',
                      fontSize: '14px'
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={tier.maxEarning || ''}
                    placeholder="No limit"
                    onChange={(e) => {
                      const updated = [...tiers];
                      updated[index].maxEarning = e.target.value 
                        ? Number(e.target.value) 
                        : null;
                      setTiers(updated);
                    }}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      width: '110px',
                      fontSize: '14px'
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
                      onChange={(e) => {
                        const updated = [...tiers];
                        updated[index].ratePercent = Number(e.target.value);
                        setTiers(updated);
                      }}
                      style={{
                        border: '2px solid #f97316',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        width: '70px',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#f97316',
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ fontWeight: '700', color: '#f97316' }}>%</span>
                  </div>
                </td>
                {/* <td style={styles.td}>
                  <label style={{ display: 'inline-block', position: 'relative', width: '50px', height: '24px' }}>
                    <input 
                      type="checkbox" 
                      checked={tier.isActive} 
                      onChange={(e) => {
                        tiers[index].isActive = e.target.checked;
                        setTiers([...tiers]);
                      }} 
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: tier.isActive ? '#10b981' : '#cbd5e1',
                      borderRadius: '24px',
                      transition: '0.3s',
                      cursor: 'pointer'
                    }}></span>
                  </label>
                </td> */}

              {/* Active Toggle */}
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

                <td style={styles.td}>
                  <button onClick={handleSaveTiers} style={{ 
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    cursor: 'pointer'
                  }}>
                    Save All
                  </button>
                </td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr>
                <td colSpan="6" style={styles.noData}>
                  No tiers configured. <button onClick={handleSaveTiers} style={styles.seedBtn}>Save All</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* VENDORS OVERVIEW */}
      <div style={styles.section}>
        <h2>Vendor Commissions ({filteredVendors.length})</h2>
        <div style={styles.filters}>
          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={styles.filterInput}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <input 
            placeholder="Search vendors..." 
            value={filters.search} 
            onChange={(e) => handleFilterChange('search', e.target.value)}
            style={styles.filterInput}
          />
          <select 
            value={filters.month} 
            onChange={(e) => handleFilterChange('month', e.target.value)}
            style={styles.filterInput}
          >
            <option value="">All Months</option>
            <option value="2024-01">Jan 2024</option>
          </select>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Vendor</th>
              <th style={styles.th}>Month</th>
              <th style={styles.th}>Earnings</th>
              <th style={styles.th}>Rate</th>
              <th style={styles.th}>Due</th>
              <th style={styles.th}>Paid</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.map((v) => (
              <tr key={v._id}>
                <td style={styles.td}>{v.vendor_name}</td>
                <td style={styles.td}>{v.month}</td>
                <td style={styles.td}>₹{v.total_earning?.toLocaleString()}</td>
                <td style={styles.td}>{v.commission_rate}%</td>
                <td style={styles.td}>₹{v.commission_amount?.toLocaleString()}</td>
                <td style={styles.td}>₹{v.amount_paid?.toLocaleString()}</td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.status,
                    backgroundColor: v.status === 'pending' ? '#fef3c7' : v.status === 'paid' ? '#dcfce7' : '#fef2f2',
                    color: v.status === 'pending' ? '#d97706' : v.status === 'paid' ? '#16a34a' : '#ef4444'
                  }}>
                    {v.status}
                  </span>
                </td>
                <td style={styles.td}>
                  {v.proof_url ? (
                    <a href={v.proof_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      Proof
                    </a>
                  ) : (
                    <button style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}>Remind</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PENDING VERIFICATIONS */}
      <div style={styles.section}>
        <h2>Pending Verifications</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Vendor</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Proof</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.filter(v => v.payment_status === 'pending').map((v) => (
              <tr key={v._id}>
                <td style={styles.td}>{v.vendor_name}</td>
                <td style={styles.td}>₹{v.amount_paid}</td>
                <td style={styles.td}>
                  {v.proof_url ? (
                    <a href={v.proof_url} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  ) : 'N/A'}
                </td>
                <td style={styles.td}>
                  <button style={styles.confirmBtn} onClick={() => handleVerifyPayment(v._id, 'confirm')}>
                    Confirm
                  </button>
                  <button style={styles.rejectBtn} onClick={() => handleVerifyPayment(v._id, 'reject')}>
                    Reject
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

export default Reports;

