// server.js
// Simple Node.js server for tunedIn.space
// Serves static files and handles API routes

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies for API
app.use(bodyParser.json());

// Serve static files
app.use(express.static(__dirname));


// API route: soundcloud-oembed (wrap ES module default export for Express)
const soundcloudOembed = require('./api/soundcloud-oembed.js');
app.get('/api/soundcloud-oembed', (req, res) => {
  // Emulate Vercel's req.query
  req.query = req.query || {};
  // soundcloudOembed may be an ES module default export
  if (soundcloudOembed.default) {
    soundcloudOembed.default(req, res);
  } else {
    soundcloudOembed(req, res);
  }
});

// API route: track_visit
const trackVisit = require('./api/track_visit.js');
app.post('/api/track_visit', (req, res) => {
  trackVisit(req, res);
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
