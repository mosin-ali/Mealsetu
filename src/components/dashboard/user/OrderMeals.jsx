import React from 'react';
import './OrderMeals.css';

const OrderMeals = ({ tiffins, onOrder, onViewReviews, onWriteReview }) => {
  return (
    <div className="order-meals-grid">
      {tiffins.map((t, i) => (
        <div key={i} className="meal-card">
          <div className="fssai-badge">FSSAI: {t.fssai}</div>
          <div className="meal-icon">🍱</div>
          <h3>{t.name}</h3>
          <p className="meal-type">{t.type} • ⭐ {t.rating}</p>
          <button
            className="view-reviews-link"
            onClick={() => onViewReviews(t)}
          >
            View {t.reviews.length} Reviews
          </button>
          <div className="meal-details">
            <div>{t.workingDays}</div>
            <div>{t.timings}</div>
          </div>
          <h4 className="meal-price">₹{t.price} / meal</h4>
          <button className="btn-primary order-btn" onClick={() => onOrder(t)}>Order Now</button>
          <button className="write-review-btn" onClick={() => onWriteReview(t)}>Write Review</button>
        </div>
      ))}
    </div>
  );
};

export default OrderMeals;
