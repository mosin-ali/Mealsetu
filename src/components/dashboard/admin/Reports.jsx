import React, { useState, useEffect } from 'react';
import { getAdminCommissionTiers, updateAdminCommissionTiers, getAdminCommissionVendors, seedDefaultTiers, getAdminMarkCommissionPaid, getVendorCommissionDetail } from '../../../utils/api.js';
import VendorCommissionDetail from './VendorCommissionDetail';
import './Reports.css';

const getTierName = (earning, tiers) => {
  const tier = tiers
    .filter(t => t.isActive !== false)
    .sort((a, b) => b.minEarning - a.minEarning)
    .find(t => earning >= t.minEarning);
  return tier?.tierName || 'Starter';
};

const Reports = () => {
  const [tiers, setTiers]         = useState([]);
  const [vendors, setVendors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('commissions');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWeek, setSelectedWeek]   = useState('');

  const [drillVendorId, setDrillVendorId] = useState(null);

  const now = new Date();

  // ── Derived summary stats ──────────────────────────────────────
  const totalOutstanding = vendors
    .filter(c => c.status !== 'paid')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const overdueVendors = vendors.filter(c => c.status === 'overdue');
  const overdueCount   = overdueVendors.length;
  const overdueAmount  = overdueVendors.reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const paidThisMonth  = vendors
    .filter(c => c.status === 'paid' && c.payment_date && new Date(c.payment_date) > thirtyDaysAgo)
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const totalVendors   = vendors.length;
  const paidOnTimeCount = vendors.filter(c => c.status === 'paid' && c.paidOnTime === true).length;
  const collectionRate = totalVendors > 0 ? Math.round((paidOnTimeCount / totalVendors) * 100) : 0;
  // ──────────────────────────────────────────────────────────────

  const downloadCommissionCSV = async () => {
    try {
      const response = await fetch('/api/admin/commission/report/csv', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'mealsetu-commissions.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  useEffect(() => { loadData(); }, []);

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

  const monthOptions = () => {
    const months = [];
    const now    = new Date();
    for (let i = 0; i < 12; i++) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      months.push({ value, label });
    }
    return months;
  };

  const filteredVendors = vendors
    .filter(v => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (searchQuery && !v.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedMonth) {
        const ws = v.weekStart ? new Date(v.weekStart) : null;
        if (!ws) return false;
        const cm = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}`;
        if (cm !== selectedMonth) return false;
      }
      if (selectedWeek && selectedMonth) {
        const ws       = new Date(v.weekStart);
        const weekInMonth = Math.ceil(ws.getDate() / 7);
        if (String(weekInMonth) !== selectedWeek) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const order = { overdue: 0, pending: 1, paid: 2 };
      return (order[a.status] ?? 1) - (order[b.status] ?? 1);
    });

  const handleSaveTiers = async () => {
    try {
      if (tiers.some(t => t.ratePercent < 0 || t.ratePercent > 100)) {
        alert('Rate must be between 0 and 100');
        return;
      }
      await updateAdminCommissionTiers(tiers);
      alert('All tiers saved successfully');
      loadData();
    } catch (error) {
      alert('Save failed: ' + error.message);
    }
  };

  const handleAdminMarkPaid = async (commissionId) => {
    if (!window.confirm('Mark this commission as paid?')) return;
    try {
      await getAdminMarkCommissionPaid(commissionId);
      loadData();
    } catch (error) {
      alert('Failed: ' + error.message);
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
    return <div className="admin-loading">Loading commission dashboard...</div>;
  }

  return (
    <div className="admin-reports">

      {/* HEADER + TAB NAV */}
      <div style={{ marginBottom: 8 }}>
        <div className="admin-reports-header" style={{ marginBottom: 0 }}>
          <h1>Commission Management</h1>
          <div className="header-actions">
            {activeTab === 'commissions' && (
              <button onClick={downloadCommissionCSV} className="csv-btn">Export CSV</button>
            )}
            {activeTab === 'settings' && (
              <button onClick={handleSeedTiers} className="seed-btn">Seed Default Tiers</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginTop: 12 }}>
          {[
            { key: 'commissions', label: 'Collections & Settlements' },
            { key: 'settings',    label: 'Tier Configuration' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background:   'none',
                border:       'none',
                padding:      '10px 20px',
                fontWeight:   activeTab === tab.key ? 700 : 400,
                fontSize:     14,
                cursor:       'pointer',
                color:        activeTab === tab.key ? '#f97316' : '#6b7280',
                borderBottom: activeTab === tab.key ? '2px solid #f97316' : '2px solid transparent',
                marginBottom: -2,
                transition:   'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SETTINGS TAB — tier configuration */}
      {activeTab === 'settings' && (
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
                <tr><td colSpan="6" className="no-data">No tiers. Click Seed Default Tiers.</td></tr>
              ) : (
                tiers.map((tier, index) => (
                  <tr key={tier._id || index}>
                    <td>
                      <input type="text" value={tier.tierName} className="tier-input"
                        onChange={(e) => { const u = [...tiers]; u[index].tierName = e.target.value; setTiers(u); }} />
                    </td>
                    <td>
                      <input type="number" value={tier.minEarning} className="tier-input"
                        onChange={(e) => { const u = [...tiers]; u[index].minEarning = Number(e.target.value); setTiers(u); }} />
                    </td>
                    <td>
                      <input type="number" value={tier.maxEarning || ''} placeholder="No limit" className="tier-input"
                        onChange={(e) => { const u = [...tiers]; u[index].maxEarning = e.target.value ? Number(e.target.value) : null; setTiers(u); }} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" min="0" max="100" value={tier.ratePercent} className="tier-rate-input"
                          onChange={(e) => { const u = [...tiers]; u[index].ratePercent = Number(e.target.value); setTiers(u); }} />
                        <span style={{ fontWeight: 700, color: '#f97316' }}>%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="switch">
                          <input type="checkbox" checked={tier.isActive !== false}
                            onChange={(e) => { const u = [...tiers]; u[index].isActive = e.target.checked; setTiers(u); }} />
                          <span className="slider"></span>
                        </label>
                        <span style={{ fontSize: 12, fontWeight: 700, color: tier.isActive !== false ? '#16a34a' : '#ef4444' }}>
                          {tier.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button onClick={handleSaveTiers} className="save-all-btn">Save All</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )} {/* end settings tab */}

      {/* COMMISSIONS TAB — daily operations */}
      {activeTab === 'commissions' && (
      <div className="reports-section">
        <h2>Vendor Commissions ({filteredVendors.length})</h2>

        {/* CHANGE 3 — Summary bar */}
        {totalOutstanding > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '14px 18px', borderLeft: '4px solid #dc2626' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>TOTAL OUTSTANDING</p>
              <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: '#dc2626' }}>
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>
                across {vendors.filter(c => c.status !== 'paid').length} vendors
              </p>
            </div>
            <div style={{ background: '#fff7ed', borderRadius: 10, padding: '14px 18px', borderLeft: '4px solid #f97316' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>OVERDUE</p>
              <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: '#f97316' }}>
                ₹{overdueAmount.toLocaleString('en-IN')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>
                {overdueCount} vendor{overdueCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 18px', borderLeft: '4px solid #16a34a' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>COLLECTED THIS MONTH</p>
              <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: '#16a34a' }}>
                ₹{paidThisMonth.toLocaleString('en-IN')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>last 30 days</p>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '14px 18px', borderLeft: '4px solid #3b82f6' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ON-TIME RATE</p>
              <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: '#2563eb' }}>
                {collectionRate}%
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>
                {paidOnTimeCount} of {totalVendors} vendors
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>

          <input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="filter-input"
          />

          <select
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setSelectedWeek(''); }}
            className="filter-select"
          >
            <option value="">All Months</option>
            {monthOptions().map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {selectedMonth && (
            <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className="filter-select">
              <option value="">All Weeks</option>
              <option value="1">Week 1 (1st–7th)</option>
              <option value="2">Week 2 (8th–14th)</option>
              <option value="3">Week 3 (15th–21st)</option>
              <option value="4">Week 4 (22nd–28th)</option>
              <option value="5">Week 5 (29th+)</option>
            </select>
          )}

          {(selectedMonth || selectedWeek || statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => { setSelectedMonth(''); setSelectedWeek(''); setStatusFilter('all'); setSearchQuery(''); }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}
            >
              ✕ Clear
            </button>
          )}

          {overdueCount > 0 && (
            <button
              onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
              style={{
                background:   statusFilter === 'overdue' ? '#dc2626' : '#fee2e2',
                color:        statusFilter === 'overdue' ? 'white'   : '#dc2626',
                border:       '1.5px solid #dc2626',
                borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              ⚠ Overdue ({overdueCount})
            </button>
          )}
        </div>

        <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>
          Showing {filteredVendors.length} of {vendors.length} records
          {selectedMonth && ` · ${monthOptions().find(m => m.value === selectedMonth)?.label}`}
          {selectedWeek && ` · Week ${selectedWeek}`}
        </p>

        <div className="table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Week</th>
                <th>Earnings</th>
                <th>Rate</th>
                <th>Due</th>
                <th>Due Date / Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr><td colSpan="8" className="no-data">No vendor commission records found.</td></tr>
              ) : (
                filteredVendors.map((v) => {
                  const isOverdue = v.status === 'overdue';
                  const isDueSoon = v.status === 'pending' && v.due_date &&
                    new Date(v.due_date) < new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
                  const paidOnTime = v.payment_date && v.due_date &&
                    new Date(v.payment_date) <= new Date(v.due_date);

                  return (
                    <tr key={v._id} style={{
                      background: isOverdue ? '#fef2f2' : isDueSoon ? '#fffbeb' : 'white'
                    }}>

                      {/* CHANGE 5 — Vendor name + tier badge */}
                      <td>
                        <button
                          onClick={() => {
                            console.log('Drill-down: vendorId =', v.vendorId, '| commission._id =', v._id);
                            setDrillVendorId(v.vendorId);
                          }}
                          style={{
                            background: 'none', border: 'none', color: '#f97316',
                            cursor: 'pointer', fontWeight: 600,
                            textDecoration: 'underline', padding: 0, fontSize: 14
                          }}
                        >
                          {v.vendor_name}
                        </button>
                        <div style={{ marginTop: 3 }}>
                          <span style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 8,
                            background: '#eff6ff', color: '#2563eb', fontWeight: 500
                          }}>
                            {getTierName(v.total_earning || 0, tiers)} tier
                          </span>
                        </div>
                        {v.disputeStatus === 'raised' && (
                          <div style={{ marginTop: 4, fontSize: 10, color: '#dc2626', fontWeight: 600 }}>
                            ⚑ Dispute raised
                          </div>
                        )}
                      </td>

                      {/* CHANGE 1 — Human-readable week dates */}
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {v.weekStart && v.weekEnd
                            ? `${new Date(v.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(v.weekEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                            : (v.week || v.month)}
                        </span>
                        <br />
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{v.week || v.month}</span>
                      </td>

                      <td>₹{v.total_earning?.toLocaleString('en-IN')}</td>
                      <td>{v.commission_rate}%</td>
                      <td style={{ fontWeight: 600 }}>₹{v.commission_amount?.toLocaleString('en-IN')}</td>

                      {/* CHANGE 2 — Always show due date + paid status */}
                      <td>
                        <span style={{ color: isOverdue ? '#dc2626' : '#374151', fontSize: 13 }}>
                          {v.due_date
                            ? new Date(v.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                        {v.payment_date && (
                          <div style={{ marginTop: 3 }}>
                            <span style={{
                              fontSize: 11,
                              color: paidOnTime ? '#16a34a' : '#f97316'
                            }}>
                              {paidOnTime ? '✓ Paid on time' : 'Paid late'}
                              {' · '}
                              {new Date(v.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        )}
                      </td>

                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                          background: isOverdue  ? '#fee2e2'
                                    : isDueSoon ? '#fef3c7'
                                    : v.status === 'paid' ? '#dcfce7' : '#f3f4f6',
                          color:     isOverdue  ? '#dc2626'
                                    : isDueSoon ? '#d97706'
                                    : v.status === 'paid' ? '#16a34a' : '#374151'
                        }}>
                          {isOverdue ? 'Overdue'
                            : isDueSoon ? 'Due Soon'
                            : v.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                        {isOverdue && v.due_date && (
                          <div style={{ marginTop: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626' }}>
                              {Math.floor((new Date() - new Date(v.due_date)) / (1000 * 60 * 60 * 24))} days overdue
                            </span>
                          </div>
                        )}
                      </td>

                      <td>
                        {v.status !== 'paid' && (
                          <button className="confirm-btn" onClick={() => handleAdminMarkPaid(v._id)}>
                            Mark Paid
                          </button>
                        )}
                        {v.disputeStatus === 'raised' && (
                          <button
                            onClick={() => setDrillVendorId(v.vendorId || v._id)}
                            style={{
                              background: '#fef2f2', color: '#dc2626',
                              border: '1px solid #fecaca', borderRadius: 6,
                              padding: '4px 10px', fontSize: 11,
                              cursor: 'pointer', marginTop: v.status !== 'paid' ? 4 : 0,
                              display: 'block'
                            }}
                          >
                            Review Dispute
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      )} {/* end commissions tab */}

      {/* VENDOR DRILL-DOWN MODAL — outside tabs so it overlays everything */}
      {drillVendorId && (
        <VendorCommissionDetail
          vendorId={drillVendorId}
          onClose={() => setDrillVendorId(null)}
        />
      )}

    </div>
  );
};

export default Reports;
