import React, { useState, useEffect } from 'react';
import { getAdminCommissionTiers, updateAdminCommissionTiers, getAdminCommissionVendors, adminVerifyCommission, seedDefaultTiers, adminVerifyScreenshot } from '../../../utils/api.js';
import './Reports.css';

const STATUS_LABELS = {
  'not_generated':        'Not Generated',
  'pending':              'Pending',
  'paid':                 'Paid',
  'overdue':              'Overdue',
  'pending_verification': 'Under Review'
};

const Reports = () => {
  const [tiers, setTiers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ month: '', status: 'all', search: '' });
  const [aiAnalysis, setAiAnalysis] = useState({});   // keyed by payment_id
  const [analyzing, setAnalyzing] = useState({});     // keyed by payment_id

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState(null);
  const [rejectVendorName, setRejectVendorName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

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

  const handleVerifyPayment = async (paymentId, action, notes = '') => {
    try {
      await adminVerifyCommission(paymentId, { action, notes });
      loadData();
    } catch (error) {
      alert('Verification failed: ' + error.message);
    }
  };

  const handleAnalyzeScreenshot = async (paymentId, proofUrl) => {
    setAnalyzing(prev => ({ ...prev, [paymentId]: true }));
    try {
      const result = await adminVerifyScreenshot(proofUrl);
      setAiAnalysis(prev => ({ ...prev, [paymentId]: result }));
    } catch (err) {
      setAiAnalysis(prev => ({
        ...prev,
        [paymentId]: { error: 'Analysis failed: ' + err.message }
      }));
    } finally {
      setAnalyzing(prev => ({ ...prev, [paymentId]: false }));
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

  const getPaymentMethodBadge = (v) => {
    if (!v.payment_status) return null;
    const isRazorpay = v.utr_number?.startsWith('pay_');
    return isRazorpay
      ? <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Razorpay ✓</span>
      : <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Manual</span>;
  };

  const getProofUrl = (proofUrl) => {
    if (!proofUrl) return null;
    if (proofUrl.startsWith('http://') || proofUrl.startsWith('https://')) return proofUrl;
    const backendBase = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : window.location.origin;
    return `${backendBase}${proofUrl.startsWith('/') ? '' : '/'}${proofUrl}`;
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
                <th>Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">No vendor commission records found.</td>
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
                    <td>{getPaymentMethodBadge(v)}</td>
                    <td>
                      <span className={`status-badge ${
                        v.status === 'pending'              ? 'status-pending' :
                        v.status === 'paid'                 ? 'status-paid' :
                        v.status === 'pending_verification' ? 'status-pending' :
                        'status-overdue'
                      }`}>
                        {STATUS_LABELS[v.status] || v.status}
                      </span>
                    </td>
                    <td>
                      {v.proof_url ? (
                        <a href={getProofUrl(v.proof_url)} target="_blank" rel="noopener noreferrer"
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {v.proof_url ? (
                          <>
                            <a href={getProofUrl(v.proof_url)} target="_blank" rel="noopener noreferrer"
                              style={{ color: '#3b82f6', fontWeight: '600' }}>
                              View Proof
                            </a>
                            <div style={{ marginTop: '8px' }}>
                              <button
                                onClick={() => handleAnalyzeScreenshot(v.payment_id, v.proof_url)}
                                disabled={analyzing[v.payment_id]}
                                style={{
                                  background: '#6366f1',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}
                              >
                                {analyzing[v.payment_id] ? '🔍 Analyzing...' : '🤖 Analyze with AI'}
                              </button>

                              {aiAnalysis[v.payment_id] && !aiAnalysis[v.payment_id].fallback && (
                                aiAnalysis[v.payment_id].aiAvailable === false ? (
                                  <div style={{
                                    marginTop: '6px', padding: '8px 12px', borderRadius: '6px',
                                    background: '#fef9c3', border: '1px solid #ca8a04', fontSize: '12px'
                                  }}>
                                    <strong style={{ color: '#92400e' }}>⚠ Basic Check Only</strong>
                                    <p style={{ margin: '4px 0 0', color: '#78350f' }}>
                                      {aiAnalysis[v.payment_id].reason}
                                    </p>
                                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px', color: '#92400e' }}>
                                      {aiAnalysis[v.payment_id].signals?.map((s, i) => (
                                        <li key={i} style={{ fontSize: '11px' }}>{s}</li>
                                      ))}
                                    </ul>
                                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#78350f' }}>
                                      Set ANTHROPIC_API_KEY in .env for full AI analysis.
                                    </p>
                                  </div>
                                ) : (
                                  <div style={{
                                    marginTop: '8px', padding: '10px 14px',
                                    borderRadius: '8px', fontSize: '12px',
                                    background: aiAnalysis[v.payment_id].recommendation === 'approve'
                                      ? '#dcfce7' : aiAnalysis[v.payment_id].recommendation === 'reject'
                                      ? '#fee2e2' : '#fef9c3',
                                    border: `1px solid ${
                                      aiAnalysis[v.payment_id].recommendation === 'approve' ? '#16a34a'
                                      : aiAnalysis[v.payment_id].recommendation === 'reject' ? '#dc2626'
                                      : '#ca8a04'
                                    }`
                                  }}>
                                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                                      {aiAnalysis[v.payment_id].recommendation === 'approve' && '✅ Likely Authentic'}
                                      {aiAnalysis[v.payment_id].recommendation === 'reject' && '❌ Possibly Fake'}
                                      {aiAnalysis[v.payment_id].recommendation === 'review' && '⚠️ Needs Review'}
                                      <span style={{ fontWeight: '400', marginLeft: '6px', color: '#64748b' }}>
                                        ({aiAnalysis[v.payment_id].confidence} confidence)
                                      </span>
                                      {aiAnalysis[v.payment_id].provider && (
                                        <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '8px' }}>
                                          via {aiAnalysis[v.payment_id].provider}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ color: '#374151', marginBottom: '4px' }}>
                                      {aiAnalysis[v.payment_id].reason}
                                    </div>
                                    {aiAnalysis[v.payment_id].signals?.length > 0 && (
                                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', color: '#6b7280' }}>
                                        {aiAnalysis[v.payment_id].signals.map((s, i) => (
                                          <li key={i} style={{ fontSize: '11px' }}>{s}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )
                              )}

                              {aiAnalysis[v.payment_id]?.fallback && (
                                <div style={{
                                  marginTop: '6px', fontSize: '11px', color: '#9a3412',
                                  background: '#fff7ed', padding: '6px 10px', borderRadius: '6px'
                                }}>
                                  ⚠ {aiAnalysis[v.payment_id].reason || 'AI not configured. Verify manually.'}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>No proof uploaded</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {v.payment_id ? (
                        <>
                          <button className="confirm-btn" onClick={() => handleVerifyPayment(v.payment_id, 'confirm')}>
                            ✓ Confirm
                          </button>
                          <button className="reject-btn" onClick={() => {
                            setRejectPaymentId(v.payment_id);
                            setRejectVendorName(v.vendor_name || 'this vendor');
                            setRejectReason('');
                            setRejectModal(true);
                          }}>
                            ✕ Reject
                          </button>
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                          No proof submitted
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REJECTION MODAL */}
      {rejectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '460px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ color: '#dc2626', margin: '0 0 6px 0' }}>
              Reject Payment Proof
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>
              Vendor: <strong>{rejectVendorName}</strong>
            </p>

            <label style={{
              display: 'block', fontWeight: '600', fontSize: '14px',
              marginBottom: '8px', color: '#374151'
            }}>
              Reason for rejection <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Screenshot is unclear, amount does not match, wrong UPI ID shown..."
              rows={4}
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
                borderRadius: '8px', fontSize: '14px', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit'
              }}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 20px 0' }}>
              This reason will be shown to the vendor so they know what to fix.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setRejectModal(false);
                  setRejectReason('');
                  setRejectPaymentId(null);
                }}
                style={{
                  flex: 1, padding: '12px', border: '1px solid #e2e8f0',
                  borderRadius: '8px', background: 'white', cursor: 'pointer',
                  fontSize: '14px', color: '#64748b'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) return;
                  setRejectSubmitting(true);
                  try {
                    await handleVerifyPayment(rejectPaymentId, 'reject', rejectReason.trim());
                    setRejectModal(false);
                    setRejectReason('');
                    setRejectPaymentId(null);
                  } finally {
                    setRejectSubmitting(false);
                  }
                }}
                disabled={!rejectReason.trim() || rejectSubmitting}
                style={{
                  flex: 1, padding: '12px', border: 'none',
                  borderRadius: '8px',
                  cursor: rejectReason.trim() && !rejectSubmitting ? 'pointer' : 'not-allowed',
                  fontSize: '14px', fontWeight: '700', color: 'white',
                  background: rejectReason.trim() && !rejectSubmitting ? '#dc2626' : '#94a3b8'
                }}
              >
                {rejectSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;