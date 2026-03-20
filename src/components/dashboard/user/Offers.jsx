import React, { useState } from 'react';
import './Offers.css';

const FALLBACK_IMAGE = 'https://via.placeholder.com/400x200?text=No+Image+Available';

const Offers = ({ activeOffers, offersLoading, offersError, onRedeemOffer, claimedOfferIds = [] }) => {
  const [redeemingOfferId, setRedeemingOfferId] = useState(null);
  
  const handleImageError = (e) => {
    e.target.src = FALLBACK_IMAGE;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatStartDateForBadge = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDiscountedPrice = (planName, discountPercentage) => {
    const PLAN_PRICES = { 'One Day': 80, 'Weekly': 560, 'Monthly': 2000 };
    const originalPrice = PLAN_PRICES[planName] || 80;
    return Math.round(originalPrice * (1 - discountPercentage / 100));
  };

  const getOriginalPrice = (planName) => {
    const PLAN_PRICES = { 'One Day': 80, 'Weekly': 560, 'Monthly': 2000 };
    return PLAN_PRICES[planName] || 80;
  };

  const handleRedeemClick = (offer) => {
    // Immediately set loading state to prevent double-clicks
    setRedeemingOfferId(offer._id);
    
    const availablePlans = offer.planDiscounts.filter(p => p.discountPercentage > 0);
    if (availablePlans.length === 1) {
      onRedeemOffer(offer, availablePlans[0].planName)
        .then(() => setRedeemingOfferId(null))
        .catch(() => setRedeemingOfferId(null));
    } else {
      const planOptions = availablePlans.map(p => 
        `${p.planName}: ₹${getDiscountedPrice(p.planName, p.discountPercentage)} (${p.discountPercentage}% OFF - was ₹${getOriginalPrice(p.planName)})`
      ).join('\n');
      const choice = prompt(`Select a plan:\n${planOptions}\n\nEnter plan name (One Day, Weekly, or Monthly):`);
      if (choice) {
        const selectedPlan = availablePlans.find(p => 
          p.planName.toLowerCase() === choice.toLowerCase() || p.planName.toLowerCase().includes(choice.toLowerCase())
        );
        if (selectedPlan) {
          onRedeemOffer(offer, selectedPlan.planName)
            .then(() => setRedeemingOfferId(null))
            .catch(() => setRedeemingOfferId(null));
        } else {
          alert('Invalid plan selection. Please try again.');
          setRedeemingOfferId(null);
        }
      } else {
        setRedeemingOfferId(null);
      }
    }
  };

  const handleClaimedClick = () => {};
  const handleComingSoonClick = () => {};

  if (offersLoading) {
    return (
      <div className="offers-container">
        <h2 style={{ color: '#2b3674', marginBottom: '20px' }}> Available Offers</h2>
        <div className="offers-loading">
          <div className="spinner"></div>
          <p>Loading offers...</p>
        </div>
      </div>
    );
  }

  if (offersError) {
    return (
      <div className="offers-container">
        <h2 style={{ color: '#2b3674', marginBottom: '20px' }}> Available Offers</h2>
        <div className="offers-error">
          <p>⚠️ {offersError}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '8px 20px', background: '#f26522', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Try Again</button>
        </div>
      </div>
    );
  }

  if (!activeOffers || activeOffers.length === 0) {
    return (
      <div className="offers-container">
        <h2 style={{ color: '#2b3674', marginBottom: '20px' }}> Available Offers</h2>
        <div className="offers-empty">
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎉</div>
          <h3 style={{ color: '#2b3674', marginBottom: '10px' }}>No active offers right now</h3>
          <p style={{ color: '#64748b' }}>Check back soon for exciting deals from your favorite kitchens!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="offers-container">
      <h2 style={{ color: '#2b3674', marginBottom: '20px' }}> Available Offers</h2>
      <div className="offers-grid">
        {activeOffers.map((offer, index) => {
          const isComingSoon = offer.offerStatus === 'coming-soon';
          const isClaimed = offer.isClaimedByUser === true || claimedOfferIds.includes(offer._id);
          const isRedeeming = redeemingOfferId === offer._id;
          
          return (
            <div key={offer._id || index} className={`offer-card-dynamic ${isComingSoon ? 'coming-soon' : ''} ${isClaimed ? 'claimed' : ''}`} onClick={isComingSoon ? handleComingSoonClick : (isClaimed ? handleClaimedClick : undefined)}>
              <div className="offer-image-container">
                <img src={offer.posterImage || FALLBACK_IMAGE} alt={`Offer from ${offer.kitchenName}`} onError={handleImageError} className={`offer-poster-image ${isComingSoon ? 'coming-soon' : ''} ${isClaimed ? 'claimed' : ''}`} />
                <div className="offer-vendor-badge">{offer.kitchenName || 'Partner Kitchen'}</div>
                {isClaimed && <div className="claimed-badge-overlay"><span className="claimed-badge-text">CLAIMED</span></div>}
              </div>
              <div className="offer-details">
                <div className="offer-validity">
                  <span className="validity-label">📅 Valid:</span>
                  <span className="validity-dates">{formatDate(offer.startDate)} - {formatDate(offer.endDate)}</span>
                </div>
                <div className="offer-discounts">
                  <h4 style={{ margin: '0 0 10px 0', color: '#2b3674', fontSize: '14px' }}>Discounted Plans:</h4>
                  <div className="discount-plans">
                    {offer.planDiscounts && offer.planDiscounts.map((plan, idx) => (
                      plan.discountPercentage > 0 ? (
                        <div key={idx} className="discount-plan-item">
                          <span className="plan-name">{plan.planName}</span>
                          <span className="plan-discount">{plan.discountPercentage}% OFF</span>
                          <div className="plan-prices">
                            <span className="original-price">₹{getOriginalPrice(plan.planName)}</span>
                            <span className="discounted-price">₹{getDiscountedPrice(plan.planName, plan.discountPercentage)}</span>
                          </div>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
                {isComingSoon ? (
                  <div className="coming-soon-badge">
                    <span className="coming-soon-label">Coming Soon</span>
                    <span className="coming-soon-date">Starts: {formatStartDateForBadge(offer.startDate)}</span>
                  </div>
                ) : isClaimed ? (
                  <div className="claimed-badge-new">
                    <div className="claimed-badge-content">
                      <span className="claimed-checkmark">✓</span>
                      <div className="claimed-text-group">
                        <span className="claimed-text-main">Claimed</span>
                        <span className="claimed-text-sub">You have redeemed this offer</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="redeem-btn" 
                    onClick={() => handleRedeemClick(offer)}
                    disabled={isRedeeming}
                  >
                    {isRedeeming ? 'Redeeming...' : 'Redeem Offer'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Offers;

