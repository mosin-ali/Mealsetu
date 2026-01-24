import React from 'react';

export default function UserDashboard() {
  const tiffins = [
    { name: "Annapurna Kitchen", price: "₹80", rating: "4.8", type: "Pure Veg" },
    { name: "Mom's Magic", price: "₹100", rating: "4.9", type: "Veg/Jain" }
  ];

  return (
    <div>
      <nav className="nav-bar">
        <h2 style={{color: 'var(--primary)', fontWeight: '800'}}>MealSetu</h2>
        <button onClick={() => window.location.href='/login'} className="tag" style={{border: 'none', cursor: 'pointer'}}>Logout</button>
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
              <button className="btn-primary" style={{padding: '10px'}}>Order Now</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}