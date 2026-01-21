const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

// Enable CORS for React frontend
app.use(cors());

// Path to your videos folder
const VIDEOS_PATH = 'D:\\Downloads';

// Video streaming endpoint
app.get('/api/video/:filename', (req, res) => {
  const filename = req.params.filename;
  const videoPath = path.join(VIDEOS_PATH, filename);

  // Check if file exists
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Parse range header
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // No range header - send entire file
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', videosPath: VIDEOS_PATH });
});

// List available videos
app.get('/api/videos', (req, res) => {
  const videos = ['cam1.mp4', 'cam2.mp4', 'cam3.mp4', 'cam4.mp4'];
  const availableVideos = videos.filter(video => 
    fs.existsSync(path.join(VIDEOS_PATH, video))
  );
  res.json({ videos: availableVideos });
});

app.listen(PORT, () => {
  console.log(`✅ Video server running on http://localhost:${PORT}`);
  console.log(`📁 Serving videos from: ${VIDEOS_PATH}`);
  console.log(`🎥 Available endpoints:`);
  console.log(`   - GET /api/video/:filename`);
  console.log(`   - GET /api/videos`);
  console.log(`   - GET /api/health`);
});