import { useState, useEffect } from 'react';
import { Video, Circle } from 'lucide-react';
import './CCTVMonitor.css';

function CCTVMonitor({ onCameraClick }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Backend video URLs
  const API_URL = 'http://localhost:5000/api/video';
  
  const cameras = [
  {
    id: 'cam1_trim',  // Changed from 1 to 'cam1'
    name: 'ENTRANCE - CAM 01',
    url: `${API_URL}/cam1_trim.mp4`,
  },
  {
    id: 'cam2',  // Changed from 2 to 'cam2'
    name: 'CORRIDOR - CAM 02',
    url: `${API_URL}/cam2.mp4`,
  },
  {
    id: 'cam3',  // Changed from 3 to 'cam3'
    name: 'CORRIDOR - CAM 03',
    url: `${API_URL}/cam3.mp4`,
  },
  {
    id: 'cam4',  // Changed from 4 to 'cam4'
    name: 'ENTRACE - CAM 04',
    url: `${API_URL}/cam4.mp4`,
  }
];

  return (
    <div className="cctv-container">
      {/* Scanline overlay effect */}
      <div className="scanline-overlay"></div>

      {/* Header */}
      
      {/* Camera Grid */}
      <div className="camera-grid">
        {cameras.map((camera) => (
          <div key={camera.id} className="camera-card"
            onClick={() => {
      console.log('Clicked camera:', camera);
      const url = `/camera/${camera.id}?name=${encodeURIComponent(camera.name)}`;
      window.open(url, '_blank');
    if (onCameraClick) {
      onCameraClick(camera);
    } else {
      console.error('onCameraClick is not defined!');
    }
  }}
  style={{ cursor: 'pointer' }}
          >
            {/* Camera Info Header */}
            <div className="camera-header">
              <div className="camera-info">
                <div className="camera-name-row">
                  <Circle className="recording-dot" />
                  <span className="camera-name">{camera.name}</span>
                </div>
                <div className="camera-location">{camera.location}</div>
              </div>
              <div className="recording-badge">● REC</div>
            </div>

            {/* Video Feed */}
            <div className="video-container">
              <video
                className="video-feed"
                autoPlay
                loop
                muted
                playsInline
                src={camera.url}
              >
                Your browser does not support the video tag.
              </video>
              
              {/* Crosshair overlay */}
              <div className="crosshair-overlay">
                <div className="crosshair-horizontal"></div>
                <div className="crosshair-vertical"></div>
              </div>

              {/* Corner brackets */}
              <div className="bracket bracket-top-left"></div>
              <div className="bracket bracket-top-right"></div>
              <div className="bracket bracket-bottom-left"></div>
              <div className="bracket bracket-bottom-right"></div>
            </div>

            {/* Timestamp Footer */}
            <div className="camera-footer">
              <div className="timestamp">
                {currentTime.toLocaleString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-content">
          <div className="status-left">
            <span className="status-item">
              SYSTEM STATUS: <span className="status-operational">OPERATIONAL</span>
            </span>
            <span className="status-item">
              ACTIVE FEEDS: <span className="status-active">{cameras.length}/4</span>
            </span>
          </div>
          <div className="status-right">
            SECURITY LEVEL: <span className="status-moderate">MODERATE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CCTVMonitor;