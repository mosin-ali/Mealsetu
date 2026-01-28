import React, { useState } from 'react';
import './ProfileModal.css';

const ProfileModal = ({ user, onSave, onClose, onPhotoChange }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);

  const handleSave = () => {
    onSave({ name, email, phone });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Edit Profile</h3>

        <div className="photo-upload">
          <img src={user.profilePic} className="avatar-preview" alt="Avatar Preview" />
          <label className="change-photo-label">
            Change Photo
            <input type="file" accept="image/*" className="photo-input" onChange={onPhotoChange} />
          </label>
        </div>

        <label className="input-label">Full Name</label>
        <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter Full Name" />

        <label className="input-label">Email Address</label>
        <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email" />

        <label className="input-label">Phone Number</label>
        <input type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter Phone Number" />

        <div className="modal-actions">
          <button className="btn-primary save-btn" onClick={handleSave}>Save Changes</button>
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
