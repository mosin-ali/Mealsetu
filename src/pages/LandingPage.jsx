import React, { useState, useEffect } from 'react';
import { FiClock, FiMail, FiUser, FiPhone } from 'react-icons/fi';
import { FaFacebook, FaTwitter } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import './LandingPage.css';

// 1. Import your banner image
import heroBannerImg from './image/image.png'; 

export default function LandingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminContact, setAdminContact] = useState(null);

  useEffect(() => {
    fetch('/api/admin/public-contact')
      .then(response => response.json())
      .then(setAdminContact)
      .catch(console.error);
  }, []); 

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Handle trial button click - store intent in localStorage
  const handleTrialClick = () => {
    localStorage.setItem('trialIntent', 'true');
  };

  // 2. Define the inline style for the banner
  const bannerStyle = {
    height: '100vh',
    background: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${heroBannerImg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div className="landing-wrapper">
      {/* SIDEBAR MENU */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={toggleSidebar}>
        <div className="sidebar-menu" onClick={(e) => e.stopPropagation()}>
          <div className="sidebar-header">
            <h2 className="brand-name">MealSetu Menu</h2>
            <button className="close-btn" onClick={toggleSidebar}>&times;</button>
          </div>
          <ul className="sidebar-links">
            <li><a href="#home" onClick={toggleSidebar}>Home</a></li>
            <li><a href="#about" onClick={toggleSidebar}>About</a></li>
            <li><a href="#gallery" onClick={toggleSidebar}>Gallery</a></li>
            <li><a href="#contact" onClick={toggleSidebar}>Contact Us</a></li>
            <li className="sidebar-divider"></li>
            <li><Link to="/login" onClick={toggleSidebar}>Login / Sign In</Link></li>
            <li><Link to="/login" className="sidebar-trial-btn" onClick={handleTrialClick}>2 Days Free Trial</Link></li>
          </ul>
        </div>
      </div>

      {/* HEADER / NAV */}
      <nav className="landing-nav">
        <div className="logo-section">
          <button className="menu-toggle-btn" onClick={toggleSidebar}>
            Menu
          </button>
          <h2 className="brand-name">MealSetu</h2>
        </div>
        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#gallery">Gallery</a>
          <a href="#contact">Contact Us</a>
          <Link to="/login" className="nav-login-btn">Login</Link>
        </div>
      </nav>

      {/* HERO SECTION - Updated with bannerStyle */}
      <header id="home" style={bannerStyle}>
        <div className="hero-content">
          <div className="hero-text-bg">
            <h1>Mealsetu tiffin Service </h1>
          </div>
          <br />
          <center> 
            <Link to="/login" className="nav-free-btn" onClick={handleTrialClick}>2 Days Free Trial</Link>
          </center>
        </div>
      </header>

      {/* ABOUT SECTION */}
      <section id="about" className="landing-section">
        <h2 className="section-heading">ABOUT</h2>
        <p className="about-text">
          MealSetu Tiffin service is a premium food community committed to providing healthy, 
          home-cooked meals. We bridge the gap between local tiffin providers and food lovers 
          who miss the taste of home.
        </p>
      </section>

      {/* GALLERY & CONTACT WRAPPER */}
      <div className="flex-container">
        <section id="gallery" className="sub-section">
          <h2 className="section-heading">PHOTO GALLERY</h2>
         <div className="image-gallery">
            <img src="https://thumbs.dreamstime.com/b/indian-thali-26440151.jpg" alt="Food 1" />
            <img src="https://static.vecteezy.com/system/resources/thumbnails/074/709/016/small/indian-thali-meal-isolated-on-a-transparent-background-png.png" alt="Food 2" />
            <img src="https://png.pngtree.com/png-clipart/20241221/original/pngtree-indian-thali-png-image_18122295.png" alt="Food 3" />
          </div>
        </section>

        <section id="contact" className="sub-section">
          <h2 className="section-heading">CONTACT US</h2>
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
                  <FaFacebook />
                  Facebook
                </button>
                <button className="social-btn twitter" onClick={() => window.open('https://www.twitter.com', '_blank')}>
                  <FaTwitter />
                  Twitter
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="landing-footer">
        <p>© 2026 MealSetu | MCA Sem-2 Project | Privacy Policy</p>
      </footer>
    </div>
  );
}