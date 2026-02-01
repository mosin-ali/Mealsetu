import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

// 1. Import your banner image
import heroBannerImg from './image/image.png'; 

export default function LandingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

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
            <li><Link to="/login" className="sidebar-trial-btn">2 Days Free Trial</Link></li>
          </ul>
        </div>
      </div>

      {/* HEADER / NAV */}
      <nav className="landing-nav">
        <div className="logo-section">
          <button className="menu-toggle-btn" onClick={toggleSidebar}>
            ☰
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
            <Link to="/login" className="nav-free-btn">2 Days Free Trial</Link>
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
            <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300" alt="Food 1" />
            <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300" alt="Food 2" />
            <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300" alt="Food 3" />
          </div>
        </section>

        <section id="contact" className="sub-section">
          <h2 className="section-heading">CONTACT US</h2>
          <div className="contact-grid">
            <div className="contact-info">
              <h4>Location & Hours</h4>
              <p>Himatnagar, Gujarat, India</p>
              <p>Email: support@mealsetu.com</p>
              <div className="social-icons">f t i</div>
            </div>
            <div className="contact-form-mini">
              <input type="text" placeholder="Name" className="form-input" />
              <textarea placeholder="Message" className="form-input"></textarea>
              <button className="btn-primary" style={{width: 'auto', padding: '10px 20px'}}>Submit</button>
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