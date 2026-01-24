const express = require('express');
const path = require('path');
const app = express();

const STATIC_DIR = process.env.STATIC_DIR || 'dist';

app.use(express.static(path.join(__dirname, STATIC_DIR)));

// Use regex for catch-all route (Express v5 compatible)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, STATIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ISBAR server running on port ${PORT}`));
