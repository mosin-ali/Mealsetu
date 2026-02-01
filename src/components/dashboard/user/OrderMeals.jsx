import React from 'react';
import './OrderMeals.css';

const OrderMeals = ({ tiffins, onOrder, onViewReviews, onWriteReview }) => {
  return (
    <div className="order-meals-grid">
      {tiffins.map((t, i) => (
        <div key={i} className="tiffing-card">
          
          {/* 1. Header Image Section */}
          <div className="kitchen-image-wrapper">
            {/* Random kitchen images based on vendor name for demo */}
            <img 
              src={t.name === "Annapurna Kitchen" 
                ? "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500" 
                : "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=500"} 
              alt="Kitchen Header" 
            />
            <div className="rating-badge">⭐ {t.rating}</div>
          </div>

          {/* 2. Card Content */}
          <div className="card-details">
            
            {/* Vendor Name & Type */}
            <div className="vendor-header">
              <div>
                <h3 className="vendor-name">{t.name}</h3>
                <p className="vendor-type">{t.type}</p>
              </div>
              <span className="fssai-pill">FSSAI: {t.fssai}</span>
            </div>

            {/* Link to Reviews */}
            <button className="view-reviews-link" onClick={() => onViewReviews(t)}>
              View {t.reviews.length} Reviews
            </button>

            {/* Info Grid (Days/Time) */}
            <div className="info-grid">
              <div className="info-item">
                <span>Days</span>
                <strong>{t.workingDays}</strong>
              </div>
              <div className="info-item">
                <span>Timings</span>
                <strong>{t.timings}</strong>
              </div>
            </div>

            {/* Price & Action Button */}
            <div className="price-section">
              <div className="price-text">
                ₹{t.price} <small>/ meal</small>
              </div>
              <button className="modern-order-btn" onClick={() => onOrder(t)}>
                Order Now
              </button>
            </div>

            {/* Footer Link */}
            <button className="write-review-btn-link" onClick={() => onWriteReview(t)}>
              Write Review
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderMeals;