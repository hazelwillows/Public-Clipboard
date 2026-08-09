import React from 'react';
import { X, History, RotateCcw, Clock, Trash2 } from 'lucide-react';
import { TextSnapshot } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: TextSnapshot[];
  onRestore: (text: string) => void;
  onClearHistory?: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  onRestore,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  const handleEraseClick = () => {
    if (confirm('Are you sure you want to permanently delete all history snapshots and erase them from Firebase? This action cannot be undone.')) {
      if (onClearHistory) {
        onClearHistory();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Text History & Backups</h3>
              <p className="text-xs text-slate-400">Previous text versions captured during live editing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshots List */}
        <div className="my-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {snapshots.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              No previous history snapshots recorded yet
            </div>
          ) : (
            snapshots.map((snap, idx) => (
              <div
                key={snap.id || idx}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl transition-all group flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    {new Date(snap.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {snap.text.length} chars
                  </span>
                </div>

                <p className="text-xs text-slate-300 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 line-clamp-3 whitespace-pre-wrap break-all">
                  {snap.text || '(empty)'}
                </p>

                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={() => {
                      onRestore(snap.text);
                      onClose();
                    }}
                    className="bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore this version
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Clear History Option */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Snapshots are automatically captured during major edits
          </p>
          {snapshots.length > 0 && onClearHistory && (
            <button
              onClick={handleEraseClick}
              className="w-full sm:w-auto bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs px-3 py-1.5 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Erase All History
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
