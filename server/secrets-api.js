// Secrets API endpoints
// Add these to the main server/index.js

// ===== SECRETS ENDPOINTS =====

// List projects
app.get('/api/secrets', (req, res) => {
  const projects = db.prepare(`
    SELECT DISTINCT project FROM secrets ORDER BY project
  `).all();
  res.json(projects.map(p => p.project));
});

// List configs for a project
app.get('/api/secrets/:project', (req, res) => {
  const { project } = req.params;
  const configs = db.prepare(`
    SELECT DISTINCT config FROM secrets WHERE project = ? ORDER BY config
  `).all(project);
  res.json(configs.map(c => c.config));
});

// Get all secrets for project/config
app.get('/api/secrets/:project/:config', (req, res) => {
  const { project, config } = req.params;
  const secrets = db.prepare(`
    SELECT key, value FROM secrets WHERE project = ? AND config = ?
  `).all(project, config);
  
  // Return as key-value object
  const result = {};
  secrets.forEach(s => { result[s.key] = s.value; });
  res.json(result);
});

// Get single secret
app.get('/api/secrets/:project/:config/:key', (req, res) => {
  const { project, config, key } = req.params;
  const secret = db.prepare(`
    SELECT value FROM secrets WHERE project = ? AND config = ? AND key = ?
  `).get(project, config, key);
  
  if (!secret) {
    return res.status(404).json({ error: 'Secret not found' });
  }
  res.json({ key, value: secret.value });
});

// Set secret
app.post('/api/secrets/:project/:config', (req, res) => {
  const { project, config } = req.params;
  const { key, value, description } = req.body;
  
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value are required' });
  }

  // Upsert
  const existing = db.prepare(`
    SELECT id FROM secrets WHERE project = ? AND config = ? AND key = ?
  `).get(project, config, key);
  
  if (existing) {
    db.prepare(`
      UPDATE secrets SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE project = ? AND config = ? AND key = ?
    `).run(value, description || null, project, config, key);
    res.json({ success: true, action: 'updated' });
  } else {
    const id = `sec_${randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO secrets (id, project, config, key, value, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, project, config, key, value, description || null);
    res.json({ success: true, id, action: 'created' });
  }
});

// Set multiple secrets at once
app.post('/api/secrets/:project/:config/bulk', (req, res) => {
  const { project, config } = req.params;
  const secrets = req.body; // { KEY1: "value1", KEY2: "value2" }
  
  if (!secrets || typeof secrets !== 'object') {
    return res.status(400).json({ error: 'Object with key-value pairs required' });
  }

  const results = [];
  for (const [key, value] of Object.entries(secrets)) {
    const existing = db.prepare(`
      SELECT id FROM secrets WHERE project = ? AND config = ? AND key = ?
    `).get(project, config, key);
    
    if (existing) {
      db.prepare(`
        UPDATE secrets SET value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project = ? AND config = ? AND key = ?
      `).run(value, project, config, key);
      results.push({ key, action: 'updated' });
    } else {
      const id = `sec_${randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO secrets (id, project, config, key, value)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, project, config, key, value);
      results.push({ key, id, action: 'created' });
    }
  }
  
  res.json({ success: true, results });
});

// Delete secret
app.delete('/api/secrets/:project/:config/:key', (req, res) => {
  const { project, config, key } = req.params;
  const result = db.prepare(`
    DELETE FROM secrets WHERE project = ? AND config = ? AND key = ?
  `).run(project, config, key);
  
  if (result.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Secret not found' });
  }
});

// Delete all secrets for project/config
app.delete('/api/secrets/:project/:config', (req, res) => {
  const { project, config } = req.params;
  const result = db.prepare(`
    DELETE FROM secrets WHERE project = ? AND config = ?
  `).run(project, config);
  
  res.json({ success: true, deleted: result.changes });
});


// ===== DB SCHEMA =====
// Add this to the db.exec() section:
/*
  CREATE TABLE IF NOT EXISTS secrets (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    config TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project, config, key)
  );
*/
