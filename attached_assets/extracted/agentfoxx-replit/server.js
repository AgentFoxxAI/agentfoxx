// AgentFoxx Backend Server for Replit
// Handles audio upload, database operations, and n8n webhook callbacks

const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Initialize SQLite database
const db = new sqlite3.Database('./agentfoxx.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

// Create tables if they don't exist
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      company TEXT,
      theme TEXT,
      transcript TEXT,
      email_draft TEXT,
      outreach_prospect_id TEXT,
      outreach_sequence_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating activities table:', err);
    } else {
      console.log('Activities table ready');
    }
  });
}

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `audio_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /webm|mp4|wav|mp3|m4a/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext.slice(1))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files allowed.'));
    }
  }
});

// ============================================
// API ENDPOINTS
// ============================================

// POST /api/upload-audio
// Receives audio file from frontend, saves it, triggers n8n workflow
app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { contactName, contactEmail, company, notes } = req.body;

    // Generate public URL for the audio file (Replit provides this automatically)
    const audioUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // Insert initial activity record
    const activityId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO activities (contact_name, contact_email, company, status) 
         VALUES (?, ?, ?, 'processing')`,
        [contactName, contactEmail, company],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Trigger n8n workflow
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (n8nWebhookUrl) {
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          audioUrl,
          contactName,
          contactEmail,
          company,
          notes,
          callbackUrl: `${req.protocol}://${req.get('host')}/api/activities/${activityId}`
        })
      });

      if (!response.ok) {
        console.error('n8n webhook failed:', response.statusText);
      }
    } else {
      console.warn('N8N_WEBHOOK_URL not configured. Skipping workflow trigger.');
    }

    res.json({
      success: true,
      activityId,
      audioUrl,
      message: 'Audio uploaded successfully. Processing workflow...'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/activities
// Returns all activities for dashboard display
app.get('/api/activities', (req, res) => {
  db.all(
    `SELECT * FROM activities ORDER BY created_at DESC LIMIT 100`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// GET /api/activities/:id
// Returns a single activity by ID
app.get('/api/activities/:id', (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT * FROM activities WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      res.json(row);
    }
  );
});

// PUT /api/activities/:id
// Updates activity with n8n workflow results (called by n8n webhook)
app.put('/api/activities/:id', (req, res) => {
  const { id } = req.params;
  const {
    theme,
    transcript,
    email_draft,
    outreach_prospect_id,
    outreach_sequence_id,
    status
  } = req.body;

  db.run(
    `UPDATE activities 
     SET theme = ?, transcript = ?, email_draft = ?, 
         outreach_prospect_id = ?, outreach_sequence_id = ?, status = ?
     WHERE id = ?`,
    [theme, transcript, email_draft, outreach_prospect_id, outreach_sequence_id, status || 'completed', id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      res.json({ success: true, message: 'Activity updated' });
    }
  );
});

// GET /api/stats
// Returns dashboard statistics
app.get('/api/stats', (req, res) => {
  const stats = {};

  // Total emails sent (completed activities)
  db.get(`SELECT COUNT(*) as count FROM activities WHERE status = 'completed'`, [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.emailsSent = row.count;

    // Total leads created
    db.get(`SELECT COUNT(*) as count FROM activities WHERE outreach_prospect_id IS NOT NULL`, [], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.leadsCreated = row.count;

      // Theme distribution
      db.all(
        `SELECT theme, COUNT(*) as count FROM activities 
         WHERE theme IS NOT NULL GROUP BY theme ORDER BY count DESC LIMIT 5`,
        [],
        (err, rows) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          stats.themeDistribution = rows;

          res.json(stats);
        }
      );
    });
  });
});

// Serve uploaded audio files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`AgentFoxx server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`N8N Webhook URL: ${process.env.N8N_WEBHOOK_URL || 'NOT CONFIGURED'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing database...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    process.exit(0);
  });
});
