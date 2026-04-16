import React, { useState, useEffect } from 'react';
import { useToast } from '../../common/Toast';
import { addManualCustomer, getManualCustomers, calculateManualOrderAmount } from '../../../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AddManualCustomer = ({ vendorProfile }) => {
  const { addToast } = useToast();
  const [manualCustomers, setManualCustomers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    planType: 'weekly',
    startDate: '',
    paymentMethod: 'Cash',
    amount: 0,
    deliveryPincode: '',
    mealPreference: 'Regular'
  });
  const [loading, setLoading] = useState(false);
  const [calculateLoading, setCalculateLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Load manual customers on mount
  useEffect(() => {
    fetchManualCustomers();
  }, []);

  const fetchManualCustomers = async () => {
    try {
      const customers = await getManualCustomers();
      setManualCustomers(customers || []);
    } catch (error) {
      console.error('Failed to load manual customers:', error);
      addToast('Failed to load manual customers', 'error');
    }
  };

  // Auto-calculate on planType or startDate change
  useEffect(() => {
    if (formData.planType && formData.startDate) {
      handleCalculateAmount();
    }
  }, [formData.planType, formData.startDate]);

  const handleCalculateAmount = async () => {
    if (!formData.planType || !formData.startDate) {
      return;
    }

    try {
      setCalculateLoading(true);
      const result = await calculateManualOrderAmount(
        formData.planType,
        formData.startDate
      );
      setFormData(prev => ({ ...prev, amount: result.amount || 0 }));
    } catch (error) {
      console.error('Calculate error:', error);
      addToast('Failed to calculate amount: ' + error.message, 'error');
    } finally {
      setCalculateLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.amount || formData.amount <= 0) {
      addToast('Please fill all required fields and calculate amount', 'error');
      return;
    }

    try {
      setLoading(true);
      await addManualCustomer(formData);
      addToast('Manual customer added successfully!', 'success');
      setFormData({
        name: '',
        phone: '',
        planType: 'weekly',
        startDate: '',
        paymentMethod: 'Cash',
        amount: 0,
        deliveryPincode: '',
        mealPreference: 'Regular'
      });
      fetchManualCustomers();
      setShowForm(false);
    } catch (error) {
      console.error('Submit error:', error);
      addToast('Failed to add customer: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (manualCustomers.length === 0) {
      addToast('No manual customers to export', 'warning');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.text(`${vendorProfile?.kitchenName || 'Kitchen'} - Manual Customers Report`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 35);
    doc.text(`Total Customers: ${manualCustomers.length}`, 14, 45);

    // Table
    const tableColumn = ['Name', 'Phone', 'Plan', 'Start Date', 'Amount', 'Payment'];
   const tableRows = manualCustomers.map(cust => [
      cust.name || cust.manualCustomerName,
      cust.phone || cust.manualCustomerPhone,
      cust.planType,
      new Date(cust.startDate).toLocaleDateString('en-IN'),
      `₹${cust.amount?.toFixed(2) || '0.00'}`,
      cust.paymentMethod || 'Cash'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [242, 101, 34], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [244, 247, 254] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30 }
      }
    });

    // Total
    const finalY = doc.lastAutoTable.finalY + 10;
    const totalAmount = manualCustomers.reduce((sum, cust) => sum + (cust.amount || 0), 0);
    doc.setFontSize(14);
    doc.text(`Grand Total: ₹${totalAmount.toFixed(2)}`, 14, finalY);

    doc.save(`Manual_Customers_${vendorProfile?.kitchenName || 'Kitchen'}_${Date.now()}.pdf`);
  };

  const toggleForm = () => setShowForm(!showForm);

  return (
    <div className="v-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h3 style={{ margin: 0, color: '#2b3674' }}>➕ Manual / Offline Customers</h3>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={toggleForm} 
            style={{ 
              padding: '10px 20px', 
              borderRadius: '8px', 
              border: '1px solid #f26522', 
              background: showForm ? '#f26522' : '#fff', 
              color: showForm ? 'white' : '#f26522',
              cursor: 'pointer'
            }}
          >
            {showForm ? 'Cancel' : '➕ Add New'}
          </button>
          {manualCustomers.length > 0 && (
            <button 
              onClick={handleDownloadPDF}
              style={{ 
                background: '#16a34a', 
                color: 'white', 
                border: 'none', 
                padding: '10px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer' 
              }}
            >
              📥 PDF Export
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ color: '#2b3674', marginBottom: '20px' }}>Add Manual Customer</h4>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Customer Name *</label>
              <input
                type="text"
                className="v-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full Name"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Phone *</label>
              <input
                type="tel"
                className="v-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="98XXXXXXXX"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Plan Type *</label>
              <select
                className="v-input"
                value={formData.planType}
                onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                required
              >
                <option value="trial">Trial</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Start Date *</label>
              <input
                type="date"
                className="v-input"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Delivery Pincode</label>
              <input
                type="text"
                className="v-input"
                value={formData.deliveryPincode}
                onChange={(e) => setFormData({ ...formData, deliveryPincode: e.target.value })}
                placeholder="400001"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Meal Preference</label>
              <select
                className="v-input"
                value={formData.mealPreference}
                onChange={(e) => setFormData({ ...formData, mealPreference: e.target.value })}
              >
                <option value="Regular">Regular</option>
                <option value="Jain">Jain</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Payment Method</label>
              <select
                className="v-input"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '15px', alignItems: 'end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Amount *</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="v-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    style={{ flex: 1 }}
                    required
                  />
                  <span style={{ fontWeight: '600', color: '#f26522' }}>₹</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCalculateAmount}
                  disabled={calculateLoading}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: calculateLoading ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {calculateLoading ? 'Calculating...' : 'Calculate'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {loading ? 'Adding...' : 'Add Customer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Manual Customers List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4 style={{ margin: 0, color: '#2b3674' }}>Manual Customers ({manualCustomers.length})</h4>
          {manualCustomers.length > 0 && (
            <button 
              onClick={handleDownloadPDF}
              style={{ 
                background: '#f26522', 
                color: 'white', 
                border: 'none', 
                padding: '10px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📥 Export PDF
            </button>
          )}
        </div>
        {manualCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>📝 No manual customers yet</p>
            <p>Click "➕ Add New" above to add your first offline customer</p>
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="v-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Plan</th>
                  <th>Start Date</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Pincode</th>
                  <th>Meal Pref</th>
                </tr>
              </thead>
              <tbody>
                {manualCustomers.map((customer, index) => (
                  <tr key={customer._id || index}>
                   
                    <td   style={{ fontWeight: '600' }}>{customer.name || customer.manualCustomerName}</td>
                    <td>{customer.phone || customer.manualCustomerPhone}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        background: customer.planType === 'trial' ? '#fef3c7' : customer.planType === 'weekly' ? '#dbeafe' : '#dcfce7',
                        color: customer.planType === 'trial' ? '#d97706' : customer.planType === 'weekly' ? '#1d4ed8' : '#16a34a',
                        fontSize: '12px', 
                        fontWeight: '600' 
                      }}>
                        {customer.planType?.toUpperCase()}
                      </span>
                    </td>
                    <td>{new Date(customer.startDate).toLocaleDateString('en-IN')}</td>
                    <td style={{ fontWeight: '600', color: '#f26522' }}>₹{customer.amount?.toFixed(2) || '0.00'}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        background: customer.paymentMethod === 'UPI' ? '#dbeafe' : '#fef3c7',
                        color: customer.paymentMethod === 'UPI' ? '#1d4ed8' : '#d97706',
                        fontSize: '12px' 
                      }}>
                        {customer.paymentMethod || 'Cash'}
                      </span>
                    </td>
                    <td>{customer.deliveryPincode || '-'}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 6px', 
                        borderRadius: '8px', 
                        background: customer.mealPreference === 'Jain' ? '#fef3c7' : '#dcfce7',
                        color: customer.mealPreference === 'Jain' ? '#d97706' : '#16a34a',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        {customer.mealPreference || 'Regular'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddManualCustomer;
