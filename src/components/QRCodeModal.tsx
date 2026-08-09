import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Smartphone, Link, ExternalLink, ShieldCheck } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, roomId }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build the public link URL with current origin and room query
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}${window.location.pathname}${roomId !== 'global' ? `?room=${roomId}` : ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Connect Device</h3>
              <p className="text-xs text-slate-400">Scan to access this exact clipboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code display */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-200">
            <QRCodeSVG
              value={shareUrl}
              size={190}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="H"
              includeMargin={false}
            />
          </div>

          <p className="text-xs text-slate-300 font-medium mt-4 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Live sync active for channel: <strong className="text-indigo-400">#{roomId}</strong>
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 mb-5">
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              1
            </span>
            <span>Open your phone or tablet camera app</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              2
            </span>
            <span>Scan the QR code to open this page instantly</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              3
            </span>
            <span>Type or upload files on either device — both stay synchronized live!</span>
          </div>
        </div>

        {/* Direct Link Share Box */}
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Shareable URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2 rounded-xl w-full focus:outline-none font-mono selection:bg-indigo-600 selection:text-white"
            />
            <button
              onClick={handleCopy}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
