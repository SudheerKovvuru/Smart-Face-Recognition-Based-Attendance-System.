import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import CCTVMonitor from './CCTVMonitor';
import CameraDetailRoute from './CameraDetailRoute';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('live');

  return (
    <Router>
      <Routes>
        {/* Main application with navbar */}
        <Route path="/" element={
          <div className="app">
            <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
            
            <main className="main-content">
              {activeTab === 'dashboard' && (
                <div className="placeholder-page">
                  <h1>Dashboard</h1>
                  <p>Dashboard content coming soon...</p>
                </div>
              )}
              
              {activeTab === 'live' && <CCTVMonitor />}
              
              {activeTab === 'search' && (
                <div className="placeholder-page">
                  <h1>Search</h1>
                  <p>Search functionality coming soon...</p>
                </div>
              )}
            </main>
          </div>
        } />

        {/* Camera detail page - opens in new tab */}
        <Route path="/camera/:cameraId" element={<CameraDetailRoute />} />
      </Routes>
    </Router>
  );
}

export default App;