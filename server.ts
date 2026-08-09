import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { ClipboardData, UploadedFile, TextSnapshot } from './src/types';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// Enable JSON & URL encoded bodies (up to 50MB for large text pastes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set up directories - use /tmp on Vercel/Serverless where process.cwd() is read-only
const isVercel = process.env.VERCEL === '1' || process.env.NOW_BUILDER === '1';
const BASE_DIR = isVercel ? '/tmp' : process.cwd();
const DATA_DIR = path.join(BASE_DIR, 'data');
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Error creating storage directories:', err);
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Setup Multer for handling file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    cb(null, `${safeBaseName}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max per file
});

// In-memory store backed by disk storage
interface RoomStore {
  [roomId: string]: ClipboardData;
}

const STORE_FILE = path.join(DATA_DIR, 'store.json');

function loadStore(): RoomStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading store:', err);
  }
  return {};
}

function saveStore(store: RoomStore) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store:', err);
  }
}

const store: RoomStore = loadStore();

function getOrCreateRoom(roomId: string = 'global'): ClipboardData {
  const cleanRoomId = roomId.trim().toLowerCase() || 'global';
  if (!store[cleanRoomId]) {
    store[cleanRoomId] = {
      roomId: cleanRoomId,
      text: 'Welcome to the Public Clipboard!\n\nType anything here or drop files below. Everything synced in real-time across any connected device, laptop, or phone.',
      files: [],
      version: 1,
      updatedAt: new Date().toISOString(),
      history: [
        {
          id: 'init-1',
          text: 'Welcome to the Public Clipboard!\n\nType anything here or drop files below. Everything synced in real-time across any connected device, laptop, or phone.',
          timestamp: new Date().toISOString(),
          preview: 'Welcome to the Public Clipboard...',
        },
      ],
    };
    saveStore(store);
  }
  return store[cleanRoomId];
}

// Track active polling/device sessions with heartbeat timestamps
const activeSessions = new Map<string, { roomId: string; lastSeen: number }>();

function recordHeartbeat(clientId: string, roomId: string) {
  activeSessions.set(clientId, { roomId, lastSeen: Date.now() });
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastSeen > 10000) { // 10 seconds timeout
      activeSessions.delete(id);
    }
  }
}

function getActiveClientsCount(roomId: string): number {
  cleanupSessions();
  const cleanRoomId = roomId.trim().toLowerCase() || 'global';
  let count = 0;
  for (const session of activeSessions.values()) {
    if (session.roomId === cleanRoomId) count++;
  }
  return Math.max(1, count); // Return at least 1 for current device
}

// SSE Clients connections tracking
interface SSEClient {
  id: string;
  roomId: string;
  res: Response;
}

const sseClients: SSEClient[] = [];

function broadcastToRoom(roomId: string, data: ClipboardData) {
  const cleanRoomId = roomId.trim().toLowerCase() || 'global';
  const clientsInRoom = sseClients.filter((client) => client.roomId === cleanRoomId);
  const payload = `data: ${JSON.stringify({ type: 'update', data, activeClientsCount: getActiveClientsCount(roomId) })}\n\n`;

  clientsInRoom.forEach((client) => {
    try {
      client.res.write(payload);
    } catch (err) {
      console.error('SSE write error:', err);
    }
  });
}

// --- API Endpoints ---

// GET /api/clipboard
app.get('/api/clipboard', (req: Request, res: Response) => {
  const roomId = (req.query.room as string) || 'global';
  const clientId = (req.query.clientId as string) || req.ip || 'client-default';
  recordHeartbeat(clientId, roomId);

  const roomData = getOrCreateRoom(roomId);
  res.json({
    data: roomData,
    activeClientsCount: getActiveClientsCount(roomId),
  });
});

// POST /api/clipboard
app.post('/api/clipboard', (req: Request, res: Response) => {
  const roomId = (req.body.roomId as string) || 'global';
  const text = typeof req.body.text === 'string' ? req.body.text : '';
  const clientId = (req.body.clientId as string) || req.ip || 'client-default';
  recordHeartbeat(clientId, roomId);

  const room = getOrCreateRoom(roomId);
  
  if (text !== room.text) {
    room.text = text;
    room.version += 1;
    room.updatedAt = new Date().toISOString();

    if (!room.history) room.history = [];
    const lastSnapshot = room.history[0];
    if (!lastSnapshot || Math.abs(lastSnapshot.text.length - text.length) > 10 || Date.now() - new Date(lastSnapshot.timestamp).getTime() > 60000) {
      room.history.unshift({
        id: `snap-${Date.now()}`,
        text,
        timestamp: new Date().toISOString(),
        preview: text.slice(0, 60).replace(/\n/g, ' ') || '(empty)',
      });
      if (room.history.length > 20) {
        room.history = room.history.slice(0, 20);
      }
    }

    saveStore(store);
    broadcastToRoom(roomId, room);
  }

  res.json({ success: true, data: room });
});

// POST /api/upload
app.post('/api/upload', upload.array('files', 10), (req: Request, res: Response) => {
  const roomId = (req.body.roomId as string) || 'global';
  const reqFiles = req.files as Express.Multer.File[];

  if (!reqFiles || reqFiles.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const room = getOrCreateRoom(roomId);

  const newUploadedFiles: UploadedFile[] = reqFiles.map((file) => ({
    id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`,
    uploadedAt: new Date().toISOString(),
  }));

  room.files = [...newUploadedFiles, ...room.files];
  room.version += 1;
  room.updatedAt = new Date().toISOString();

  saveStore(store);
  broadcastToRoom(roomId, room);

  res.json({ success: true, files: newUploadedFiles, data: room });
});

