import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { MainTextEditor } from './components/MainTextEditor';
import { FileUploadZone } from './components/FileUploadZone';
import { QRCodeModal } from './components/QRCodeModal';
import { HistoryModal } from './components/HistoryModal';
import { ClipboardData, UploadedFile, TextSnapshot } from './types';
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
  const [isConnected, setIsConnected] = useState<boolean>(false);
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
  const lastKnownVersionRef = useRef<number>(0);

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

  // Initial fetch of clipboard data
  const fetchClipboard = useCallback(async (targetRoom: string) => {
    try {
      const res = await fetch(`/api/clipboard?room=${encodeURIComponent(targetRoom)}`);
      if (res.ok) {
        const json = await res.json();
        const data: ClipboardData = json.data;
        if (data.version > lastKnownVersionRef.current) {
          lastKnownVersionRef.current = data.version;
          if (!isTypingRef.current) {
            setText(data.text || '');
          }
          setFiles(data.files || []);
          setVersion(data.version);
          setHistory(data.history || []);
          setLastSavedAt(data.updatedAt);
        }
        setActiveClientsCount(json.activeClientsCount || 1);
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Fetch clipboard error:', err);
      setIsConnected(false);
    }
  }, []);

  // Connect to SSE for real-time updates
  useEffect(() => {
    fetchClipboard(roomId);

    const eventSource = new EventSource(`/api/events?room=${encodeURIComponent(roomId)}`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'init' || payload.type === 'update') {
          const data: ClipboardData = payload.data;
          if (data.version > lastKnownVersionRef.current) {
            lastKnownVersionRef.current = data.version;
            if (!isTypingRef.current) {
              setText(data.text || '');
            }
            setFiles(data.files || []);
            setVersion(data.version);
            setHistory(data.history || []);
            setLastSavedAt(data.updatedAt);
          }
          if (typeof payload.activeClientsCount === 'number') {
            setActiveClientsCount(payload.activeClientsCount);
          }
          setIsConnected(true);
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    // Polling fallback every 3 seconds
    const interval = setInterval(() => {
      fetchClipboard(roomId);
    }, 3000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [roomId, fetchClipboard]);

  // Handle local text typing with server auto-sync
  const handleTextChange = (newText: string) => {
    setText(newText);
    isTypingRef.current = true;
    setIsSaving(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 1200);

    // Debounce save request to server
    if (saveDebounceTimeoutRef.current) clearTimeout(saveDebounceTimeoutRef.current);
    saveDebounceTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/clipboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, text: newText }),
        });
        if (res.ok) {
          const json = await res.json();
          const updated: ClipboardData = json.data;
          lastKnownVersionRef.current = updated.version;
          setVersion(updated.version);
          setHistory(updated.history || []);
          setLastSavedAt(updated.updatedAt);
        }
      } catch (err) {
        console.error('Save error:', err);
      } finally {
        setIsSaving(false);
      }
    }, 350);
  };

  // File upload handler
  const handleFileUpload = async (uploadFiles: FileList | File[]) => {
    if (!uploadFiles || uploadFiles.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('roomId', roomId);

    Array.from(uploadFiles).forEach((f) => {
      formData.append('files', f);
    });

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        const updated: ClipboardData = json.data;
        lastKnownVersionRef.current = updated.version;
        setFiles(updated.files || []);
        setVersion(updated.version);
        setLastSavedAt(updated.updatedAt);
        showToast(`${uploadFiles.length} ${uploadFiles.length === 1 ? 'file' : 'files'} uploaded successfully!`);
      } else {
        showToast('Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete attached file
  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}?room=${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const json = await res.json();
        const updated: ClipboardData = json.data;
        lastKnownVersionRef.current = updated.version;
        setFiles(updated.files || []);
        setVersion(updated.version);
        showToast('File removed');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Clear board
  const handleClearBoard = async () => {
    if (confirm('Are you sure you want to clear the text and attached files on this public board?')) {
      try {
        const res = await fetch('/api/clipboard/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, target: 'all' }),
        });
        if (res.ok) {
          const json = await res.json();
          const updated: ClipboardData = json.data;
          lastKnownVersionRef.current = updated.version;
          setText('');
          setFiles([]);
          setVersion(updated.version);
          showToast('Public clipboard cleared');
        }
      } catch (err) {
        console.error('Clear error:', err);
      }
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(text);
    setHasCopiedHeader(true);
    showToast('Copied all text to clipboard');
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
              <span>Instant Cross-Device Synchronization</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              Anything typed or dropped below is publicly accessible in real-time. Scan the QR code or share the URL to open it on your phone or another computer.
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
          <span>Public Clipboard — Real-time Notepad & File Hub</span>
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
