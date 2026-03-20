import React, { useState, useEffect } from 'react';
import styles from './CommissionHistory.module.css';
import { getVendorCommissionSummary, getVendorCommissionHistory, vendorPayCommission } from '../../../utils/api.js';

const CommissionHistory = () => {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [UTR, setUTR] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

  const handlePayCommission = async (commission) => {
    setSelectedCommission(commission);
    setPayModal(true);
  };

  const submitPayment = async () => {
    if (!proofFile && !UTR) {
      alert('Upload proof OR enter UTR');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('commissionId', selectedCommission._id);
      formData.append('paymentMethod', paymentMethod);
      if (UTR) formData.append('transactionId', UTR);
      if (proofFile) formData.append('proof', proofFile);

      await vendorPayCommission(formData);
      alert('Payment proof submitted! Awaiting admin verification.');
      setPayModal(false);
      fetchData(); // Refresh
    } catch (error) {
      alert('Submit failed: ' + error.message);
    }
  };

  if (loading) return <div className="loading">Loading commissions...</div>;

  return (
<div className={styles.commissionContainer}>
      {/* SUMMARY CARDS */}
<div className={styles.summaryGrid}>
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
          <small>{summary?.status === 'pending' ? 'Due Now' : summary.status}</small>
        </div>
<div className={`${styles.card} ${styles.cardBlue}`}>
          <h3>Net Payout</h3>
          <div className="amount">₹{summary?.net_payout?.toLocaleString() || 0}</div>
          <small>What you keep</small>
        </div>
      </div>

      {/* PAYOUT BANNER */}
      {summary?.commission_due > 0 && summary.status === 'pending' && (
        <div className="due-banner">
          <div>
            <h4>You owe ₹{summary.commission_due.toLocaleString()} for {summary.current_month}</h4>
            <p>Upload payment proof below</p>
          </div>
          <button className="pay-btn" onClick={() => handlePayCommission(history[0])}>
            Pay Commission
          </button>
        </div>
      )}

     {/* HISTORY TABLE */}
<div className={styles.sectionCard}>
  <div className={styles.sectionHeader}>
    <h2>Commission History</h2>
    <button className={styles.refreshBtn} onClick={fetchData}>⟳ Refresh</button>
  </div>
  <table className={styles.historyTable}>
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
            <span className={`${styles.statusBadge} ${
              c.status === 'paid' ? styles.statusBadgePaid :
              c.status === 'overdue' ? styles.statusBadgeOverdue :
              styles.statusBadgePending
            }`}>
              {c.status}
            </span>
          </td>
          <td>
            {c.status === 'pending' && (
              <button
                className={styles.actionBtn}
                onClick={() => handlePayCommission(c)}>
                Pay Now
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


      {/* HOW IT WORKS */}
      {/* <div className="how-works">
        <h2>How Commission Works</h2>
        <table className="tiers-table">
          <thead>
            <tr>
              <th>Earnings Tier</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>₹0 - ₹10,000</td><td>3%</td></tr>
            <tr><td>₹10,001 - ₹50,000</td><td>5%</td></tr>
            <tr><td>₹50,001 - ₹1,00,000</td><td>8%</td></tr>
            <tr><td>₹1,00,001+</td><td>10%</td></tr>
          </tbody>
        </table>
        <p className="note">
          Pay via UPI/Bank (admin details in modal). Upload screenshot/UTR for verification.
        </p>
      </div> */}

      {/* PAY MODAL */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Pay Commission</h3>
            <p><strong>Amount:</strong> ₹{selectedCommission?.commission_amount?.toLocaleString()}</p>
            <p><strong>Month:</strong> {selectedCommission?.month}</p>
            
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash (with receipt)</option>
            </select>

            <label>UTR Number (optional)</label>
            <input 
              type="text" 
              placeholder="Enter UPI TXN ID or Bank UTR"
              value={UTR}
              onChange={(e) => setUTR(e.target.value)}
            />

            <label>Upload Proof (screenshot)</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setProofFile(e.target.files[0])}
            />
            {proofFile && <p>Selected: {proofFile.name}</p>}

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setPayModal(false)}>
                Cancel
              </button>
              <button className="submit-btn" onClick={submitPayment}>
                Submit Proof
              </button>
            </div>

            <div className="bank-details">
              <h4>Payment Details</h4>
              <p><strong>UPI:</strong> mealsetu@paytm</p>
              <p><strong>Bank:</strong> HDFC A/c XXXX6789 (MealSetu)</p>
            </div>
          </div>
        </div>
      )}
</div>
  );
} 
export default CommissionHistory;