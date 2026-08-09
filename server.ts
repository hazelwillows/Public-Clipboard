import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { ClipboardData, UploadedFile, TextSnapshot } from './src/types';

const PORT = 3000;
const app = express();

// Enable JSON & URL encoded bodies (up to 50MB for large text pastes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set up directories
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
  const payload = `data: ${JSON.stringify({ type: 'update', data, activeClientsCount: clientsInRoom.length })}\n\n`;

  clientsInRoom.forEach((client) => {
    try {
      client.res.write(payload);
    } catch (err) {
      console.error('SSE write error:', err);
    }
  });
}

function getActiveClientsCount(roomId: string): number {
  const cleanRoomId = roomId.trim().toLowerCase() || 'global';
  return sseClients.filter((client) => client.roomId === cleanRoomId).length;
}

// --- API Endpoints ---

// GET /api/clipboard
app.get('/api/clipboard', (req: Request, res: Response) => {
  const roomId = (req.query.room as string) || 'global';
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

  const room = getOrCreateRoom(roomId);
  
  // Create snapshot if text changed significantly
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
  const target = req.body.target || 'all'; // 'text', 'files', 'all'
  const room = getOrCreateRoom(roomId);

  if (target === 'text' || target === 'all') {
    room.text = '';
  }
  if (target === 'files' || target === 'all') {
    // optional: clean up upload files from disk
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

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const client: SSEClient = { id: clientId, roomId, res };
  sseClients.push(client);

  // Send initial data
  const roomData = getOrCreateRoom(roomId);
  res.write(
    `data: ${JSON.stringify({
      type: 'init',
      data: roomData,
      activeClientsCount: getActiveClientsCount(roomId),
    })}\n\n`
  );

  // Send ping every 20 seconds to keep SSE connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const index = sseClients.findIndex((c) => c.id === clientId);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
  });
});

// --- Vite and Production Server Setup ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Public Clipboard Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
