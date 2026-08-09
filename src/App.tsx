import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { MainTextEditor } from './components/MainTextEditor';
import { FileUploadZone } from './components/FileUploadZone';
import { QRCodeModal } from './components/QRCodeModal';
import { HistoryModal } from './components/HistoryModal';
import { ClipboardData, UploadedFile, TextSnapshot } from './types';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { Smartphone, Monitor, ShieldCheck, Zap, RefreshCw, Layers, Sparkles } from 'lucide-react';

export default function App() {
  // Determine roomId from URL query or default to 'global'
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (params.get('room') || 'global').trim().toLowerCase();
    }
    return 'global';
  });

  const [text, setText] = useState<string>('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [version, setVersion] = useState<number>(1);
  const [history, setHistory] = useState<TextSnapshot[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [activeClientsCount, setActiveClientsCount] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Modals state
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [hasCopiedHeader, setHasCopiedHeader] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Track local typing vs remote updates to avoid cursor jumping
  const isTypingRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persistent clientId for active device presence
  const clientIdRef = useRef<string>(() => {
    if (typeof window !== 'undefined') {
      let id = sessionStorage.getItem('pub_clip_client_id');
      if (!id) {
        id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        sessionStorage.setItem('pub_clip_client_id', id);
      }
      return id;
    }
    return 'device-default';
  });

  const getClientId = (): string => {
    return typeof clientIdRef.current === 'function' ? clientIdRef.current() : clientIdRef.current;
  };

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Update room in URL when changed
  const handleRoomChange = (newRoom: string) => {
    const clean = newRoom.trim().toLowerCase();
    if (clean && clean !== roomId) {
      setRoomId(clean);
      const url = new URL(window.location.href);
      if (clean === 'global') {
        url.searchParams.delete('room');
      } else {
        url.searchParams.set('room', clean);
      }
      window.history.pushState({}, '', url.toString());
      showToast(`Joined channel #${clean}`);
    }
  };

  // Connect to Firestore real-time listener for board data + active devices presence
  useEffect(() => {
    const cleanRoom = roomId.trim().toLowerCase() || 'global';
    const clientId = getClientId();

    // 1. Subscribe to Clipboard document in Firestore
    const docRef = doc(db, 'clipboards', cleanRoom);
    const unsubClipboard = onSnapshot(
      docRef,
      (docSnap) => {
        setIsConnected(true);
        if (docSnap.exists()) {
          const data = docSnap.data() as ClipboardData;
          if (!isTypingRef.current) {
            setText(data.text || '');
          }
          setFiles(data.files || []);
          setVersion(data.version || 1);
          setHistory(data.history || []);
          setLastSavedAt(data.updatedAt || new Date().toISOString());
        } else {
          // Initialize document in Firestore if not yet present
          const initData: ClipboardData = {
            roomId: cleanRoom,
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
          setDoc(docRef, initData, { merge: true });
        }
      },
      (err) => {
        console.error('Firestore onSnapshot error:', err);
        setIsConnected(false);
      }
    );

    // 2. Presence heartbeat for counting active devices
    const presenceDocRef = doc(db, 'clipboards', cleanRoom, 'presence', clientId);
    const sendHeartbeat = () => {
      setDoc(presenceDocRef, { clientId, lastSeen: Date.now() }, { merge: true }).catch(() => {});
    };
    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 4000);

    // 3. Presence collection listener to calculate active devices connected
    const presenceColRef = collection(db, 'clipboards', cleanRoom, 'presence');
    const unsubPresence = onSnapshot(
      presenceColRef,
      (snapshot) => {
        const now = Date.now();
        let activeCount = 0;
        snapshot.forEach((pDoc) => {
          const pData = pDoc.data();
          if (pData.lastSeen && now - pData.lastSeen < 12000) {
            activeCount++;
          }
        });
        setActiveClientsCount(Math.max(1, activeCount));
      },
      (err) => {
        console.error('Presence error:', err);
      }
    );

    return () => {
      unsubClipboard();
      unsubPresence();
      clearInterval(heartbeatTimer);
    };
  }, [roomId]);

  // Handle local text typing with instant Firestore sync
  const handleTextChange = (newText: string) => {
    setText(newText);
    isTypingRef.current = true;
    setIsSaving(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 1200);

    // Debounce save request to Firestore (300ms)
    if (saveDebounceTimeoutRef.current) clearTimeout(saveDebounceTimeoutRef.current);
    saveDebounceTimeoutRef.current = setTimeout(async () => {
      try {
        const cleanRoom = roomId.trim().toLowerCase() || 'global';
        const docRef = doc(db, 'clipboards', cleanRoom);
        const now = new Date().toISOString();

        // Calculate snapshot history
        const newHistory = [...history];
        const lastSnapshot = newHistory[0];
        if (
          !lastSnapshot ||
          Math.abs(lastSnapshot.text.length - newText.length) > 10 ||
          Date.now() - new Date(lastSnapshot.timestamp).getTime() > 60000
        ) {
          newHistory.unshift({
            id: `snap-${Date.now()}`,
            text: newText,
            timestamp: now,
            preview: newText.slice(0, 60).replace(/\n/g, ' ') || '(empty)',
          });
          if (newHistory.length > 20) {
            newHistory.slice(0, 20);
          }
        }

        const newVersion = version + 1;
        await setDoc(
          docRef,
          {
            text: newText,
            version: newVersion,
            updatedAt: now,
            history: newHistory,
          },
          { merge: true }
        );

        setLastSavedAt(now);
      } catch (err) {
        console.error('Firestore save error:', err);
      } finally {
        setIsSaving(false);
      }
    }, 300);
  };

  // Helper to convert small/medium files to data URLs for bulletproof cross-platform persistence
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // File upload handler
  const handleFileUpload = async (uploadFiles: FileList | File[]) => {
    if (!uploadFiles || uploadFiles.length === 0) return;

    setIsUploading(true);
    const cleanRoom = roomId.trim().toLowerCase() || 'global';
    const newFiles: UploadedFile[] = [];

    try {
      // First attempt server upload for large files
      const formData = new FormData();
      formData.append('roomId', cleanRoom);
      Array.from(uploadFiles).forEach((f) => formData.append('files', f));

      let serverFiles: UploadedFile[] = [];
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const json = await res.json();
          serverFiles = json.files || [];
        }
      } catch (e) {
        console.warn('Server upload endpoint bypassed or failed, falling back to data URL:', e);
      }

      // If server upload returned files, use them. Otherwise convert files to data URL
      if (serverFiles.length > 0) {
        newFiles.push(...serverFiles);
      } else {
        for (const file of Array.from(uploadFiles)) {
          let dataUrl = '';
          if (file.size < 10 * 1024 * 1024) { // Under 10MB
            dataUrl = await fileToDataURL(file);
          }
          newFiles.push({
            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            filename: file.name,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            url: dataUrl || '',
            uploadedAt: new Date().toISOString(),
          });
        }
      }

      const updatedFileList = [...newFiles, ...files];
      const docRef = doc(db, 'clipboards', cleanRoom);
      const now = new Date().toISOString();

      await setDoc(
        docRef,
        {
          files: updatedFileList,
          version: version + 1,
          updatedAt: now,
        },
        { merge: true }
      );

      setLastSavedAt(now);
      showToast(`${uploadFiles.length} ${uploadFiles.length === 1 ? 'file' : 'files'} attached successfully!`);
    } catch (err) {
      console.error('File upload error:', err);
      showToast('Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete attached file
  const handleDeleteFile = async (fileId: string) => {
    try {
      const cleanRoom = roomId.trim().toLowerCase() || 'global';
      const updatedFiles = files.filter((f) => f.id !== fileId);
      const docRef = doc(db, 'clipboards', cleanRoom);
      const now = new Date().toISOString();

      await setDoc(
        docRef,
        {
          files: updatedFiles,
          version: version + 1,
          updatedAt: now,
        },
        { merge: true }
      );

      // Also call server API clean up if possible
      fetch(`/api/files/${fileId}?room=${encodeURIComponent(cleanRoom)}`, { method: 'DELETE' }).catch(() => {});

      showToast('File removed');
    } catch (err) {
      console.error('Delete file error:', err);
    }
  };

  // Clear board
  const handleClearBoard = async () => {
    if (confirm('Are you sure you want to clear text and files on this public board?')) {
      try {
        const cleanRoom = roomId.trim().toLowerCase() || 'global';
        const docRef = doc(db, 'clipboards', cleanRoom);
        const now = new Date().toISOString();

        setText('');
        setFiles([]);

        await setDoc(
          docRef,
          {
            text: '',
            files: [],
            version: version + 1,
            updatedAt: now,
          },
          { merge: true }
        );

        showToast('Public clipboard cleared');
      } catch (err) {
        console.error('Clear error:', err);
      }
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(text);
    setHasCopiedHeader(true);
    showToast('Copied text to clipboard');
    setTimeout(() => setHasCopiedHeader(false), 2000);
  };

  const handleRestoreHistory = (historicalText: string) => {
    handleTextChange(historicalText);
    showToast('Restored previous text version');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-indigo-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-indigo-400 flex items-center gap-2 animate-bounce">
          <Zap className="w-4 h-4 text-amber-300" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        roomId={roomId}
        onRoomChange={handleRoomChange}
        isConnected={isConnected}
        activeClientsCount={activeClientsCount}
        onOpenQR={() => setIsQRModalOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onClear={handleClearBoard}
        onCopyAll={handleCopyAll}
        hasCopiedText={hasCopiedHeader}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
      />

      {/* Hero Banner / Instructions */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Cloud Synchronization</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              Anything typed or attached below is publicly accessible across all devices live. Scan the QR code or share the URL to sync your phone, laptop, or tablet!
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs px-3.5 py-2 rounded-xl font-medium flex items-center gap-2 transition-all"
            >
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>Scan QR for Phone</span>
            </button>
          </div>
        </div>

        {/* Text Area Board */}
        <MainTextEditor
          text={text}
          onChange={handleTextChange}
          onFileUpload={handleFileUpload}
          isSaving={isSaving}
          version={version}
        />

        {/* Attached Files Section */}
        <FileUploadZone
          files={files}
          onFileUpload={handleFileUpload}
          onDeleteFile={handleDeleteFile}
          isUploading={isUploading}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Public Clipboard — Firebase Powered Live Sync</span>
          <span className="text-slate-600">Channel #{roomId}</span>
        </div>
      </footer>

      {/* Modals */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomId={roomId}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        snapshots={history}
        onRestore={handleRestoreHistory}
      />
    </div>
  );
}
