import React, { useState } from 'react';
import './ProfileSettings.css';

const ProfileSettings = ({ profile, onProfileChange, onImageUpload, onSave }) => {
  const [kitchenName, setKitchenName] = useState(profile.kitchenName);
  const [address, setAddress] = useState(profile.address);

  const handleSave = () => {
    onSave({ kitchenName, address });
  };

  return (
    <div className="profile-settings">
      <h3>Kitchen Profile Settings</h3>
      <div className="profile-form">
        <div className="form-left">
          <div className="form-group">
            <label>Kitchen Name</label>
            <input
              type="text"
              className="profile-input"
              value={kitchenName}
              onChange={(e) => setKitchenName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Complete Address</label>
            <textarea
              className="profile-input address-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>
        <div className="form-right">
          <div className="image-upload">
            {profile.image ? (
              <img src={profile.image} alt="Kitchen Preview" />
            ) : (
              <span>No Image</span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            id="imageUpload"
            hidden
            onChange={onImageUpload}
          />
          <label htmlFor="imageUpload" className="upload-btn">
            Change Image
          </label>
        </div>
      </div>
      <button className="save-btn" onClick={handleSave}>
        Save Changes
      </button>
    </div>
  );
};

export default ProfileSettings;
