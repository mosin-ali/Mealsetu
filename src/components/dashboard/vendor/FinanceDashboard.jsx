import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getVendorOrders, getVendorCommissionSummary } from '../../../utils/api';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt    = (n) => (n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PLAN_COLORS = {
  Monthly: { bg: '#ede9fe', color: '#6d28d9' },
  Weekly:  { bg: '#dbeafe', color: '#1d4ed8' },
  Trial:   { bg: '#f1f5f9', color: '#475569' },
  OneDay:  { bg: '#fef9c3', color: '#92400e' },
};

const PlanBadge = ({ planType }) => {
  const c = PLAN_COLORS[planType] || PLAN_COLORS.OneDay;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12,
      fontWeight: 700, background: c.bg, color: c.color }}>
      {planType || '—'}
    </span>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, valueColor = '#f26522', sub, sub2, badge }) => (
  <div style={{
    background: '#fff', borderRadius: 14, padding: '16px 18px',
    border: '1px solid #e8ecf0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8',
        letterSpacing: '0.7px', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: valueColor, lineHeight: 1, marginBottom: 4,
      wordBreak: 'break-all' }}>
      {value}
    </div>
    {sub  && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    {sub2 && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub2}</div>}
    {badge}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const FinanceDashboard = () => {
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [stats,      setStats]      = useState(null);
  const [orders,     setOrders]     = useState([]);
  const [commission, setCommission] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, o, comm] = await Promise.all([
        getDashboardStats(),
        getVendorOrders(),
        getVendorCommissionSummary().catch(() => null),
      ]);
      setStats(s);
      setOrders(Array.isArray(o) ? o : []);
      setCommission(comm);
    } catch (e) {
      setError('Failed to load financial data. ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const now      = new Date();
  const somStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lmStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmEnd    = new Date(now.getFullYear(), now.getMonth(), 0);

  // All paid orders (use stats.totalRevenue as truth; orders used for breakdown)
  const paidOrders   = orders.filter(o => (o.paymentStatus || '').toLowerCase() === 'paid');
  const totalRevenue = stats?.totalRevenue ?? paidOrders.reduce((s, o) => s + (o.amount || 0), 0);

  const thisMonOrders = paidOrders.filter(o => new Date(o.createdAt || o.orderDate) >= somStart);
  const thisMonRev    = thisMonOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const lastMonOrders = paidOrders.filter(o => { const d = new Date(o.createdAt || o.orderDate); return d >= lmStart && d <= lmEnd; });
  const lastMonRev    = lastMonOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const trend         = lastMonRev > 0 ? ((thisMonRev - lastMonRev) / lastMonRev * 100).toFixed(1) : null;

  const avgVal = paidOrders.length ? Math.round(totalRevenue / paidOrders.length) : 0;

  // Plan breakdown (all orders, not just paid — mirrors how orders are counted)
  const PLAN_TYPES = ['Trial', 'Weekly', 'Monthly', 'OneDay'];
  const planBreakdown = PLAN_TYPES.map(type => {
    const pl  = orders.filter(o => o.planType === type);
    const rev = pl.filter(o => (o.paymentStatus || '').toLowerCase() === 'paid')
                  .reduce((s, o) => s + (o.amount || 0), 0);
    return { plan: type, count: pl.length, revenue: rev,
      pct: totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : '0.0' };
  });
  const totalCount = planBreakdown.reduce((s, p) => s + p.count, 0);

  // Cash pending
  const pendingCashAmt = stats?.cashPaymentsTotal
    ? orders.filter(o => o.paymentMethod === 'Cash' && (o.paymentStatus || '').toLowerCase() !== 'paid')
             .reduce((s, o) => s + (o.amount || 0), 0)
    : 0;
  const pendingCashCount = orders.filter(o =>
    o.paymentMethod === 'Cash' && (o.paymentStatus || '').toLowerCase() !== 'paid').length;

  // Commission fields (from getVendorCommissionSummary response shape)
  const cw           = commission?.currentWeek;
  const commGross    = cw?.total_earning    ?? 0;
  const commRate     = cw?.commission_rate  ?? 0;
  const commOwed     = cw?.commission_amount ?? 0;
  const commNet      = commission?.lifetimeNet ?? (commGross - commOwed);

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: 300, background: '#f0f4f8' }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e8ecf0',
          borderTop: '3px solid #f26522', borderRadius: '50%',
          animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        Loading financial data…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, background: '#f0f4f8' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20,
        border: '1px solid #fecaca', color: '#ef4444' }}>
        ❌ {error}
        <button onClick={fetchAll} style={{ marginLeft: 16, background: '#f26522', color: '#fff',
          border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: '#f0f4f8', minHeight: '100vh' }}>
      {/* ── Responsive CSS ── */}
      <style>{`
        .fd-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 16px;
        }
        .fd-middle { display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap; }
        .fd-breakdown  { flex: 1.4 1 280px; background:#fff; border-radius:14px; padding:20px 22px; border:1px solid #e8ecf0; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .fd-commission { flex: 1 1 220px;   background:#fff; border-radius:14px; padding:20px 22px; border:1px solid #e8ecf0; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .fd-tbl { overflow-x: auto; }
        .fd-tbl table { min-width: 400px; }
        @media (max-width: 640px) {
          .fd-stat-grid   { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .fd-breakdown,
          .fd-commission  { flex: 1 1 100%; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e2d5a' }}>
             Financial Dashboard
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Revenue overview and commission tracker
          </p>
        </div>
        <button onClick={fetchAll} style={{
          background: '#fff', color: '#64748b', border: '1px solid #e8ecf0',
          padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
           Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="fd-stat-grid">
        <StatCard
          icon="₹"
          label="Total Revenue"
          value={`₹${fmt(thisMonRev || totalRevenue)}`}
          sub={thisMonRev !== totalRevenue ? 'This month' : 'All time'}
          sub2={thisMonRev !== totalRevenue ? `All time: ₹${fmt(totalRevenue)}` : `${orders.length} total orders`}
          badge={trend !== null && (
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700,
              color: +trend >= 0 ? '#16a34a' : '#ef4444' }}>
              {+trend >= 0 ? '▲' : '▼'} {Math.abs(+trend)}% vs last month
            </div>
          )}
        />
        <StatCard
          icon=""
          label="Active Subscribers"
          value={stats?.activeSubscribers ?? '—'}
          valueColor="#1e2d5a"
          sub="Currently active plans"
          sub2={`${orders.length} total orders on record`}
        />
        <StatCard
          icon=""
          label="Avg Order Value"
          value={`₹${fmt(avgVal)}`}
          sub="Per paid transaction"
          sub2={`Based on ${paidOrders.length} paid orders`}
        />
        <StatCard
          icon=""
          label="Pending Payments"
          value={`₹${fmt(pendingCashAmt)}`}
          valueColor={pendingCashAmt > 0 ? '#ef4444' : '#16a34a'}
          sub={`${pendingCashCount} cash orders unpaid`}
          badge={
            <div style={{ marginTop: 8, fontSize: 13, color: '#f26522',
              fontWeight: 600, cursor: 'default' }}>
              View in Cash Payments →
            </div>
          }
        />
      </div>

      {/* ── Middle Row: Plan Breakdown + Commission ── */}
      <div className="fd-middle">

        {/* Plan Breakdown */}
        <div className="fd-breakdown">
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e2d5a' }}>
             Plan Breakdown
          </h3>
          <div className="fd-tbl">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Plan', 'Orders', 'Revenue', '% of Total'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11,
                    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px',
                    borderBottom: '2px solid #f1f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planBreakdown.map(p => (
                <tr key={p.plan} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '11px 10px' }}><PlanBadge planType={p.plan} /></td>
                  <td style={{ padding: '11px 10px', color: '#1a202c', fontSize: 14, fontWeight: 600 }}>{p.count}</td>
                  <td style={{ padding: '11px 10px', color: '#1a202c', fontSize: 14 }}>₹{fmt(p.revenue)}</td>
                  <td style={{ padding: '11px 10px', color: '#64748b', fontSize: 13 }}>{p.pct}%</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #e8ecf0' }}>
                <td style={{ padding: '11px 10px', fontWeight: 800, color: '#f26522', fontSize: 14 }}>Total</td>
                <td style={{ padding: '11px 10px', fontWeight: 800, color: '#f26522', fontSize: 14 }}>{totalCount}</td>
                <td style={{ padding: '11px 10px', fontWeight: 800, color: '#f26522', fontSize: 14 }}>₹{fmt(totalRevenue)}</td>
                <td style={{ padding: '11px 10px', fontWeight: 800, color: '#f26522', fontSize: 14 }}>100%</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        {/* Commission Summary */}
        <div className="fd-commission">
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e2d5a' }}>
             Commission Summary
          </h3>
          {!cw ? (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>
              No commission data yet for this week
            </div>
          ) : (
            <>
              {[
                { label: 'Gross Revenue',   value: `₹${fmt(commGross)}`, color: '#1a202c'  },
                { label: 'Commission Rate', value: `${commRate}%`,        color: '#1a202c'  },
                { label: 'Commission Owed', value: `₹${fmt(commOwed)}`,   color: '#ef4444', bold: true },
                { label: 'Net Earnings',    value: `₹${fmt(commNet)}`,    color: '#16a34a', bold: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontSize: 13 }}>{r.label}</span>
                  <span style={{ color: r.color, fontWeight: r.bold ? 700 : 500,
                    fontSize: r.bold ? 16 : 14 }}>{r.value}</span>
                </div>
              ))}
              <button style={{ marginTop: 18, width: '100%', background: '#f26522',
                color: '#fff', border: 'none', padding: '11px', borderRadius: 10,
                cursor: 'pointer', fontWeight: 700, fontSize: 14,
                boxShadow: '0 2px 8px rgba(242,101,34,0.25)' }}>
                Pay Commission →
              </button>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default FinanceDashboard;
