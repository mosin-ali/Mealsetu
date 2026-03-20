import React, { useState, useEffect } from 'react';
import './AllReviewsModal.css';
import { getUserVendorReviews, getUserVendorRating } from '../../../utils/api';

const AllReviewsModal = ({ vendor, onClose }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingInfo, setRatingInfo] = useState({ rating: 0, reviewCount: 0 });

  useEffect(() => {
    fetchReviews();
    fetchRating();
  }, [vendor]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const vendorId = vendor?.vendorId || vendor?._id || vendor?.id;
      if (vendorId) {
        const data = await getUserVendorReviews(vendorId);
        setReviews(data || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRating = async () => {
    try {
      const vendorId = vendor?.vendorId || vendor?._id || vendor?.id;
      if (vendorId) {
        const data = await getUserVendorRating(vendorId);
        setRatingInfo({
          rating: data?.rating || 0,
          reviewCount: data?.reviewCount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching rating:', error);
    }
  };

  const renderStars = (rating) => {
    return '⭐'.repeat(rating);
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return '#16a34a';
    if (rating >= 3) return '#d97706';
    return '#dc2626';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content reviews-modal">
        <h3 className="modal-title">
          Reviews for {vendor?.name || 'Partner Kitchen'}
        </h3>

        {/* Rating Summary */}
        {!loading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px', 
            marginBottom: '20px',
            padding: '15px',
            background: '#f8fafc',
            borderRadius: '10px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                color: '#f26522' 
              }}>
                {ratingInfo.rating || 0}
              </span>
              <div style={{ color: '#f59e0b', fontSize: '16px' }}>
                {renderStars(Math.round(ratingInfo.rating || 0))}
              </div>
              <small style={{ color: '#64748b' }}>
                {ratingInfo.reviewCount || 0} reviews
              </small>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: '#16a34a', fontWeight: '600', fontSize: '14px' }}>
                ✓ Verified Reviews
              </p>
              {/* <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Sorted by rating (Excellent first)
              </p> */}
            </div>
          </div>
        )}

        <div className="reviews-list">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              Loading reviews...
            </div>
          ) : reviews.length > 0 ? (
            reviews.map((rev, idx) => (
              <div key={rev._id || idx} className="review-item">
                <div className="review-header">
                  <div>
                    <span className="review-user">
                      {rev.user || 'Anonymous'}
                    </span>
                    <span className="review-date" style={{ marginLeft: '10px', fontSize: '12px', color: '#64748b' }}>
                      {rev.date}
                    </span>
                  </div>
                  <span 
                    className="review-rating" 
                    style={{ 
                      backgroundColor: rev.rating >= 4 ? '#dcfce7' : rev.rating <= 2 ? '#fee2e2' : '#fef3c7',
                      color: getRatingColor(rev.rating),
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}
                  >
                    {renderStars(rev.rating)} {rev.rating}/5
                  </span>
                </div>
                {rev.comment && (
                  <p className="review-comment">{rev.comment}</p>
                )}
              </div>
            ))
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              color: '#64748b' 
            }}>
              <p style={{ fontSize: '18px' }}>📝 No reviews yet</p>
              <p>Be the first to review this kitchen!</p>
            </div>
          )}
        </div>
        
        <button className="btn-primary close-btn" onClick={onClose}>
          Close Reviews
        </button>
      </div>
    </div>
  );
};

export default AllReviewsModal;

