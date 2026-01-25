import React from 'react';
import { useNavigate } from 'react-router-dom'; // 1. Import the hook

export default function UserDashboard() {
  const navigate = useNavigate(); // 2. Initialize the hook

  const tiffins = [
    { name: "Annapurna Kitchen", price: "₹80", rating: "4.8", type: "Pure Veg" },
    { name: "Mom's Magic", price: "₹100", rating: "4.9", type: "Veg/Jain" }
  ];

  return (
    <div>
      <nav className="nav-bar">
        <h2 style={{color: 'var(--primary)', fontWeight: '800'}}>MealSetu</h2>
        {/* Logout Button */}
        <button 
          onClick={() => window.location.href='/login'} 
          className="tag" 
          style={{border: 'none', cursor: 'pointer'}}
        >
          Logout
        </button>
      </nav>

      <div className="container">
        <h1>Available Tiffin Services</h1>
        <div className="grid">
          {tiffins.map((t, i) => (
            <div key={i} className="card">
              <div style={{fontSize: '40px', marginBottom: '10px'}}>🍱</div>
              <h3>{t.name}</h3>
              <p style={{color: '#64748b'}}>{t.type} • ⭐ {t.rating}</p>
              <h4 style={{margin: '15px 0', color: 'var(--primary)'}}>{t.price} / meal</h4>
              
              {/* 3. Updated Order Button to Navigate */}
              <button 
                className="btn-primary" 
                style={{padding: '10px'}}
                onClick={() => navigate('/order')}
              >
                Order Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}