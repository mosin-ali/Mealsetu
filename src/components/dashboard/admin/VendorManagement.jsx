import React, { useState } from 'react';
import { Eye, CheckCircle, XCircle } from 'lucide-react';
import './VendorManagement.css';

const VendorManagement = ({ onVendorApproved }) => {
  const [vendorRequests, setVendorRequests] = useState([
    {
      id: 1,
      name: 'Annapurna Kitchen',
      email: 'annapurna@example.com',
      fssai: '12456789012345',
      phone: '+91 9876543210',
      documents: { fssai: true, idProof: true, address: false },
      submittedDate: '2024-01-15'
    },
    {
      id: 2,
      name: 'Tasty Bites',
      email: 'tasty@example.com',
      fssai: '98765432109876',
      phone: '+91 8765432109',
      documents: { fssai: true, idProof: true, address: true },
      submittedDate: '2024-01-18'
    },
    {
      id: 3,
      name: 'Healthy Eats',
      email: 'healthy@example.com',
      fssai: '11223344556677',
      phone: '+91 7654321098',
      documents: { fssai: false, idProof: true, address: true },
      submittedDate: '2024-01-20'
    }
  ]);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Filter requests that have ID proof uploaded
  const filteredRequests = vendorRequests.filter(request => request.documents.idProof);

  const handleApprove = (vendorId) => {
    const approvedVendor = vendorRequests.find(v => v.id === vendorId);
    if (approvedVendor && onVendorApproved) {
      // Add to UserManagement records
      onVendorApproved({
        id: approvedVendor.id,
        name: approvedVendor.name,
        email: approvedVendor.email,
        phone: approvedVendor.phone,
        status: true, // Active by default
        joinDate: new Date().toLocaleDateString(),
        lastLogin: 'Never'
      });

      // Remove from requests
      setVendorRequests(vendorRequests.filter(v => v.id !== vendorId));
      alert(`Vendor ${approvedVendor.name} approved and added to User Management!`);
    }
  };

  const handleReject = (vendorId) => {
    const rejectedVendor = vendorRequests.find(v => v.id === vendorId);
    setVendorRequests(vendorRequests.filter(v => v.id !== vendorId));
    alert(`Vendor ${rejectedVendor.name} request rejected!`);
  };

  const openDocumentModal = (vendor) => {
    setSelectedVendor(vendor);
    setShowDocumentModal(true);
  };

  return (
    <div className="vendor-management">
      <div className="header">
        <h1>Vendor Registration Requests</h1>
        <span>System Online</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>{filteredRequests.length}</h3>
          <p>Pending Requests</p>
        </div>
        <div className="stat-card">
          <h3>{filteredRequests.filter(r => r.documents.fssai).length}</h3>
          <p>With FSSAI</p>
        </div>
        <div className="stat-card">
          <h3>{filteredRequests.filter(r => r.documents.address).length}</h3>
          <p>With Address Proof</p>
        </div>
        <div className="stat-card">
          <h3>{vendorRequests.length - filteredRequests.length}</h3>
          <p>Missing ID Proof</p>
        </div>
      </div>

      <div className="table-container">
        <table className="vendors-table">
          <thead>
            <tr>
              <th>Vendor Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>FSSAI Number</th>
              <th>Submitted Date</th>
              <th>Documents</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.name}</td>
                <td>{request.email}</td>
                <td>{request.phone}</td>
                <td>{request.fssai}</td>
                <td>{request.submittedDate}</td>
                <td>
                  <div className="document-status">
                    <span className={`doc-badge ${request.documents.fssai ? 'verified' : 'missing'}`}>
                      FSSAI
                    </span>
                    <span className="doc-badge verified">ID Proof</span>
                    <span className={`doc-badge ${request.documents.address ? 'verified' : 'missing'}`}>
                      Address
                    </span>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="approve-btn"
                      onClick={() => handleApprove(request.id)}
                    >
                      <CheckCircle size={16} />
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => handleReject(request.id)}
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                    <button
                      className="view-btn"
                      onClick={() => openDocumentModal(request)}
                    >
                      <Eye size={16} />
                      View Docs
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDocumentModal && selectedVendor && (
        <div className="modal-overlay">
          <div className="document-modal">
            <div className="modal-header">
              <h2>Document Verification - {selectedVendor.name}</h2>
              <button
                className="close-btn"
                onClick={() => setShowDocumentModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="document-list">
                <div className="document-item">
                  <div className="document-info">
                    <h4>FSSAI Certificate</h4>
                    <p>Food Safety License</p>
                    <span className={`status ${selectedVendor.documents.fssai ? 'verified' : 'missing'}`}>
                      {selectedVendor.documents.fssai ? 'Uploaded' : 'Not Uploaded'}
                    </span>
                  </div>
                </div>

                <div className="document-item">
                  <div className="document-info">
                    <h4>ID Proof</h4>
                    <p>Aadhaar/PAN/Driving License</p>
                    <span className="status verified">Uploaded</span>
                  </div>
                </div>

                <div className="document-item">
                  <div className="document-info">
                    <h4>Address Proof</h4>
                    <p>Utility Bill/Property Document</p>
                    <span className={`status ${selectedVendor.documents.address ? 'verified' : 'missing'}`}>
                      {selectedVendor.documents.address ? 'Uploaded' : 'Not Uploaded'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;
