import React, { useState } from 'react'; // Added useState
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar state

  // Function to close sidebar when a link is clicked
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="landing-wrapper">
      {/* SIDEBAR MENU (New Additive Section) */}
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
          {/* Hamburger Icon to open Sidebar */}
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
<<<<<<< HEAD
          <Link to="/login" className="nav-login-btn">Login</Link>
=======
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
        </div>
      </nav>

      {/* HERO SECTION */}
      <header id="home" className="hero-banner">
        <div className="hero-content">
          <div className="hero-text-bg">
            <h1>Mealsetu from tiffin Service Management</h1>
          </div>
          <br />
          <center> 
<<<<<<< HEAD
            <Link to="/login" className="nav-free-btn">2 Days Free Trial</Link>
=======
            <Link to="/login" className="nav-login-btn">2 Days Free Trial</Link>
>>>>>>> 60e34e24bf17a8a4c7a18ec8c59b0351036d0460
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
        {/* PHOTO GALLERY */}
        <section id="gallery" className="sub-section">
          <h2 className="section-heading">PHOTO GALLERY</h2>
          <div className="image-gallery">
            <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300" alt="Food 1" />
            <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300" alt="Food 2" />
            <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300" alt="Food 3" />
          </div>
        </section>

        {/* CONTACT US */}
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