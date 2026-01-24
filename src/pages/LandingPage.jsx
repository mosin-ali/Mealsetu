import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // NEW: State to track if user is logged in for demo purposes
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // NEW: Function to simulate login
  const handleLoginDemo = () => {
    setIsLoggedIn(true);
    alert("Login Successfully!"); // Success Popup
    if(isSidebarOpen) setIsSidebarOpen(false);
  };

  // NEW: Function to logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    alert("Logged out successfully.");
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
            
            {/* Conditional Sidebar Links */}
            {!isLoggedIn ? (
              <>
                <li><Link to="/login">Sign In</Link></li>
                <li><Link to="/login" className="sidebar-trial-btn">2 Days Free Trial</Link></li>
              </>
            ) : (
              <li><button onClick={handleLogout} className="sidebar-logout-btn">Logout</button></li>
            )}
          </ul>
        </div>
      </div>

      {/* HEADER / NAV */}
      <nav className="landing-nav">
        <div className="logo-section">
          <button className="menu-toggle-btn" onClick={toggleSidebar}>☰</button>
          <h2 className="brand-name">MealSetu</h2>
        </div>
        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#gallery">Gallery</a>
          <a href="#contact">Contact Us</a>
          
          {/* NEW: Conditional Login/Logout Button */}
          {!isLoggedIn ? (
            <Link to="/login" className="nav-login-btn">Login</Link>
          ) : (
            <button onClick={handleLogout} className="nav-logout-btn">Logout</button>
          )}
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
            {!isLoggedIn ? (
              <Link to="/login" className="nav-free-btn">2 Days Free Trial</Link>
            ) : (
              <div className="welcome-msg">Welcome back, User!</div>
            )}
          </center>
        </div>
      </header>

      {/* ... Rest of your sections (About, Gallery, Contact) stay the same ... */}
      
      <section id="about" className="landing-section">
        <h2 className="section-heading">ABOUT</h2>
        <p className="about-text">
          MealSetu Tiffin service is a premium food community committed to providing healthy, 
          home-cooked Mealsetu.
        </p>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 MealSetu | MCA Sem-2 Project | Privacy Policy</p>
      </footer>

      {/* DEMO TOOL: This button helps you test the "Redirect" look without leaving the page */}
      <button 
        onClick={handleLoginDemo}
        style={{position:'fixed', bottom:'10px', right:'10px', opacity:'0.5', fontSize:'10px'}}
      >
        Test Login UI
      </button>
    </div>
  );
}