// DELETE /api/files/:fileId
app.delete('/api/files/:fileId', (req: Request, res: Response) => {
  const fileId = req.params.fileId;
  const roomId = (req.query.room as string) || 'global';
  const room = getOrCreateRoom(roomId);

  const fileToDelete = room.files.find((f) => f.id === fileId);
  if (fileToDelete) {
    const filePath = path.join(UPLOADS_DIR, fileToDelete.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete file from disk:', err);
      }
    }

    room.files = room.files.filter((f) => f.id !== fileId);
    room.version += 1;
    room.updatedAt = new Date().toISOString();

    saveStore(store);
    broadcastToRoom(roomId, room);
  }

  res.json({ success: true, data: room });
});

// POST /api/clipboard/clear
app.post('/api/clipboard/clear', (req: Request, res: Response) => {
  const roomId = (req.body.roomId as string) || 'global';
  const target = req.body.target || 'all';
  const room = getOrCreateRoom(roomId);

  if (target === 'text' || target === 'all') {
    room.text = '';
  }
  if (target === 'files' || target === 'all') {
    room.files.forEach((file) => {
      const filePath = path.join(UPLOADS_DIR, file.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          /* ignore */
        }
      }
    });
    room.files = [];
  }

  room.version += 1;
  room.updatedAt = new Date().toISOString();

  saveStore(store);
  broadcastToRoom(roomId, room);

  res.json({ success: true, data: room });
});

// GET /api/events - Server Sent Events for Live Multi-Device Sync
app.get('/api/events', (req: Request, res: Response) => {
  const roomId = ((req.query.room as string) || 'global').trim().toLowerCase();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);

  const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const client: SSEClient = { id: clientId, roomId, res };
  sseClients.push(client);

  const roomData = getOrCreateRoom(roomId);
  res.write(
    `data: ${JSON.stringify({
      type: 'init',
      data: roomData,
      activeClientsCount: getActiveClientsCount(roomId),
    })}\n\n`
  );

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const index = sseClients.findIndex((c) => c.id === clientId);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
  });
});

// --- Vite and Standalone Server Setup ---
if (process.env.NODE_ENV !== 'production') {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  }).then((vite) => {
    app.use(vite.middlewares);
    if (!isVercel) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Public Clipboard Dev Server running on http://0.0.0.0:${PORT}`);
      });
    }
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  if (!isVercel) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Public Clipboard Production Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

export default app;

