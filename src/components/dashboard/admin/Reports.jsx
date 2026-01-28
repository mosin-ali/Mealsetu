import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './Reports.css';

const Reports = () => {
  const [commissionRate, setCommissionRate] = useState(10); // Default 10%

  const handleGenerateInvoice = () => {
    const doc = new jsPDF();
    doc.text('MealSetu Invoice Report', 20, 20);
    doc.text(`Commission Rate: ${commissionRate}%`, 20, 30);
    doc.text('Generated on: ' + new Date().toLocaleDateString(), 20, 40);

    // Sample data for the table
    const tableData = [
      ['Vendor', 'Orders', 'Commission Earned'],
      ['Annapurna Kitchen', 150, `₹${(150 * commissionRate * 0.1).toFixed(2)}`],
      ['Tasty Bites', 200, `₹${(200 * commissionRate * 0.1).toFixed(2)}`],
      ['Healthy Eats', 100, `₹${(100 * commissionRate * 0.1).toFixed(2)}`],
    ];

    doc.autoTable({
      startY: 50,
      head: [tableData[0]],
      body: tableData.slice(1),
    });

    doc.save('mealsetu_invoice.pdf');
  };

  return (
    <div className="reports">
      <div className="header">
        <h1>Commission Setup & Reports</h1>
        <span>System Online</span>
      </div>
      <div className="commission-setup">
        <h2>Set Platform Commission Rate</h2>
        <div className="form-group">
          <label htmlFor="commission">Commission Rate (%)</label>
          <input
            type="number"
            id="commission"
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
            min="0"
            max="100"
          />
        </div>
        <button className="save-btn">Save Commission Rate</button>
      </div>
      <div className="invoice-generation">
        <h2>Generate Invoice Report</h2>
        <p>Generate a PDF report of commissions and invoices.</p>
        <button className="generate-btn" onClick={handleGenerateInvoice}>
          Generate PDF Invoice
        </button>
      </div>
    </div>
  );
};

export default Reports;
