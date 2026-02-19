import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

// Load .env file manually (force override)
const __dirname_temp = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname_temp, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
  console.log('✅ Loaded .env:', { RP_ID: process.env.RP_ID, ORIGIN: process.env.ORIGIN });
}
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Check for HTTPS certificates
const certPath = join(__dirname, '..', `${process.env.RP_ID}.crt`);
const keyPath = join(__dirname, '..', `${process.env.RP_ID}.key`);
const useHttps = existsSync(certPath) && existsSync(keyPath);

let server;
if (useHttps) {
  console.log('🔒 HTTPS enabled');
  server = createHttpsServer({
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  }, app);
} else {
  console.log('⚠️  HTTP mode (HTTPS certs not found)');
  server = createServer(app);
}

const wss = new WebSocketServer({ server });

// Config
const PORT = process.env.PORT || 8080;
const RP_NAME = 'Greyzone';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || `http://localhost:${PORT}`;
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data', 'sudo-approval.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(join(__dirname, '..', 'data'), { recursive: true });

// Database setup
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    user_agent TEXT,
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    reason TEXT,
    agent TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    approved_at TEXT,
    approved_by TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    project TEXT NOT NULL,
    description TEXT,
    token TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

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
`);

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'web')));

// WebSocket clients
const wsClients = new Set();
wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

// Helper: base64url encode/decode
const base64urlEncode = (buffer) => 
  Buffer.from(buffer).toString('base64url');
const base64urlDecode = (str) => 
  Buffer.from(str, 'base64url');

// ===== DEVICE ENDPOINTS =====

// List devices
app.get('/api/devices', (req, res) => {
  const devices = db.prepare('SELECT id, name, user_agent, registered_at, last_used_at FROM devices ORDER BY registered_at DESC').all();
  res.json(devices);
});

// Start device registration
app.post('/api/devices/register/start', async (req, res) => {
  const { name } = req.body;
  
  const existingDevices = db.prepare('SELECT credential_id FROM devices').all();
  const excludeCredentials = existingDevices.map(d => ({
    id: base64urlDecode(d.credential_id),
    type: 'public-key',
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: 'admin',
    userName: 'admin',
    userDisplayName: name || 'Admin Device',
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  // Store challenge
  const challengeId = randomUUID();
  db.prepare('INSERT INTO challenges (id, challenge, type) VALUES (?, ?, ?)').run(
    challengeId, options.challenge, 'registration'
  );

  res.json({ challengeId, options, deviceName: name });
});

// Complete device registration
app.post('/api/devices/register/complete', async (req, res) => {
  const { challengeId, response, deviceName, userAgent } = req.body;

  const challengeRow = db.prepare('SELECT challenge FROM challenges WHERE id = ? AND type = ?').get(challengeId, 'registration');
  if (!challengeRow) {
    return res.status(400).json({ error: 'Invalid or expired challenge' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      
      const deviceId = `dev_${randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO devices (id, name, credential_id, public_key, counter, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        deviceId,
        deviceName || 'Unknown Device',
        base64urlEncode(credentialID),
        base64urlEncode(credentialPublicKey),
        counter,
        userAgent || null
      );

      // Clean up challenge
      db.prepare('DELETE FROM challenges WHERE id = ?').run(challengeId);

      res.json({ success: true, deviceId });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete device
app.delete('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM devices WHERE id = ?').run(id);
  if (result.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

// ===== REQUEST ENDPOINTS =====

// Create request (from bot)
app.post('/api/requests', (req, res) => {
  const { command, reason, agent, priority = 'normal', timeout = 300 } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  const id = `req_${randomUUID().slice(0, 12)}`;
  const expiresAt = new Date(Date.now() + timeout * 1000).toISOString();

  db.prepare(`
    INSERT INTO requests (id, command, reason, agent, priority, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, command, reason || null, agent || null, priority, expiresAt);

  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  
  // Broadcast to web clients
  broadcast({ type: 'new_request', request });

  res.json({
    id,
    status: 'pending',
    createdAt: request.created_at,
    expiresAt: request.expires_at,
  });
});

// List requests
app.get('/api/requests', (req, res) => {
  const { status } = req.query;
  
  // Clean up expired requests
  db.prepare(`UPDATE requests SET status = 'expired' WHERE status = 'pending' AND expires_at < datetime('now')`).run();
  
  let query = 'SELECT * FROM requests';
  if (status) {
    query += ` WHERE status = '${status}'`;
  }
  query += ' ORDER BY created_at DESC LIMIT 100';
  
  const requests = db.prepare(query).all();
  res.json(requests);
});

// Get single request
app.get('/api/requests/:id', (req, res) => {
  const { id } = req.params;
  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  res.json(request);
});

// Start authentication for approval
app.post('/api/auth/start', async (req, res) => {
  const devices = db.prepare('SELECT credential_id FROM devices').all();
  
  if (devices.length === 0) {
    return res.status(400).json({ error: 'No devices registered' });
  }

  const allowCredentials = devices.map(d => ({
    id: base64urlDecode(d.credential_id),
    type: 'public-key',
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: 'required',
  });

  const challengeId = randomUUID();
  db.prepare('INSERT INTO challenges (id, challenge, type) VALUES (?, ?, ?)').run(
    challengeId, options.challenge, 'authentication'
  );

  res.json({ challengeId, options });
});

// Verify authentication and approve
app.post('/api/requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { challengeId, response } = req.body;

  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ error: `Request is already ${request.status}` });
  }

  const challengeRow = db.prepare('SELECT challenge FROM challenges WHERE id = ? AND type = ?').get(challengeId, 'authentication');
  if (!challengeRow) {
    return res.status(400).json({ error: 'Invalid or expired challenge' });
  }

  const credentialId = response.id;
  const device = db.prepare('SELECT * FROM devices WHERE credential_id = ?').get(credentialId);
  if (!device) {
    return res.status(400).json({ error: 'Unknown device' });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64urlDecode(device.credential_id),
        credentialPublicKey: base64urlDecode(device.public_key),
        counter: device.counter,
      },
    });

    if (verification.verified) {
      // Update device counter and last used
      db.prepare('UPDATE devices SET counter = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        verification.authenticationInfo.newCounter,
        device.id
      );

      // Clean up challenge
      db.prepare('DELETE FROM challenges WHERE id = ?').run(challengeId);

      // Execute command
      db.prepare(`UPDATE requests SET status = 'running', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`).run(device.name, id);
      broadcast({ type: 'request_updated', request: { ...request, status: 'running' } });

      try {
        const result = execSync(request.command, {
          encoding: 'utf-8',
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
        });

        db.prepare(`UPDATE requests SET status = 'completed', exit_code = 0, stdout = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(result, id);
        
        const updatedRequest = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
        broadcast({ type: 'request_updated', request: updatedRequest });
        
        res.json({ success: true, result: updatedRequest });
      } catch (execError) {
        db.prepare(`UPDATE requests SET status = 'failed', exit_code = ?, stdout = ?, stderr = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
          execError.status || 1,
          execError.stdout || '',
          execError.stderr || execError.message,
          id
        );
        
        const updatedRequest = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
        broadcast({ type: 'request_updated', request: updatedRequest });
        
        res.json({ success: true, result: updatedRequest });
      }
    } else {
      res.status(400).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Deny request
app.post('/api/requests/:id/deny', (req, res) => {
  const { id } = req.params;
  
  const result = db.prepare(`UPDATE requests SET status = 'denied', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`).run(id);
  
  if (result.changes > 0) {
    const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
    broadcast({ type: 'request_updated', request });
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Request not found or not pending' });
  }
});

// Approve all pending
app.post('/api/requests/approve-all', async (req, res) => {
  const { challengeId, response } = req.body;

  // Verify auth first
  const challengeRow = db.prepare('SELECT challenge FROM challenges WHERE id = ? AND type = ?').get(challengeId, 'authentication');
  if (!challengeRow) {
    return res.status(400).json({ error: 'Invalid or expired challenge' });
  }

  const credentialId = response.id;
  const device = db.prepare('SELECT * FROM devices WHERE credential_id = ?').get(credentialId);
  if (!device) {
    return res.status(400).json({ error: 'Unknown device' });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64urlDecode(device.credential_id),
        credentialPublicKey: base64urlDecode(device.public_key),
        counter: device.counter,
      },
    });

    if (verification.verified) {
      db.prepare('UPDATE devices SET counter = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        verification.authenticationInfo.newCounter,
        device.id
      );
      db.prepare('DELETE FROM challenges WHERE id = ?').run(challengeId);

      const pendingRequests = db.prepare(`SELECT * FROM requests WHERE status = 'pending' AND expires_at > datetime('now')`).all();
      const results = [];

      for (const request of pendingRequests) {
        db.prepare(`UPDATE requests SET status = 'running', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`).run(device.name, request.id);
        
        try {
          const result = execSync(request.command, {
            encoding: 'utf-8',
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024,
          });
          db.prepare(`UPDATE requests SET status = 'completed', exit_code = 0, stdout = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(result, request.id);
          results.push({ id: request.id, status: 'completed' });
        } catch (execError) {
          db.prepare(`UPDATE requests SET status = 'failed', exit_code = ?, stderr = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
            execError.status || 1,
            execError.stderr || execError.message,
            request.id
          );
          results.push({ id: request.id, status: 'failed' });
        }
      }

      broadcast({ type: 'refresh' });
      res.json({ success: true, results });
    } else {
      res.status(400).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ===== TOKEN ENDPOINTS =====

// List tokens (masked)
app.get('/api/tokens', (req, res) => {
  const tokens = db.prepare('SELECT id, service, project, description, created_at, updated_at FROM tokens ORDER BY created_at DESC').all();
  res.json(tokens);
});

// Get single token (full, for internal use)
app.get('/api/tokens/:id', (req, res) => {
  const { id } = req.params;
  const token = db.prepare('SELECT * FROM tokens WHERE id = ?').get(id);
  
  if (!token) {
    return res.status(404).json({ error: 'Token not found' });
  }
  
  res.json(token);
});

// Get token by service name (all projects)
app.get('/api/tokens/service/:service', (req, res) => {
  const { service } = req.params;
  const tokens = db.prepare('SELECT * FROM tokens WHERE service = ?').all(service);
  
  if (tokens.length === 0) {
    return res.status(404).json({ error: 'Token not found for service' });
  }
  
  res.json(tokens);
});

// Get token by service + project
app.get('/api/tokens/service/:service/project/:project', (req, res) => {
  const { service, project } = req.params;
  const token = db.prepare('SELECT * FROM tokens WHERE service = ? AND project = ?').get(service, project);
  
  if (!token) {
    return res.status(404).json({ error: 'Token not found for service/project' });
  }
  
  res.json(token);
});

// Create/Update token
app.post('/api/tokens', (req, res) => {
  const { service, project, description, token } = req.body;
  
  if (!service || !project || !token) {
    return res.status(400).json({ error: 'Service, project, and token are required' });
  }

  // Check if token for this service+project exists
  const existing = db.prepare('SELECT id FROM tokens WHERE service = ? AND project = ?').get(service, project);
  
  if (existing) {
    // Update existing
    db.prepare(`
      UPDATE tokens SET token = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE service = ? AND project = ?
    `).run(token, description || null, service, project);
    
    res.json({ success: true, id: existing.id, action: 'updated' });
  } else {
    // Create new
    const id = `tok_${randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO tokens (id, service, project, description, token)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, service, project, description || null, token);
    
    res.json({ success: true, id, action: 'created' });
  }
});

// Delete token
app.delete('/api/tokens/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
  
  if (result.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Token not found' });
  }
});

// Delete token by service (all projects)
app.delete('/api/tokens/service/:service', (req, res) => {
  const { service } = req.params;
  const result = db.prepare('DELETE FROM tokens WHERE service = ?').run(service);
  
  if (result.changes > 0) {
    res.json({ success: true, deleted: result.changes });
  } else {
    res.status(404).json({ error: 'Token not found for service' });
  }
});

// Delete token by service + project
app.delete('/api/tokens/service/:service/project/:project', (req, res) => {
  const { service, project } = req.params;
  const result = db.prepare('DELETE FROM tokens WHERE service = ? AND project = ?').run(service, project);
  
  if (result.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Token not found for service/project' });
  }
});

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔐 Greyzone Server running on http://0.0.0.0:${PORT}`);
  console.log(`RP_ID: ${RP_ID}, ORIGIN: ${ORIGIN}`);
});

// Config API
const CONFIG_FILE = join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { storage: 'local' };
}

function saveConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

app.post('/api/config', (req, res) => {
  const config = { ...loadConfig(), ...req.body };
  saveConfig(config);
  res.json(config);
});

// Doppler secrets (읽기 전용)
app.get('/api/doppler/secrets', async (req, res) => {
  const config = loadConfig();
  if (config.storage !== 'doppler') {
    return res.json({ error: 'Doppler not configured' });
  }
  
  const { project, config: dopplerConfig } = config.doppler || {};
  if (!project) {
    return res.json({ error: 'Doppler project not set' });
  }
  
  try {
    const { execSync } = require('child_process');
    const result = execSync(
      `doppler secrets --json --project ${project} --config ${dopplerConfig || 'dev'}`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    const secrets = JSON.parse(result);
    // 값은 마스킹
    const masked = {};
    for (const [key, val] of Object.entries(secrets)) {
      masked[key] = {
        key,
        value: val.computed ? val.computed.slice(0, 10) + '...' : '***',
        source: 'doppler'
      };
    }
    res.json(masked);
  } catch (e) {
    res.json({ error: e.message });
  }
});

// SPA fallback - 모든 경로를 index.html로 (맨 마지막에!)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'web', 'index.html'));
});
