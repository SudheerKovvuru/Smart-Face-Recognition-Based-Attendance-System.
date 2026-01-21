import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Users, Video as VideoIcon } from 'lucide-react';
import { io } from 'socket.io-client';
import './CameraDetailPage.css';

function CameraDetailPage({ cameraId, cameraName, onBack }) {
  const [detections, setDetections] = useState([]);
  const [totalDetected, setTotalDetected] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  // Video URL from Express backend
  const videoUrl = `http://localhost:5000/api/video/${cameraId}.mp4`;

  useEffect(() => {
    // Connect to Flask WebSocket server
    const socket = io('http://localhost:5001', {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to face recognition server');
      setIsConnected(true);
      
      // Request stream for this camera
      socket.emit('request_stream', { camera_id: cameraId });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('detections', (data) => {
      if (data.camera_id === cameraId) {
        setDetections(data.detections);
        setTotalDetected(data.total_detected);
        setFrameCount(data.frame_count);
        
        // Draw bounding boxes on canvas
        drawDetections(data.detections);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      // Stop stream when leaving page
      if (socket.connected) {
        fetch(`http://localhost:5001/api/stop_stream/${cameraId}`, {
          method: 'POST'
        }).catch(console.error);
      }
      socket.disconnect();
    };
  }, [cameraId]);

  // Setup canvas when video loads
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      });
    }
  }, []);

  const drawDetections = (detections) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each detection
    detections.forEach(detection => {
      const [x1, y1, x2, y2] = detection.box;
      
      // Draw rectangle
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      
      // Draw label background
      const label = detection.label;
      ctx.font = 'bold 16px "Courier New"';
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);
      
      // Draw label text
      ctx.fillStyle = '#ff0000';
      ctx.fillText(label, x1 + 5, y1 - 7);
    });
  };

  // Get unique detected persons
  const getDetectedPersons = () => {
    const persons = {};
    detections.forEach(det => {
      if (det.label in persons) {
        persons[det.label].count++;
        if (det.confidence > persons[det.label].maxConfidence) {
          persons[det.label].maxConfidence = det.confidence;
        }
      } else {
        persons[det.label] = {
          name: det.label,
          count: 1,
          maxConfidence: det.confidence
        };
      }
    });
    return Object.values(persons);
  };

  return (
    <div className="camera-detail-page">
      {/* Header */}
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="detail-title">
          <VideoIcon size={24} />
          <h1>{cameraName}</h1>
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● LIVE' : '● OFFLINE'}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="detail-content">
        {/* Left: Video Feed - 70% */}
        <div className="video-section">
          <div className="video-container-detail">
            <video
              ref={videoRef}
              className="video-feed-detail"
              autoPlay
              loop
              muted
              playsInline
              src={videoUrl}
            >
              Your browser does not support the video tag.
            </video>
            
            {/* Canvas overlay for bounding boxes */}
            <canvas
              ref={canvasRef}
              className="detection-canvas"
            />
            
            {/* Info overlay */}
            <div className="video-info-overlay">
              <div className="info-item">
                <span className="info-label">Detected:</span>
                <span className="info-value">{totalDetected} person(s)</span>
              </div>
              <div className="info-item">
                <span className="info-label">Frame:</span>
                <span className="info-value">{frameCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stats Panel - 30% */}
        <div className="stats-section">
          <div className="stats-card">
            <div className="stats-header">
              <Users size={20} />
              <h2>Detection Statistics</h2>
            </div>
            
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{totalDetected}</div>
                <div className="stat-label">Currently Visible</div>
              </div>
              
              <div className="stat-item">
                <div className="stat-value">{getDetectedPersons().length}</div>
                <div className="stat-label">Unique Persons</div>
              </div>
            </div>

            <div className="divider"></div>

            <div className="detected-list-header">
              <h3>Detected Persons</h3>
            </div>

            <div className="detected-list">
              {getDetectedPersons().length > 0 ? (
                getDetectedPersons().map((person, idx) => (
                  <div key={idx} className="detected-person">
                    <div className="person-info">
                      <div className="person-name">{person.name}</div>
                      <div className="person-confidence">
                        {person.maxConfidence.toFixed(1)}% confidence
                      </div>
                    </div>
                    <div className="detection-count">
                      {person.count}x
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-detections">
                  <p>No high-confidence detections</p>
                  <p className="hint">Waiting for face recognition...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CameraDetailPage;