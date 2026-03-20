import React, { useState } from 'react';
import './ProfileModal.css';

const ProfileModal = ({ user, onSave, onClose, onPhotoChange }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [address, setAddress] = useState(user.address);
  const [pincode, setPincode] = useState(user.pincode);

  const handleSave = () => {
    // Included all fields in the save object
    onSave({ name, email, phone, address, pincode });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Profile</h3>
        
        </div>

        <div className="photo-section">
          <div className="avatar-wrapper">
            <img 
              src={user.profilePic} 
              className="avatar-main" 
              alt="User" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNlMmU4ZjAiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjU1IiByPSI0MCIgZmlsbD0iI2YzZjVmMiIvPjxwYXRoIGQ9Ik0zNSAxMzBDMzUgMTAyLjM4NCA1Mi4zODQgODAgODAgODBINzBDOTcuNjE2IDgwIDExNSAxMDIuMzg0IDExNSAxMzBWMTUwSDMzek0xMjUgMTUwaC05MG0xMjUgMGgtOTBtLTEyNSAwaC05MCIgZmlsbD0iI2U0ZThmMCIvPjwvc3ZnPg==';
              }}
            />
            <label className="upload-badge">
              <i className="camera-icon">+</i>
              <input type="file" accept="image/*" onChange={onPhotoChange} hidden />
            </label>
          </div>
          
        </div>

        <div className="modal-body">
          <div className="input-group">
            <label>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mosin Ali" />
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mosin@example.com" />
            </div>
            <div className="input-group">
              <label>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
            </div>
          </div>

          <div className="input-group">
            <label>Delivery Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Sector, Building, Flat" />
          </div>

          <div className="input-group">
            <label>Pin Code</label>
            <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="383001" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Discard</button>
          <button className="btn-save" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;