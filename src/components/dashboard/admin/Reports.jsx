import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './Reports.css';

const Reports = () => {
  const [commissionRate, setCommissionRate] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vendorData, setVendorData] = useState([]);

  // Fetch commission data on mount
  useEffect(() => {
    fetchCommissionData();
  }, []);

  const fetchCommissionData = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      const response = await fetch('/api/admin/vendors/pending', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVendorData(data || []);
      }
    } catch (err) {
      console.error('Error fetching commission data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommissionRate = async () => {
    try {
      const token = localStorage.getItem('token');

      // Add endpoint for saving commission rate
      const response = await fetch('/api/admin/settings/commission', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commissionRate })
      });

      if (response.ok) {
        alert('Commission rate saved successfully!');
      } else {
        alert('Failed to save commission rate');
      }
    } catch (err) {
      console.error('Error saving commission rate:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleGenerateInvoice = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('MealSetu Commission Report', 20, 20);
      
      doc.setFontSize(10);
      doc.text(`Commission Rate: ${commissionRate}%`, 20, 30);
      doc.text('Generated on: ' + new Date().toLocaleDateString(), 20, 40);

      // Sample calculation (replace with real data)
      const tableData = vendorData.length > 0 
        ? vendorData.map(vendor => [
            vendor.kitchenName,
            '0', // orders count - would come from orders collection
            `₹${(0 * commissionRate * 0.1).toFixed(2)}`
          ])
        : [
            ['Annapurna Kitchen', '150', `₹${(150 * commissionRate * 0.1).toFixed(2)}`],
            ['Tasty Bites', '200', `₹${(200 * commissionRate * 0.1).toFixed(2)}`],
            ['Healthy Eats', '100', `₹${(100 * commissionRate * 0.1).toFixed(2)}`],
          ];

      doc.autoTable({
        startY: 50,
        head: [['Vendor', 'Orders', 'Commission Earned']],
        body: tableData,
      });

      doc.save('mealsetu_commission_report.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate invoice');
    }
  };

  return (
    <div className="reports">
      <div className="header">
        <h1>Commission Setup & Reports</h1>
        <span>System Online</span>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={fetchCommissionData}>Retry</button>
        </div>
      )}

      <div className="commission-setup">
        <h2>Set Platform Commission Rate</h2>
        <div className="form-group">
          <label htmlFor="commission">Commission Rate (%)</label>
          <input
            type="number"
            id="commission"
            value={commissionRate}
            onChange={(e) => setCommissionRate(Number(e.target.value))}
            min="0"
            max="100"
          />
        </div>
        <button className="save-btn" onClick={handleSaveCommissionRate}>
          Save Commission Rate
        </button>
      </div>

      <div className="invoice-generation">
        <h2>Generate Commission Report</h2>
        <p>Generate a PDF report of commissions and invoices.</p>
        <button className="generate-btn" onClick={handleGenerateInvoice}>
          Generate PDF Invoice
        </button>
      </div>
    </div>
  );
};

export default Reports;
