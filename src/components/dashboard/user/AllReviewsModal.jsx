import React from 'react';
import './AllReviewsModal.css';

const AllReviewsModal = ({ vendor, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Reviews for {vendor?.name}</h3>
        <div className="reviews-list">
          {vendor?.reviews.map((rev, idx) => (
            <div key={idx} className="review-item">
              <div className="review-header">
                <span className="review-user">{rev.user}</span>
                <span className="review-rating">{"⭐".repeat(rev.stars)}</span>
              </div>
              <p className="review-comment">{rev.comment}</p>
            </div>
          ))}
        </div>
        <button className="btn-primary close-btn" onClick={onClose}>Close Reviews</button>
      </div>
    </div>
  );
};

export default AllReviewsModal;
