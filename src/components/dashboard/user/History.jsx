import React from 'react';
import './History.css';

const History = ({ paymentHistory, onDownloadInvoice }) => {
  return (
    <div className="history-card">
      <h3>Payment History</h3>
      <table className="history-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {paymentHistory.map((h, i) => (
            <tr key={i}>
              <td>{h.id}</td>
              <td>{h.date}</td>
              <td>₹{h.amount}</td>
              <td className="status-paid">{h.status}</td>
              <td>
                <button className="download-btn" onClick={() => onDownloadInvoice(h)}>
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default History;
