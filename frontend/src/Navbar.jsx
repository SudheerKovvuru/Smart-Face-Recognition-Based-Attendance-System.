import { useState } from 'react';
import { LayoutDashboard, Video, Search, User } from 'lucide-react';
import './Navbar.css';
import collegeLogo from '../public/college_logo.png';

function Navbar({ activeTab, onTabChange }) {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* Left - Logo and College Name */}
        <div className="navbar-left">
          <div className="logo-container">
            <div className="logo-placeholder">
                <img src={collegeLogo} alt="College Logo"/>
            </div>
          </div>
          <span className="college-name">AITAM</span>
        </div>

        {/* Center - Navigation Links */}
        <div className="navbar-center">
          <button
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-link ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => onTabChange('live')}
          >
            <Video size={18} />
            <span>Live</span>
          </button>
          <button
            className={`nav-link ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => onTabChange('search')}
          >
            <Search size={18} />
            <span>Search</span>
          </button>
        </div>

        {/* Right - User Profile */}
        <div className="navbar-right">
          <span className="username">Admin User</span>
          <div className="profile-icon">
            <User size={20} />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;