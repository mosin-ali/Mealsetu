import React, { useState, useEffect } from 'react';
import { onEvent, offEvent } from '../../../utils/socket';
import styles from './CommissionHistory.module.css';
import { getVendorCommissionSummary, getVendorCommissionHistory, createCommissionPaymentOrder, verifyCommissionPaymentRazorpay, getVendorWeekOrderBreakdown } from '../../../utils/api.js';
import { loadRazorpayScript } from '../../common/RazorpayCheckout';

const StatusBadge = ({ status }) => {
  const cfg = {
    paid:    { bg: '#dcfce7', color: '#16a34a', label: 'Paid' },
    overdue: { bg: '#fee2e2', color: '#dc2626', label: 'Overdue' },
    pending: { bg: '#fef3c7', color: '#d97706', label: 'Pending' }
  }[status] || { bg: '#f3f4f6', color: '#374151', label: status };

  return (
    <span style={{
      padding: '3px 10px', borderRadius: 10,
      fontSize: 12, fontWeight: 600,
      background: cfg.bg, color: cfg.color
    }}>
      {cfg.label}
    </span>
  );
};

const CommissionHistory = () => {
  const [summary, setSummary]   = useState(null);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [selectedWeek, setSelectedWeek]         = useState(null);
  const [weekOrders, setWeekOrders]             = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  useEffect(() => { fetchCommissionData(); }, []);

  useEffect(() => {
    const handleUpdate = () => fetchCommissionData();
    onEvent('commission_updated', handleUpdate);
    return () => offEvent('commission_updated', handleUpdate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCommissionData = async () => {
    try {
      setLoading(true);
      const summaryRes = await getVendorCommissionSummary();
      console.log('=== COMMISSION SUMMARY RAW ===', JSON.stringify(summaryRes));
      console.log('=== summary.currentWeek ===', JSON.stringify(summaryRes?.currentWeek));
      console.log('=== summary.lifetimeEarnings ===', summaryRes?.lifetimeEarnings);

      const historyRes = await getVendorCommissionHistory();
      console.log('=== COMMISSION HISTORY RAW ===', JSON.stringify(historyRes));
      console.log('=== history length ===', Array.isArray(historyRes?.commissions) ? historyRes.commissions.length : 'NOT ARRAY — keys: ' + Object.keys(historyRes || {}).join(','));

      const summaryData = summaryRes;
      const historyData = historyRes;
      setSummary(summaryData);
      setHistory(historyData.commissions || []);
    } catch (error) {
      console.error('Commission data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayCommissionPayment = async (commission) => {
    try {
      setSubmitting(true);
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        alert('Could not load payment gateway. Check internet connection.');
        setSubmitting(false);
        return;
      }

      const orderData = await createCommissionPaymentOrder({ commissionId: commission._id });

      const options = {
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'MealSetu Commission',
        description: `Commission for ${orderData.week}`,
        order_id:    orderData.orderId,
        theme:       { color: '#f26522' },
        modal: { ondismiss: () => setSubmitting(false) },
        handler: async (response) => {
          try {
            await verifyCommissionPaymentRazorpay({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              commissionId:        commission._id
            });
            setSubmitting(false);
            fetchCommissionData();
            alert('Commission paid successfully!');
          } catch {
            setSubmitting(false);
            alert('Payment done but verification failed. Contact support. ID: ' +
              response.razorpay_payment_id);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => setSubmitting(false));
      rzp.open();
    } catch (error) {
      setSubmitting(false);
      const code    = error?.code || error?.response?.data?.code;
      const message = error?.response?.data?.message || error?.message;
      if (code === 'WEEK_STILL_OPEN' || code === 'NOT_LOCKED' || code === 'ALREADY_PAID') {
        setPaymentError(message);
        return;
      }
      setPaymentError('Payment failed. Please try again or contact support.');
    }
  };

  // Use the API's rolling-week calculation as the authoritative current week.
  // This prevents a stale future-week draft from appearing as "current".
  const currentWeek = summary?.currentWeek || null;

  // History table excludes the current week (it's shown in the prominent card above).
  const pastWeeks = currentWeek?.week
    ? history.filter(h => h.week !== currentWeek.week)
    : history;

  // For banners: most urgent unpaid locked commission
  const urgentCommission = history.find(c => c.status === 'overdue' && c.isLocked) ||
                           history.find(c => c.status === 'pending' && c.isLocked);

  const handleWeekClick = async (commission) => {
    if (!commission.weekStart || !commission.weekEnd) return;
    setSelectedWeek(commission);
    setWeekOrders(null);
    setLoadingBreakdown(true);
    try {
      const data = await getVendorWeekOrderBreakdown(commission.weekStart, commission.weekEnd);
      setWeekOrders(data);
    } catch (err) {
      console.error('Week breakdown error:', err);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleRaiseDispute = async (commission) => {
    const note = window.prompt('Describe the issue with this settlement amount:');
    if (!note || !note.trim()) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/vendor/commission/${commission._id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: note.trim() })
      });
      alert('Dispute raised. Admin will review within 24 hours.');
      fetchCommissionData();
    } catch {
      alert('Could not raise dispute. Please try again.');
    }
  };

  const handleDownloadInvoice = async (commissionId) => {
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`/api/vendor/commission/invoice/${commissionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await resp.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `MealSetu_Settlement_${commissionId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Invoice download failed: ' + err.message);
    }
  };

  const fmtDate = (d, opts) => d ? new Date(d).toLocaleDateString('en-IN', opts) : '—';
  const shortDate = (d) => fmtDate(d, { day: 'numeric', month: 'short' });
  const longDate  = (d) => fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <div className="loading">Loading commissions...</div>;

  return (
    <div className={styles.commissionContainer}>

      {/* OVERDUE BANNER */}
      {urgentCommission?.status === 'overdue' && (
        <div style={{
          background: '#fef2f2', border: '1.5px solid #dc2626',
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#dc2626' }}>Commission Overdue</p>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
              {`₹${urgentCommission.commission_amount} was due on ${longDate(urgentCommission.due_date)}. Pay now to avoid service interruption.`}
            </p>
          </div>
          <button
            onClick={() => handleRazorpayCommissionPayment(urgentCommission)}
            disabled={submitting}
            style={{
              background: submitting ? '#9ca3af' : '#dc2626', color: 'white',
              border: 'none', borderRadius: 8, padding: '10px 20px',
              fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', marginLeft: 16
            }}
          >
            {submitting ? 'Processing...' : `Pay ₹${urgentCommission.commission_amount} Now`}
          </button>
        </div>
      )}

      {/* DUE SOON BANNER */}
      {urgentCommission?.status === 'pending' &&
       new Date(urgentCommission.due_date) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) && (
        <div style={{
          background: '#fffbeb', border: '1.5px solid #d97706',
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#d97706' }}>Commission Due Soon</p>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
              {`₹${urgentCommission.commission_amount} due by ${fmtDate(urgentCommission.due_date, { day: 'numeric', month: 'long' })}.`}
            </p>
          </div>
          <button
            onClick={() => handleRazorpayCommissionPayment(urgentCommission)}
            disabled={submitting}
            style={{
              background: submitting ? '#9ca3af' : '#d97706', color: 'white',
              border: 'none', borderRadius: 8, padding: '10px 20px',
              fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', marginLeft: 16
            }}
          >
            {submitting ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      )}

      {/* SUMMARY CARDS — current rolling week (from API) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${styles.card} ${styles.cardGreen}`}>
          <h3>Total Earnings</h3>
          <div className="amount">₹{(summary?.currentWeek?.total_earning || 0).toLocaleString('en-IN')}</div>
          <small>{summary?.currentWeek?.isWeekOpen ? 'Live estimate' : 'This week (closed)'}</small>
        </div>
        <div className={`${styles.card} ${styles.cardAmber}`}>
          <h3>Commission Rate</h3>
          <div className="amount">{summary?.currentWeek?.commission_rate || 0}%</div>
          <small>{summary?.currentWeek?.tierSnapshot?.tierName || 'Starter tier'}</small>
        </div>
        <div className={`${styles.card} ${styles.cardRed}`}>
          <h3>Commission {summary?.currentWeek?.status === 'paid' ? 'Paid' : 'Due'}</h3>
          <div className="amount">₹{(summary?.currentWeek?.commission_amount || 0).toLocaleString('en-IN')}</div>
          <small>
            {summary?.currentWeek?.status === 'paid'
              ? `Paid ${summary?.currentWeek?.payment_date ? shortDate(summary.currentWeek.payment_date) : ''}`
              : summary?.currentWeek?.status === 'overdue'
              ? 'Overdue — pay now'
              : summary?.currentWeek?.isWeekOpen
              ? 'Estimate (week open)'
              : 'Pending payment'}
          </small>
        </div>
        <div className={`${styles.card} ${styles.cardBlue}`}>
          <h3>Net Payout</h3>
          <div className="amount">₹{((summary?.currentWeek?.total_earning || 0) - (summary?.currentWeek?.commission_amount || 0)).toLocaleString('en-IN')}</div>
          <small>What you keep</small>
        </div>
      </div>

      {/* LIFETIME TOTALS BAR */}
      {(summary?.lifetimeEarnings > 0) && (
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                 12,
          marginTop:           20,
          marginBottom:        4
        }}>
          {[
            {
              label: 'LIFETIME EARNINGS',
              value: `₹${(summary.lifetimeEarnings).toLocaleString('en-IN')}`,
              sub: 'From all finalized weeks',
              color: '#374151', bg: '#f9fafb', border: '#e5e7eb'
            },
            {
              label: 'COMMISSION PAID',
              value: `₹${(summary.lifetimeCommission).toLocaleString('en-IN')}`,
              sub: 'Actually paid to MealSetu',
              color: '#dc2626', bg: '#fef2f2', border: '#fecaca'
            },
            {
              label: 'COMMISSION PENDING',
              value: `₹${(summary.lifetimePending || 0).toLocaleString('en-IN')}`,
              sub: 'Locked but not yet paid',
              color: '#d97706', bg: '#fffbeb', border: '#fde68a'
            },
            {
              label: 'NET EARNED (ALL TIME)',
              value: `₹${(summary.lifetimeNet).toLocaleString('en-IN')}`,
              sub: 'After deducting paid commission',
              color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0'
            }
          ].map(item => (
            <div key={item.label} style={{
              background:   item.bg,
              border:       `1px solid ${item.border}`,
              borderRadius: 10,
              padding:      '14px 18px'
            }}>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{item.label}</p>
              <p style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{item.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* CHANGE 6 — Current week card */}
      {currentWeek && (
        <div style={{
          background: 'white',
          border: `2px solid ${
            currentWeek.status === 'overdue' ? '#dc2626'
            : currentWeek.status === 'paid'  ? '#16a34a'
            : '#f97316'
          }`,
          borderRadius: 12, padding: 20, marginTop: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Current Week — {currentWeek.week || currentWeek.month}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>
                {currentWeek.weekStart && currentWeek.weekEnd
                  ? `${fmtDate(currentWeek.weekStart, { day: 'numeric', month: 'long' })} – ${longDate(currentWeek.weekEnd)}`
                  : '—'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
                  {currentWeek.settlementNumber ||
                    `MS-${currentWeek.financialYear || currentWeek.week?.split('-W')[0] || 'FY'}-W${currentWeek.week?.split('-W')[1] || '??'}-${String(currentWeek._id || '').slice(-4).toUpperCase()}`
                  }
                </p>
                {currentWeek._id && (
                  <button
                    onClick={() => handleDownloadInvoice(currentWeek._id)}
                    style={{
                      background: 'none', border: '1px solid #e5e7eb',
                      borderRadius: 6, padding: '2px 10px',
                      fontSize: 11, cursor: 'pointer', color: '#6b7280',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    ⬇ Download Invoice
                  </button>
                )}
              </div>
            </div>
            <StatusBadge status={currentWeek.status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>Total Earnings</p>
              <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 18 }}>
                ₹{(currentWeek.total_earning || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>Commission Rate</p>
              <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 18 }}>
                {currentWeek.commission_rate}%
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>Commission Due</p>
              <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 18, color: '#dc2626' }}>
                ₹{(currentWeek.commission_amount || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>You Keep</p>
              <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 18, color: '#16a34a' }}>
                ₹{((currentWeek.total_earning || 0) - (currentWeek.commission_amount || 0)).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {currentWeek.status !== 'paid' && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                  Due by: <strong>{longDate(currentWeek.due_date)}</strong>
                </p>
                {currentWeek.isLocked ? (
                  <button
                    onClick={() => { setPaymentError(null); handleRazorpayCommissionPayment(currentWeek); }}
                    disabled={submitting}
                    style={{
                      background: submitting ? '#9ca3af' : '#f97316', color: 'white',
                      border: 'none', borderRadius: 8, padding: '10px 24px',
                      fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14
                    }}
                  >
                    {submitting ? 'Processing...' : `Pay ₹${currentWeek.commission_amount} via Razorpay`}
                  </button>
                ) : (
                  <span style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                    Settlement finalizing — pay button activates after week closes
                  </span>
                )}
              </div>
              {paymentError && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, padding: '10px 14px', marginTop: 10,
                  fontSize: 13, color: '#dc2626', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>⚠️ {paymentError}</span>
                  <button
                    onClick={() => setPaymentError(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1 }}
                  >✕</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CHANGE 6 — Past weeks table */}
      {pastWeeks.length > 0 && (
        <div className={styles.sectionCard} style={{ marginTop: 24 }}>
          <div className={styles.sectionHeader}>
            <h2>Commission History ({pastWeeks.length})</h2>
            <button className={styles.refreshBtn} onClick={fetchCommissionData}>Refresh</button>
          </div>
          <div className="w-full overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['PERIOD', 'EARNINGS', 'RATE', 'COMMISSION', 'YOU KEPT', 'STATUS', 'INVOICE'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px',
                      textAlign: ['EARNINGS', 'RATE', 'COMMISSION', 'YOU KEPT'].includes(h) ? 'right' : 'left',
                      fontSize: 11, fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastWeeks.map((w) => {
                  const kept = (w.total_earning || 0) - (w.commission_amount || 0);
                  const paidOnTime = w.payment_date && w.due_date &&
                    new Date(w.payment_date) <= new Date(w.due_date);

                  return (
                    <tr
                      key={w._id}
                      onClick={() => handleWeekClick(w)}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        cursor: w.weekStart ? 'pointer' : 'default',
                        background: w.status === 'overdue' ? '#fef2f2' : 'white',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = w.status === 'overdue' ? '#fef2f2' : 'white'; }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 500 }}>
                          {w.weekStart && w.weekEnd
                            ? `${shortDate(w.weekStart)} – ${fmtDate(w.weekEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`
                            : (w.week || w.month)}
                        </span>
                        <br />
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{w.week || w.month}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        ₹{(w.total_earning || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>
                        {w.commission_rate}%
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                        ₹{(w.commission_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                        ₹{kept.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          background: w.status === 'paid'    ? '#dcfce7'
                                    : w.status === 'overdue' ? '#fee2e2' : '#fef3c7',
                          color:      w.status === 'paid'    ? '#16a34a'
                                    : w.status === 'overdue' ? '#dc2626' : '#d97706'
                        }}>
                          {w.status === 'paid'
                            ? `✓ Paid${w.payment_date ? (paidOnTime ? ' on time' : ' late') + ' · ' + shortDate(w.payment_date) : ''}`
                            : w.status === 'overdue' ? 'Overdue' : 'Pending'}
                        </span>
                        {(w.status === 'pending' || w.status === 'overdue') && w.isLocked && (
                          <button
                            onClick={() => handleRazorpayCommissionPayment(w)}
                            disabled={submitting}
                            style={{
                              display: 'block', marginTop: 4,
                              background: 'none', border: '1px solid #f97316',
                              color: '#f97316', borderRadius: 6,
                              padding: '2px 8px', fontSize: 11,
                              cursor: submitting ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Pay Now
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleDownloadInvoice(w._id)}
                            style={{
                              background: 'none', border: '1px solid #e5e7eb',
                              borderRadius: 6, padding: '4px 10px',
                              fontSize: 11, cursor: 'pointer', color: '#6b7280'
                            }}
                          >
                            ⬇ Invoice
                          </button>
                          {w.status !== 'paid' && !w.disputeStatus && (
                            <button
                              onClick={() => handleRaiseDispute(w)}
                              style={{
                                background: 'none', border: '1px solid #fecaca',
                                borderRadius: 6, padding: '4px 10px',
                                fontSize: 11, cursor: 'pointer', color: '#dc2626'
                              }}
                            >
                              ⚑ Dispute
                            </button>
                          )}
                          {w.disputeStatus === 'raised' && (
                            <span style={{
                              fontSize: 11, color: '#d97706',
                              padding: '4px 8px', background: '#fef3c7',
                              borderRadius: 6
                            }}>
                              Under Review
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className={styles.sectionCard} style={{ marginTop: 24 }}>
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>
            No commission records yet. First one generates at the end of your first week.
          </p>
        </div>
      )}

      {/* ORDER BREAKDOWN MODAL */}
      {selectedWeek && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20
          }}
          onClick={() => { setSelectedWeek(null); setWeekOrders(null); }}
        >
          <div
            style={{
              background: 'white', borderRadius: 14,
              width: '100%', maxWidth: 700,
              maxHeight: '85vh', overflowY: 'auto',
              padding: 28
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Settlement Breakdown</h2>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
                  {selectedWeek.weekStart && selectedWeek.weekEnd
                    ? `${shortDate(selectedWeek.weekStart)} – ${fmtDate(selectedWeek.weekEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : selectedWeek.week}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleDownloadInvoice(selectedWeek._id)}
                  style={{
                    background: '#f97316', color: 'white',
                    border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontWeight: 600,
                    cursor: 'pointer', fontSize: 13
                  }}
                >
                  Download Invoice
                </button>
                <button
                  onClick={() => { setSelectedWeek(null); setWeekOrders(null); }}
                  style={{
                    background: '#f3f4f6', border: 'none',
                    borderRadius: 8, padding: '8px 16px',
                    cursor: 'pointer', fontSize: 13
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {loadingBreakdown ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading orders...</p>
            ) : weekOrders ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'ORDERS',     value: weekOrders.totalOrders,                                         color: '#374151' },
                    { label: 'GROSS',      value: `₹${(weekOrders.grossEarnings || 0).toLocaleString('en-IN')}`,  color: '#374151' },
                    { label: 'COMMISSION', value: `-₹${(weekOrders.commissionAmount || 0).toLocaleString('en-IN')}`, color: '#dc2626' },
                    { label: 'YOU KEEP',   value: `₹${(weekOrders.netEarnings || 0).toLocaleString('en-IN')}`,    color: '#16a34a' }
                  ].map(item => (
                    <div key={item.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px' }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{item.label}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700, color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {weekOrders.orders?.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['DATE', 'CUSTOMER', 'PLAN', 'AMOUNT', 'COMMISSION', 'YOUR SHARE'].map(h => (
                          <th key={h} style={{
                            padding: '8px 10px',
                            textAlign: ['DATE', 'CUSTOMER', 'PLAN'].includes(h) ? 'left' : 'right',
                            fontSize: 10, fontWeight: 600, color: '#6b7280',
                            borderBottom: '1px solid #e5e7eb'
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weekOrders.orders.map((order, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 10px', color: '#374151' }}>
                            {shortDate(order.orderDate)}
                          </td>
                          <td style={{ padding: '10px 10px', color: '#374151' }}>{order.customerName}</td>
                          <td style={{ padding: '10px 10px', color: '#6b7280' }}>{order.planType}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>
                            ₹{order.grossAmount}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#dc2626' }}>
                            -₹{order.commissionCut}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                            ₹{order.netAmount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#9ca3af', textAlign: 'center', padding: 30 }}>
                    No orders found for this week
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
};

export default CommissionHistory;
