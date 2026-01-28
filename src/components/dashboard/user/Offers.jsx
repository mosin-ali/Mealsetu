import React from 'react';
import './Offers.css';

const Offers = ({ offersList, onCopyCode }) => {
  return (
    <div className="offers-grid">
      {offersList.map((offer, idx) => (
        <div key={idx} className={`offer-card ${offer.color === '#f26522' ? 'orange-border' : offer.color === '#16a34a' ? 'green-border' : 'gray-border'}`}>
          <span className="offer-tag" style={{ background: offer.color }}>{offer.tag}</span>
          <h2 style={{ color: offer.color, margin: '0 0 10px 0' }}>{offer.code}</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>{offer.desc}</p>
          <button
            className="btn-primary copy-btn"
            style={{ background: offer.color, width: 'auto', padding: '8px 20px', fontSize: '13px' }}
            onClick={() => onCopyCode(offer.code)}
          >
            Copy Code
          </button>
        </div>
      ))}
    </div>
  );
};

export default Offers;
