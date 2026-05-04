import React, { useState, useEffect } from 'react';
import { FiClock, FiMail, FiUser, FiPhone } from 'react-icons/fi';
import { FaFacebook, FaTwitter } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminContact, setAdminContact] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState('user');

  useEffect(() => {
    fetch('/api/admin/public-contact')
      .then(response => response.json())
      .then(setAdminContact)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleTrialClick = () => {
    localStorage.setItem('trialIntent', 'true');
  };
  
  // Add this useEffect inside the component after the other useEffects
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('.animate-on-scroll').forEach((el) => {
    observer.observe(el);
  });

  return () => observer.disconnect();
}, [isLoading]);

  if (isLoading) {
    return (
      <div className="loader-screen">
        <div className="loader-content">
          <div className="loader-logo">
            <span className="loader-icon">🍱</span>
            <h1 className="loader-brand">MealSetu</h1>
          </div>
          <div className="loader-bar-wrap">
            <div className="loader-bar"></div>
          </div>
          <p className="loader-text">Serving fresh meals in Navsari...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-wrapper">

      {/* SIDEBAR */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={toggleSidebar}>
        <div className="sidebar-menu" onClick={(e) => e.stopPropagation()}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <span>🍱</span>
              <h2>MealSetu</h2>
            </div>
            <button className="close-btn" onClick={toggleSidebar}>&times;</button>
          </div>
          <ul className="sidebar-links">
            <li><a href="#home" onClick={toggleSidebar}>🏠 Home</a></li>
            <li><a href="#how-it-works" onClick={toggleSidebar}>⚙️ How It Works</a></li>
            <li><a href="#for-users" onClick={toggleSidebar}>👤 For Users</a></li>
            <li><a href="#for-vendors" onClick={toggleSidebar}>🍳 For Vendors</a></li>
            <li><a href="#contact" onClick={toggleSidebar}>📞 Contact</a></li>
            <li className="sidebar-divider"></li>
            <li><Link to="/login" onClick={toggleSidebar}>🔐 Login</Link></li>
            <li><Link to="/register" onClick={toggleSidebar}>📝 Register</Link></li>
            <li>
              <Link to="/login" className="sidebar-trial-btn"
                onClick={() => { handleTrialClick(); toggleSidebar(); }}>
                🎉 Start Free Trial
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="landing-nav">
        <div className="logo-section">
          <button className="menu-toggle-btn" onClick={toggleSidebar}>☰</button>
          <div className="nav-brand">
            <span>🍱</span>
            <h2 className="brand-name">MealSetu</h2>
          </div>
        </div>
        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#for-users">For Users</a>
          <a href="#for-vendors">For Vendors</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-actions">
          <Link to="/login" className="nav-login-btn">Login</Link>
          <Link to="/register" className="nav-register-btn" onClick={handleTrialClick}>Get Started</Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section id="home" className="hero-section">
        <div className="hero-bg-gradient"></div>
        <div className="hero-floating-shapes">
          <div className="shape shape-1">🍛</div>
          <div className="shape shape-2">🥘</div>
          <div className="shape shape-3">🍲</div>
          <div className="shape shape-4">🫕</div>
        </div>
        <div className="hero-content">
          <div className="hero-badge animate-fade-up">
            <span className="badge-dot"></span>
            Now serving in Navsari City
          </div>
          <h1 className="hero-title animate-fade-up delay-1">
            Fresh Home-Cooked<br />
            <span className="hero-highlight">Tiffin Meals</span><br />
            At Your Doorstep
          </h1>
          <p className="hero-subtitle animate-fade-up delay-2">
            Connect with trusted local kitchen vendors in Navsari.
            Subscribe to daily, weekly, or monthly tiffin plans and
            enjoy nutritious home-style meals every day.
          </p>
          <div className="hero-role-toggle animate-fade-up delay-3">
            <button
              className={`role-btn ${activeRole === 'user' ? 'active' : ''}`}
              onClick={() => setActiveRole('user')}
            >
              👤 I want to order
            </button>
            <button
              className={`role-btn ${activeRole === 'vendor' ? 'active' : ''}`}
              onClick={() => setActiveRole('vendor')}
            >
              🍳 I am a vendor
            </button>
          </div>

          {activeRole === 'user' ? (
            <div className="hero-cta animate-fade-up delay-4">
              <Link to="/login" className="cta-primary" onClick={handleTrialClick}>
                🎉 Try 2 Days Free
              </Link>
              <a href="#for-users" className="cta-secondary">
                See How It Works →
              </a>
            </div>
          ) : (
            <div className="hero-cta animate-fade-up delay-4">
              <Link to="/register" className="cta-primary vendor-cta">
                🚀 Join as Vendor
              </Link>
              <a href="#for-vendors" className="cta-secondary">
                Learn More →
              </a>
            </div>
          )}

   <div className="hero-stats animate-fade-up delay-5">
  <div className="hero-stat">
    <h3>Navsari</h3>
    <p>📍 City We Serve</p>
  </div>
  <div className="stat-divider"></div>
  <div className="hero-stat">
    <h3>₹80+</h3>
    <p>Starting Price/Day</p>
  </div>
  <div className="stat-divider"></div>
  <div className="hero-stat">
    <h3>Daily</h3>
    <p>Fresh Meals</p>
  </div>
  <div className="stat-divider"></div>
  <div className="hero-stat">
    <h3>Free</h3>
    <p>2 Day Trial</p>
  </div>
</div>
        </div>

        <div className="hero-scroll-hint">
          <div className="scroll-mouse">
            <div className="scroll-wheel"></div>
          </div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="how-section">
        <div className="section-header">
          <span className="section-tag">Simple Process</span>
          <h2 className="section-heading">How MealSetu Works</h2>
          <p className="section-sub">Get started in just 3 simple steps</p>
        </div>
        <div className="steps-grid">
          <div className="step-card animate-on-scroll">
            <div className="step-number">01</div>
            <div className="step-icon">📱</div>
            <h3>Register & Browse</h3>
            <p>Sign up for free and browse local kitchen vendors available in your area of Navsari.</p>
            <div className="step-arrow">→</div>
          </div>
          <div className="step-card animate-on-scroll delay-1">
            <div className="step-number">02</div>
            <div className="step-icon">🍱</div>
            <h3>Choose Your Plan</h3>
            <p>Pick from daily, weekly, or monthly tiffin subscription plans that fit your budget.</p>
            <div className="step-arrow">→</div>
          </div>
          <div className="step-card animate-on-scroll delay-2">
            <div className="step-number">03</div>
            <div className="step-icon">✅</div>
            <h3>Enjoy Fresh Meals</h3>
            <p>Your vendor prepares fresh home-cooked meals and delivers them right to you daily.</p>
            <div className="step-arrow last"></div>
          </div>
        </div>
      </section>

      {/* FOR USERS SECTION */}
      <section id="for-users" className="users-section">
        <div className="split-section">
          <div className="split-visual">
            <div className="visual-card-stack">
  <div className="visual-card vc-1">
    <span>🍛</span>
    <div>
      <strong>Today's Tiffin</strong>
      <p>Dal + Roti + Rice + Sabji</p>
    </div>
  </div>
  <div className="visual-card vc-2">
    <span>📅</span>
    <div>
      <strong>Flexible Plans</strong>
      <p>Daily · Weekly · Monthly</p>
    </div>
  </div>
  <div className="visual-card vc-3">
    <span>📍</span>
    <div>
      <strong>Serving Navsari</strong>
      <p>Local kitchens near you</p>
    </div>
  </div>
  <div className="visual-bg-circle"></div>
</div>
          </div>
          <div className="split-content">
            <span className="section-tag user-tag">👤 For Food Lovers</span>
            <h2 className="section-heading left-heading">Order Tiffin From<br />Local Kitchens</h2>
            <p className="split-desc">
              Tired of eating outside food every day? MealSetu connects you directly
              with home kitchen vendors in Navsari who cook fresh, hygienic, and
              nutritious meals just like your mom makes.
            </p>
            <div className="feature-list">
              <div className="feature-list-item">
                <div className="fli-icon">🗓️</div>
                <div>
                  <h4>Flexible Subscription Plans</h4>
                  <p>Choose daily, weekly, or monthly plans. Pause anytime.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="fli-icon">🏠</div>
                <div>
                  <h4>Home Style Cooking</h4>
                  <p>Fresh meals cooked by local home kitchen vendors daily.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="fli-icon">🌿</div>
                <div>
                  <h4>Regular & Jain Options</h4>
                  <p>Choose regular or Jain meal preference per your needs.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="fli-icon">💰</div>
                <div>
                  <h4>Affordable Pricing</h4>
                  <p>Starts from just ₹80 per day. Much cheaper than restaurants.</p>
                </div>
              </div>
            </div>
            <Link to="/login" className="cta-primary" onClick={handleTrialClick}>
              🎉 Try Free for 2 Days
            </Link>
          </div>
        </div>
      </section>

      {/* FOR VENDORS SECTION */}
      <section id="for-vendors" className="vendors-section">
        <div className="split-section reverse">
          <div className="split-content">
            <span className="section-tag vendor-tag">🍳 For Kitchen Owners</span>
            <h2 className="section-heading left-heading">Grow Your Kitchen<br />Business Digitally</h2>
            <p className="split-desc">
              Are you running a home kitchen or tiffin service in Navsari?
              MealSetu gives you a complete digital platform to manage your
              daily operations, customers, and orders without any manual work.
            </p>
            <div className="feature-list">
              <div className="feature-list-item">
                <div className="fli-icon vendor-icon">📊</div>
                <div>
                  <h4>Dashboard & Analytics</h4>
                  <p>Track orders, revenue, and customers from one place.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="fli-icon vendor-icon">📋</div>
                <div>
                  <h4>Weekly Menu Planner</h4>
                  <p>Plan your 7-day menu schedule in advance easily.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="fli-icon vendor-icon">👥</div>
                <div>
                  <h4>Customer Management</h4>
                  <p>Add manual customers and manage offline subscriptions.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="fli-icon vendor-icon">📄</div>
                <div>
                  <h4>PDF Reports</h4>
                  <p>Download payment reports and invoices with one click.</p>
                </div>
              </div>
            </div>
            <Link to="/register" className="cta-primary vendor-cta">
              🚀 Register Your Kitchen
            </Link>
          </div>
          <div className="split-visual">
<div className="vendor-dashboard-preview">
  <div className="vdp-header">
    <span className="vdp-dot red"></span>
    <span className="vdp-dot yellow"></span>
    <span className="vdp-dot green"></span>
    <span className="vdp-title">MealSetu Vendor Portal</span>
  </div>

  <div className="vdp-kitchen-bar">
    <span className="status-open">● Kitchen is Open</span>
    <button className="status-btn">Close Shop</button>
  </div>

  <div className="vdp-stats">
    <div className="vdp-stat">
      <p>Total Revenue</p>
      <h3>₹2,429</h3>
    </div>
    <div className="vdp-stat">
      <p>Orders Today</p>
      <h3>4</h3>
    </div>
    <div className="vdp-stat">
      <p>Active Users</p>
      <h3>8</h3>
    </div>
  </div>

  <div className="vdp-section-label">TODAY'S PREPARATION</div>
  <div className="vdp-prep-list">
    <div className="vdp-prep-item">
      <span>Regular Thali</span>
      <span className="vdp-prep-count">6</span>
    </div>
    <div className="vdp-prep-item">
      <span>Jain Thali</span>
      <span className="vdp-prep-count">2</span>
    </div>
    <div className="vdp-prep-item">
      <span>Veg Thali</span>
      <span className="vdp-prep-count">0</span>
    </div>
  </div>

  <div className="vdp-nav-preview">
    <span className="vdp-nav-item active-nav">Overview</span>
    <span className="vdp-nav-item">Menu Planner</span>
    <span className="vdp-nav-item">Orders</span>
    <span className="vdp-nav-item">Customers</span>
  </div>
</div>
</div>
        </div>
      </section>

      {/* PLANS SECTION */}
<div className="plans-grid">
  <div className="plan-card animate-on-scroll">
    <div className="plan-icon">☀️</div>
    <h3>Daily Plan</h3>
    <div className="plan-price">
      <span className="price-from">starting from</span>
    </div>
    <div className="plan-starting">₹80<span>/day</span></div>
    <p className="plan-note">Vendor sets final price</p>
    <ul className="plan-features">
      <li>✓ 1 fresh meal per day</li>
      <li>✓ Regular or Jain option</li>
      <li>✓ Pay as you go</li>
      <li>✓ No long commitment</li>
    </ul>
    <Link to="/login" className="plan-btn" onClick={handleTrialClick}>Get Started</Link>
  </div>
  <div className="plan-card featured animate-on-scroll delay-1">
    <div className="plan-popular">Most Popular</div>
    <div className="plan-icon">📅</div>
    <h3>Weekly Plan</h3>
    <div className="plan-price">
      <span className="price-from">starting from</span>
    </div>
    <div className="plan-starting">₹500<span>/week</span></div>
    <p className="plan-note" style={{color: 'rgba(255,255,255,0.7)'}}>Vendor sets final price</p>
    <ul className="plan-features">
      <li>✓ 7 meals per week</li>
      <li>✓ Regular or Jain option</li>
      <li>✓ Better value than daily</li>
      <li>✓ Pause anytime</li>
    </ul>
    <Link to="/login" className="plan-btn featured-btn" onClick={handleTrialClick}>Get Started</Link>
  </div>
  <div className="plan-card animate-on-scroll delay-2">
    <div className="plan-icon">🗓️</div>
    <h3>Monthly Plan</h3>
    <div className="plan-price">
      <span className="price-from">starting from</span>
    </div>
    <div className="plan-starting">₹1800<span>/month</span></div>
    <p className="plan-note">Vendor sets final price</p>
    <ul className="plan-features">
      <li>✓ Daily meals all month</li>
      <li>✓ Regular or Jain option</li>
      <li>✓ Best value plan</li>
      <li>✓ Leave management included</li>
    </ul>
    <Link to="/login" className="plan-btn" onClick={handleTrialClick}>Get Started</Link>
  </div>
</div>
          {/* <div className="plan-card featured animate-on-scroll delay-1">
            <div className="plan-popular">Most Popular</div>
            <div className="plan-icon">📅</div>
            <h3>Weekly Plan</h3>
            <div className="plan-price">
              <span className="price-from">from</span>
              <span className="price-amount">₹500</span>
              <span className="price-per">/week</span>
            </div>
            <ul className="plan-features">
              <li>✓ 7 meals per week</li>
              <li>✓ Regular or Jain</li>
              <li>✓ Save vs daily</li>
              <li>✓ Pause anytime</li>
            </ul>
            <Link to="/login" className="plan-btn featured-btn" onClick={handleTrialClick}>Get Started</Link>
          </div>
          <div className="plan-card animate-on-scroll delay-2">
            <div className="plan-icon">🗓️</div>
            <h3>Monthly Plan</h3>
            <div className="plan-price">
              <span className="price-from">from</span>
              <span className="price-amount">₹1800</span>
              <span className="price-per">/month</span>
            </div>
            <ul className="plan-features">
              <li>✓ Daily meals all month</li>
              <li>✓ Regular or Jain</li>
              <li>✓ Best value</li>
              <li>✓ Leave management</li>
            </ul>
            <Link to="/login" className="plan-btn" onClick={handleTrialClick}>Get Started</Link>
          </div>
        </div>
      </section> */}

      {/* WHY MEALSETU */}
      <section className="why-section">
        <div className="section-header">
          <span className="section-tag">Why Choose Us</span>
          <h2 className="section-heading">Why MealSetu?</h2>
        </div>
        <div className="why-grid">
          <div className="why-card animate-on-scroll">
            <div className="why-icon">🏙️</div>
            <h3>Navsari Focused</h3>
            <p>We operate exclusively in Navsari ensuring quality and reliability for local customers and vendors.</p>
          </div>
          <div className="why-card animate-on-scroll delay-1">
            <div className="why-icon">✅</div>
            <h3>Verified Kitchens</h3>
            <p>All vendors are FSSAI verified and approved by our admin team before they can serve customers.</p>
          </div>
          <div className="why-card animate-on-scroll delay-2">
            <div className="why-icon">🌿</div>
            <h3>Jain Menu Available</h3>
            <p>Many vendors offer dedicated Jain menu options with no onion and garlic for Jain customers.</p>
          </div>
          <div className="why-card animate-on-scroll delay-3">
            <div className="why-icon">⏸️</div>
            <h3>Pause Anytime</h3>
            <p>Going out of town? Pause your subscription easily and your plan will extend automatically.</p>
          </div>
          <div className="why-card animate-on-scroll">
            <div className="why-icon">💳</div>
            <h3>Easy Payments</h3>
            <p>Pay via cash or UPI directly to your vendor. Simple and transparent payment process.</p>
          </div>
          <div className="why-card animate-on-scroll delay-1">
            <div className="why-icon">⭐</div>
            <h3>Review System</h3>
            <p>Rate and review your vendor after ordering. Helps maintain quality across all kitchens.</p>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section id="contact" className="contact-section">
        <div className="section-header">
          <span className="section-tag">Get In Touch</span>
          <h2 className="section-heading">Contact Us</h2>
          <p className="section-sub">We are based in Navsari. Reach out anytime.</p>
        </div>
        <div className="contact-card">
          <div className="contact-details-grid">
            <div className="contact-item">
              <FiClock className="contact-icon" />
              <div>
                <div className="contact-label">Available Hours</div>
                <div className="contact-value">9 AM to 9 PM<br />Monday to Saturday</div>
              </div>
            </div>
            <div className="contact-item">
              <FiMail className="contact-icon" />
              <div>
                <div className="contact-label">Contact Email</div>
                <div className="contact-value">
                  <a href={`mailto:${adminContact?.email || 'support@mealsetu.com'}`} className="mailto-link">
                    {adminContact?.email || 'support@mealsetu.com'}
                  </a>
                </div>
              </div>
            </div>
            {adminContact?.name && (
              <div className="contact-item">
                <FiUser className="contact-icon" />
                <div>
                  <div className="contact-label">Contact Person</div>
                  <div className="contact-value">{adminContact.name}</div>
                </div>
              </div>
            )}
            {adminContact?.phone && (
              <div className="contact-item">
                <FiPhone className="contact-icon" />
                <div>
                  <div className="contact-label">Phone</div>
                  <div className="contact-value">{adminContact.phone}</div>
                </div>
              </div>
            )}
          </div>
          <div className="contact-divider"></div>
          <div className="social-section">
            <h3 className="social-heading">Connect With Us</h3>
            <div className="social-buttons">
              <button className="social-btn facebook" onClick={() => window.open('https://www.facebook.com', '_blank')}>
                <FaFacebook /> Facebook
              </button>
              <button className="social-btn twitter" onClick={() => window.open('https://www.twitter.com', '_blank')}>
                <FaTwitter /> Twitter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>🍱</span>
            <h3>MealSetu</h3>
            <p>Fresh tiffin meals in Navsari</p>
          </div>
          <div className="footer-links">
            <a href="#home">Home</a>
            <a href="#for-users">For Users</a>
            <a href="#for-vendors">For Vendors</a>
            <a href="#contact">Contact</a>
            <Link to="/login">Login</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 MealSetu | MCA Sem-2 Project | Navsari, Gujarat</p>
        </div>
      </footer>

    </div>
  );
}