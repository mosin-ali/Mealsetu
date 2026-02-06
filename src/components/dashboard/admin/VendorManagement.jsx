import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Loader } from 'lucide-react';
import './VendorManagement.css';

const VendorManagement = ({ onVendorApproved }) => {
  const [vendorRequests, setVendorRequests] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingVendorId, setRejectingVendorId] = useState(null);

  // Fetch pending vendors on mount
  useEffect(() => {
    fetchPendingVendors();
  }, []);

  const fetchPendingVendors = async () => {
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

      if (!response.ok) {
        throw new Error('Failed to fetch vendor requests');
      }

      const data = await response.json();
      setVendorRequests(data || []);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError(err.message || 'Failed to load vendor requests');
      setVendorRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (vendorId) => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/admin/vendors/${vendorId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Approved',
          rejectionReason: ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to approve vendor');
      }

      const approvedVendor = await response.json();
      alert(`Vendor ${approvedVendor.kitchenName} approved successfully!`);
      
      // Remove from list
      setVendorRequests(vendorRequests.filter(v => v._id !== vendorId));

      if (onVendorApproved) {
        onVendorApproved(approvedVendor);
      }
    } catch (err) {
      console.error('Error approving vendor:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleRejectClick = (vendorId) => {
    setRejectingVendorId(vendorId);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/admin/vendors/${rejectingVendorId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Rejected',
          rejectionReason: rejectionReason
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reject vendor');
      }

      const rejectedVendor = vendorRequests.find(v => v._id === rejectingVendorId);
      alert(`Vendor ${rejectedVendor?.kitchenName} request rejected!`);
      
      // Remove from list
      setVendorRequests(vendorRequests.filter(v => v._id !== rejectingVendorId));
      setShowRejectModal(false);
      setRejectionReason('');
      setRejectingVendorId(null);
    } catch (err) {
      console.error('Error rejecting vendor:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const openDocumentModal = (vendor) => {
    setSelectedVendor(vendor);
    setShowDocumentModal(true);
  };

  if (loading) {
    return (
      <div className="vendor-management">
        <div className="loading-container">
          <Loader size={40} className="spinner" />
          <p>Loading vendor requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-management">
      <div className="header">
        <h1>Vendor Registration Requests</h1>
        <span>{vendorRequests.length} Pending</span>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={fetchPendingVendors}>Retry</button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>{vendorRequests.length}</h3>
          <p>Pending Requests</p>
        </div>
      </div>

      {vendorRequests.length === 0 ? (
        <div className="no-data-message">
          <p>No pending vendor requests at this time.</p>
        </div>
      ) : (
        <div className="vendor-table">
          <table>
            <thead>
              <tr>
                <th>Kitchen Name</th>
                <th>Owner</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Submitted Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendorRequests.map((vendor) => (
                <tr key={vendor._id}>
                  <td>{vendor.kitchenName}</td>
                  <td>{vendor.ownerId?.name || 'N/A'}</td>
                  <td>{vendor.ownerId?.email || 'N/A'}</td>
                  <td>{vendor.ownerId?.phone || 'N/A'}</td>
                  <td>{new Date(vendor.createdAt).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button 
                      className="btn-view"
                      onClick={() => openDocumentModal(vendor)}
                    >
                      <Eye size={16} /> View
                    </button>
                    <button 
                      className="btn-approve"
                      onClick={() => handleApprove(vendor._id)}
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button 
                      className="btn-reject"
                      onClick={() => handleRejectClick(vendor._id)}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Modal */}
      {showDocumentModal && selectedVendor && (
        <div className="modal-overlay" onClick={() => setShowDocumentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowDocumentModal(false)}>&times;</button>
            <h2>Vendor Documents - {selectedVendor.kitchenName}</h2>
            <div className="document-grid">
              <div className="document-item">
                <h4>FSSAI License</h4>
                {selectedVendor.fssaiLicense ? (
                  <a href={`/uploads/${selectedVendor.fssaiLicense}`} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                ) : (
                  <p>Not submitted</p>
                )}
              </div>
              <div className="document-item">
                <h4>GST Document</h4>
                {selectedVendor.gstDocument ? (
                  <a href={`/uploads/${selectedVendor.gstDocument}`} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                ) : (
                  <p>Not submitted</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowRejectModal(false)}>&times;</button>
            <h2>Reject Vendor Request</h2>
            <p>Please provide a reason for rejection:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows="4"
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={handleRejectSubmit}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;
