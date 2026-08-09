import React, { useState } from 'react';
import { Share2, QrCode, Monitor, Copy, Check, History, Trash2, Layers, RefreshCw } from 'lucide-react';

interface HeaderProps {
  roomId: string;
  onRoomChange: (newRoom: string) => void;
  isConnected: boolean;
  activeClientsCount: number;
  onOpenQR: () => void;
  onOpenHistory: () => void;
  onClear: () => void;
  onCopyAll: () => void;
  hasCopiedText: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  onRoomChange,
  isConnected,
  activeClientsCount,
  onOpenQR,
  onOpenHistory,
  onClear,
  onCopyAll,
  hasCopiedText,
  isSaving,
  lastSavedAt,
}) => {
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [roomInput, setRoomInput] = useState(roomId);

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) {
      onRoomChange(roomInput.trim().toLowerCase());
      setIsEditingRoom(false);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 px-4 py-3 sm:px-6 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Brand logo & Room Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-slate-50 tracking-tight leading-tight flex items-center gap-2">
                Public Clipboard
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {isConnected ? 'Live Sync' : 'Connecting...'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Monitor className="w-3 h-3 text-indigo-400" />
                  {activeClientsCount} {activeClientsCount === 1 ? 'device' : 'devices'} active
                </span>
              </div>
            </div>
          </div>

          {/* Room Pill */}
          <div className="flex items-center ml-2">
            {isEditingRoom ? (
              <form onSubmit={handleRoomSubmit} className="flex items-center gap-1">
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="channel-name"
                  className="bg-slate-800 border border-indigo-500 text-xs px-2.5 py-1 rounded-lg text-white focus:outline-none w-28"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Join
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setRoomInput(roomId);
                  setIsEditingRoom(true);
                }}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors group"
                title="Click to switch public channel/room"
              >
                <span className="text-slate-400 group-hover:text-indigo-400">#</span>
                <span className="font-medium text-slate-200">{roomId}</span>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded ml-1">Change</span>
              </button>
            )}
          </div>
        </div>

        {/* Status indicator & Right Action buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
          {/* Save Status pill */}
          <div className="text-xs text-slate-400 mr-2 hidden sm:flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-800">
            {isSaving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                <span className="text-indigo-300">Syncing changes...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'All changes saved'}
                </span>
              </>
            )}
          </div>

          {/* Quick Copy Text */}
          <button
            onClick={onCopyAll}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
            title="Copy all textbox text"
          >
            {hasCopiedText ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          {/* Scan QR Code for Mobile device sync */}
          <button
            onClick={onOpenQR}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            title="Open QR Code to open on mobile phone"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Connect Device</span>
            <span className="sm:hidden">QR</span>
          </button>

          {/* History / Snapshots */}
          <button
            onClick={onOpenHistory}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
            title="View text history & backups"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Clear board */}
          <button
            onClick={onClear}
            className="bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-800 text-slate-400 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
            title="Clear text & attachments"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </header>
  );
};
