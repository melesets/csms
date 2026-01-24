const express = require('express');
const path = require('path');
const app = express();

const STATIC_DIR = process.env.STATIC_DIR || 'dist';

// Absolute path to built assets
const distPath = path.join(__dirname, STATIC_DIR);

// 1) Serve at root for direct access on the service port
app.use(express.static(distPath));

// 2) Also serve under '/isbar' for reverse-proxy subpath access
//    This maps '/isbar/assets/...' -> '<dist>/assets/...'
app.use('/isbar', express.static(distPath));

// 3) SPA fallback: serve index.html for client-side routes
app.get('/isbar/*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Use the PORT from environment variables or default to 4000
const PORT = process.env.PORT || 4000;
console.log(`Server configured to run on port: ${PORT}`);
app.listen(PORT, () => console.log(`ISBAR server running on port ${PORT}`));
