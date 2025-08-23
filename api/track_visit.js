// api/track_visit.js
// Simple API endpoint to log website visits
// This example logs to the console. For production, log to a database or file.

const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { visitorId, userId, userAgent, timestamp } = req.body || {};
  const logEntry = JSON.stringify({ visitorId, userId, userAgent, timestamp }) + '\n';

  // Log to console
  console.log('Visit:', { visitorId, userId, userAgent, timestamp });

  // Append to visits.log file

  const logPath = path.join(__dirname, '../visits.log');
  console.log('Writing visit log to:', logPath);
  fs.appendFile(logPath, logEntry, err => {
    if (err) {
      console.error('Failed to write visit log:', err);
    } else {
      console.log('Visit log written to file.');
    }
  });

  res.status(200).json({ success: true });
};
