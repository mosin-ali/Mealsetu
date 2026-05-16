import React, { useState, useEffect, useRef } from 'react';
import { onEvent, offEvent } from '../../../utils/socket';
import styles from './CommissionHistory.module.css';
import { getVendorCommissionSummary, getVendorCommissionHistory, vendorPayCommission, getAdminUpiId, createCommissionPaymentOrder, verifyCommissionPaymentRazorpay } from '../../../utils/api.js';
import { loadRazorpayScript } from '../../common/RazorpayCheckout';

const STATUS_LABELS = {
  'not_generated':        'Not Yet Generated',
  'pending':              'Pending Payment',
  'pending_verification': 'Awaiting Admin Verification',
  'paid':                 'Paid',
  'overdue':              'Overdue'
};

const CommissionHistory = () => {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [payModal, setPayModal] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [payStep, setPayStep] = useState(1); // 1=show QR, 2=upload proof

  // UPI / QR state
  const [adminUpiId, setAdminUpiId] = useState(null);
  const [upiLoading, setUpiLoading] = useState(false);

  // Screenshot upload state
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);


  // AUTO-PAYMENT DETECTION: detection state
  const [paymentDetected, setPaymentDetected] = useState(false);
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState(null); // eslint-disable-line no-unused-vars
  const [countdown, setCountdown] = useState(null);
  const [tabLeftForPayment, setTabLeftForPayment] = useState(false); // eslint-disable-line no-unused-vars

  // AUTO-PAYMENT DETECTION: refs for event listener cleanup
  const visibilityListenerRef = useRef(null);
  const countdownIntervalRef  = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);

  // AUTO-PAYMENT DETECTION: tear down all listeners and timers
  const stopPaymentDetection = () => {
    if (visibilityListenerRef.current) {
      const { handleVisibilityChange, handleBlur, handleFocus } = visibilityListenerRef.current;
      if (handleVisibilityChange)
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (handleBlur)  window.removeEventListener('blur',  handleBlur);
      if (handleFocus) window.removeEventListener('focus', handleFocus);
      visibilityListenerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setCountdown(null);
    setTabLeftForPayment(false);
  };

  // AUTO-PAYMENT DETECTION: set up tab-switch + auto-advance listeners
  const startPaymentDetection = () => {
    stopPaymentDetection(); // clean up any previous run

    setTabLeftForPayment(false);
    setPaymentDetected(false);

    // DETECTION 1: Page Visibility API
    // Vendor leaves tab to open UPI app → tab hidden; returns → tab visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabLeftForPayment(true);
      } else {
        setTabLeftForPayment(prev => {
          if (prev) {
            setTimeout(() => {
              setPayStep(2);
              setPaymentDetected(true);
            }, 800);
          }
          return false;
        });
      }
    };

    // DETECTION 2: window blur/focus (covers mobile browser app-switching)
    const handleBlur  = () => setTabLeftForPayment(true);
    const handleFocus = () => {
      setTabLeftForPayment(prev => {
        if (prev) {
          setTimeout(() => {
            setPayStep(2);
            setPaymentDetected(true);
          }, 800);
        }
        return false;
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur',  handleBlur);
    window.addEventListener('focus', handleFocus);

    // Store all three for cleanup
    visibilityListenerRef.current = { handleVisibilityChange, handleBlur, handleFocus };

    // DETECTION 3: 90-second auto-advance countdown
    let secondsLeft = 90;
    setCountdown(secondsLeft);

    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      setCountdown(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdown(null);
      }
    }, 1000);

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      setPayStep(2);
      setPaymentDetected(true);
    }, 90000);
  };

  // Data fetch on mount
  useEffect(() => {
    fetchCommissionData();
  }, []);

  // Real-time: refresh when admin verifies or rejects commission
  useEffect(() => {
    const handleCommissionUpdate = (data) => {
      fetchCommissionData();
      if (data?.status === 'rejected') {
        alert(`Commission payment rejected: ${data.message || 'Please resubmit your proof.'}`);
      }
    };
    onEvent('commission_updated', handleCommissionUpdate);
    return () => offEvent('commission_updated', handleCommissionUpdate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch admin UPI ID when modal opens
  useEffect(() => {
    if (payModal) {
      fetchAdminUpi();
    }
  }, [payModal]);

  // AUTO-PAYMENT DETECTION: start detection once QR is visible, stop otherwise
  useEffect(() => {
    if (payModal && payStep === 1 && adminUpiId) {
      // 1.5s delay so QR renders fully before we watch for tab-switching
      const timer = setTimeout(() => startPaymentDetection(), 1500);
      return () => clearTimeout(timer);
    }
    if (!payModal || payStep !== 1) {
      stopPaymentDetection();
    }
  }, [payModal, payStep, adminUpiId]); // eslint-disable-line react-hooks/exhaustive-deps

  // AUTO-PAYMENT DETECTION: cleanup on unmount
  useEffect(() => {
    return () => stopPaymentDetection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCommissionData = async () => {
    try {
      setLoading(true);
      const [summaryData, historyData] = await Promise.all([
        getVendorCommissionSummary(),
        getVendorCommissionHistory()
      ]);
      setSummary(summaryData);
      setHistory(historyData.commissions || []);
    } catch (error) {
      console.error('Commission data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUpi = async () => {
    try {
      setUpiLoading(true);
      const data = await getAdminUpiId();
      setAdminUpiId(data.adminUpiId || null);
    } catch {
      setAdminUpiId(null);
    } finally {
      setUpiLoading(false);
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
        description: `Commission for week ${orderData.week}`,
        order_id:    orderData.orderId,
        theme:       { color: '#f26522' },
        modal: {
          ondismiss: () => setSubmitting(false)
        },
        handler: async (response) => {
          try {
            await verifyCommissionPaymentRazorpay({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              commissionId:        commission._id
            });
            setSubmitting(false);
            closeModal();
            fetchCommissionData();
            alert('Commission paid successfully! ✓');
          } catch (err) {
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
      alert('Payment failed: ' + error.message);
    }
  };

  const handlePayCommission = (commission, startStep = 1) => {
    setSelectedCommission(commission);
    setPayStep(startStep);
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setPaymentDetected(false); // AUTO-PAYMENT DETECTION: reset on open
    setPayModal(true);
  };

  const getStatusDisplay = (record) => {
    if (record.status === 'pending' && record.rejectionReason) return 'Proof Rejected';
    return STATUS_LABELS[record.status] || record.status;
  };

  const getStatusStyle = (record) => {
    if (record.status === 'pending' && record.rejectionReason) {
      return { background: '#fee2e2', color: '#dc2626' };
    }
    return {};
  };

  // AUTO-PAYMENT DETECTION: closeModal also tears down detection
  const closeModal = () => {
    stopPaymentDetection();
    setPaymentDetected(false);
    setPayModal(false);
    setPayStep(1);
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const handleSubmitProof = async () => {
    if (!screenshotFile || !selectedCommission) return;
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('commissionId', selectedCommission._id);
      formData.append('proof', screenshotFile);
      await vendorPayCommission(formData);
      closeModal();
      fetchCommissionData();
    } catch (err) {
      alert('Failed to submit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const upiString = adminUpiId
    ? `upi://pay?pa=${adminUpiId}&pn=MealSetu&am=${selectedCommission?.commission_amount}&cu=INR&tn=Commission-${selectedCommission?.month}`
    : null;

  const qrImageUrl = upiString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`
    : null;

  if (loading) return <div className="loading">Loading commissions...</div>;

  return (
    <div className={styles.commissionContainer}>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${styles.card} ${styles.cardGreen}`}>
          <h3>Total Earnings</h3>
          <div className="amount">₹{summary?.total_earning?.toLocaleString() || 0}</div>
          <small>This Month</small>
        </div>
        <div className={`${styles.card} ${styles.cardAmber}`}>
          <h3>Commission Rate</h3>
          <div className="amount">{summary?.commission_rate || 0}%</div>
          <small>{summary?.tier_name}</small>
        </div>
        <div className={`${styles.card} ${styles.cardRed}`}>
          <h3>Commission Due</h3>
          <div className="amount">₹{summary?.commission_due?.toLocaleString() || 0}</div>
          <small>{STATUS_LABELS[summary?.status] || summary?.status}</small>
        </div>
        <div className={`${styles.card} ${styles.cardBlue}`}>
          <h3>Net Payout</h3>
          <div className="amount">₹{summary?.net_payout?.toLocaleString() || 0}</div>
          <small>What you keep</small>
        </div>
      </div>

      {/* CASE A — First-time payment (pending, no rejection) */}
      {summary?.status === 'pending' && !summary?.rejectionReason && summary?.commission_due > 0 && history.length > 0 && (
        <div className={styles.dueBanner}>
          <div>
            <h4>You owe ₹{summary.commission_due.toLocaleString()} for {summary.current_month}</h4>
            <p>Scan QR and upload payment proof below</p>
          </div>
          <button className={styles.payBtn} onClick={() => handlePayCommission(history[0], 1)}>
            Pay Commission
          </button>
        </div>
      )}

      {/* CASE B — Re-submission after rejection (pending + rejectionReason) */}
      {summary?.status === 'pending' && summary?.rejectionReason && history.length > 0 && (
        <>
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
            padding: '16px 20px', marginBottom: '16px',
            display: 'flex', gap: '12px', alignItems: 'flex-start'
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>❌</span>
            <div>
              <p style={{ margin: '0 0 4px 0', fontWeight: '700', color: '#dc2626', fontSize: '14px' }}>
                Payment Proof Rejected
              </p>
              <p style={{ margin: '0 0 10px 0', color: '#991b1b', fontSize: '13px', lineHeight: '1.5' }}>
                {summary.rejectionReason}
              </p>
              <p style={{ margin: 0, color: '#7f1d1d', fontSize: '12px', fontStyle: 'italic' }}>
                Please make a new UPI payment and upload a clear screenshot.
              </p>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <p style={{ color: '#374151', fontSize: '14px', marginBottom: '12px' }}>
              If you have already made the payment, upload a new clear screenshot:
            </p>
            <button
              onClick={() => handlePayCommission(history[0], 2)}
              style={{
                background: '#f26522', color: 'white', border: 'none',
                padding: '12px 24px', borderRadius: '10px',
                fontWeight: '700', cursor: 'pointer', fontSize: '14px',
                marginRight: '10px'
              }}
            >
              📸 Upload New Screenshot
            </button>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '10px 0 6px 0' }}>
              If you haven't paid yet, scan the QR code first:
            </p>
            <button
              onClick={() => handlePayCommission(history[0], 1)}
              style={{
                background: 'transparent', color: '#f26522',
                border: '1px solid #f26522', padding: '8px 16px',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
              }}
            >
              Scan QR &amp; Pay
            </button>
          </div>
        </>
      )}

      {/* CASE C — Awaiting admin verification */}
      {summary?.status === 'pending_verification' && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '10px', padding: '14px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <span style={{ fontSize: '20px' }}>⏳</span>
          <div>
            <p style={{ margin: 0, fontWeight: '600', color: '#92400e', fontSize: '14px' }}>
              Proof Submitted — Awaiting Admin Verification
            </p>
            <p style={{ margin: '2px 0 0', color: '#78350f', fontSize: '12px' }}>
              Admin will verify within 24 hours. No action needed.
            </p>
          </div>
        </div>
      )}

      {/* HISTORY TABLE */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2>Commission History</h2>
          <button className={styles.refreshBtn} onClick={fetchCommissionData}>⟳ Refresh</button>
        </div>
        <div className="w-full overflow-x-auto">
          <table className={styles.historyTable} style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Total Earnings</th>
                <th>Rate</th>
                <th>Commission</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c._id}>
                  <td>{c.month}</td>
                  <td>₹{c.total_earning?.toLocaleString()}</td>
                  <td>{c.commission_rate}%</td>
                  <td>₹{c.commission_amount?.toLocaleString()}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        c.status === 'paid'    ? styles.statusBadgePaid :
                        c.status === 'overdue' ? styles.statusBadgeOverdue :
                        styles.statusBadgePending
                      }`}
                      style={getStatusStyle(c)}
                    >
                      {getStatusDisplay(c)}
                    </span>
                    {c.rejectionReason && c.status === 'pending' && (
                      <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', maxWidth: '160px' }}>
                        {c.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td>
                    {(c.status === 'pending' || c.status === 'overdue') && (
                      <button className={styles.actionBtn} onClick={() => handlePayCommission(c, c.rejectionReason ? 2 : 1)}>
                        {c.rejectionReason ? 'Re-submit' : 'Pay Now'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="6" className={styles.noData}>
                    No commission records yet. First one generates on 1st of next month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAY MODAL */}
      {payModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '16px'
          }}
          onClick={closeModal}
        >
          {/* AUTO-PAYMENT DETECTION: pulse keyframe for waiting indicator */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50%       { opacity: 0.4; transform: scale(1.3); }
            }
          `}</style>

          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px' }}>

            {/* STEP 1 — QR Code */}
            {payStep === 1 && (
              <div style={{
                background: 'white', borderRadius: '16px', padding: '32px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
              }}>
                <h2 style={{ color: '#2b3674', margin: '0 0 4px 0' }}>Pay Commission</h2>
                <p style={{ color: '#64748b', margin: '0 0 24px 0', fontSize: '14px' }}>
                  Week: {selectedCommission?.month}
                </p>

                {/* Amount */}
                <div style={{
                  background: '#fff7ed', border: '2px solid #f26522',
                  borderRadius: '12px', padding: '16px', textAlign: 'center',
                  marginBottom: '24px'
                }}>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '13px' }}>Amount to Pay</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#f26522' }}>
                    ₹{selectedCommission?.commission_amount}
                  </p>
                </div>

                {/* PRIMARY: Razorpay online payment */}
                <button
                  onClick={() => handleRazorpayCommissionPayment(selectedCommission)}
                  disabled={submitting}
                  style={{
                    width: '100%', background: submitting ? '#94a3b8' : '#f26522',
                    color: 'white', border: 'none', padding: '14px',
                    borderRadius: '10px', fontSize: '15px', fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer', marginBottom: '10px'
                  }}
                >
                  {submitting
                    ? 'Processing...'
                    : `💳 Pay ₹${selectedCommission?.commission_amount} Online`}
                </button>


                <button
                  onClick={closeModal}
                  style={{
                    marginTop: '12px', width: '100%', background: 'transparent',
                    color: '#64748b', border: '1px solid #e2e8f0', padding: '12px',
                    borderRadius: '10px', fontSize: '14px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* STEP 2 — Upload Screenshot */}
            {payStep === 2 && (
              <div style={{
                background: 'white', borderRadius: '16px', padding: '32px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
              }}>

                {/* AUTO-PAYMENT DETECTION: payment detected banner */}
                {paymentDetected && (
                  <div style={{
                    background: '#dcfce7', border: '1px solid #16a34a',
                    borderRadius: '8px', padding: '10px 14px',
                    marginBottom: '16px', display: 'flex',
                    alignItems: 'center', gap: '8px'
                  }}>
                    <span style={{ fontSize: '18px' }}>✅</span>
                    <span style={{ color: '#166534', fontWeight: '600', fontSize: '14px' }}>
                      Payment detected! Now upload your screenshot to confirm.
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setPayStep(1)}
                  style={{
                    background: 'none', border: 'none', color: '#64748b',
                    cursor: 'pointer', padding: '0 0 16px 0', fontSize: '14px'
                  }}
                >
                  ← Back to QR Code
                </button>

                <h2 style={{ color: '#2b3674', margin: '0 0 8px 0' }}>Upload Payment Proof</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
                  Upload the screenshot of your UPI payment success screen
                </p>

                {/* Upload area */}
                <div
                  onClick={() => document.getElementById('proofUpload').click()}
                  style={{
                    border: '2px dashed #cbd5e1', borderRadius: '12px',
                    padding: '32px', textAlign: 'center', cursor: 'pointer',
                    background: screenshotPreview ? '#f0fdf4' : '#f8fafc',
                    borderColor: screenshotPreview ? '#16a34a' : '#cbd5e1',
                    transition: 'all 0.2s'
                  }}
                >
                  {screenshotPreview ? (
                    <img
                      src={screenshotPreview}
                      alt="Payment proof"
                      style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>📸</div>
                      <p style={{ color: '#64748b', margin: '0', fontSize: '14px' }}>
                        Click to upload screenshot
                      </p>
                      <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '12px' }}>
                        JPG, PNG — max 5MB
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="proofUpload"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setScreenshotFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setScreenshotPreview(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />

                {screenshotFile && (
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#16a34a', textAlign: 'center' }}>
                    ✓ {screenshotFile.name} selected
                  </p>
                )}

                <button
                  onClick={handleSubmitProof}
                  disabled={!screenshotFile || submitting}
                  style={{
                    marginTop: '20px', width: '100%',
                    background: screenshotFile && !submitting ? '#16a34a' : '#94a3b8',
                    color: 'white', border: 'none', padding: '14px',
                    borderRadius: '10px', fontSize: '16px', fontWeight: '700',
                    cursor: screenshotFile && !submitting ? 'pointer' : 'not-allowed'
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Payment Proof'}
                </button>

                <button
                  onClick={closeModal}
                  style={{
                    marginTop: '10px', width: '100%', background: 'transparent',
                    color: '#64748b', border: '1px solid #e2e8f0', padding: '12px',
                    borderRadius: '10px', fontSize: '14px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default CommissionHistory;
