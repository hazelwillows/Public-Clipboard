import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Trash2,
  Clock,
  Sparkles,
  Type,
  Code,
  FileText,
  UploadCloud,
  FileCode,
  Scissors,
  Clipboard,
  AlignLeft,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface MainTextEditorProps {
  text: string;
  onChange: (newText: string) => void;
  onFileUpload: (files: FileList | File[]) => void;
  isSaving: boolean;
  version: number;
}

export const MainTextEditor: React.FC<MainTextEditorProps> = ({
  text,
  onChange,
  onFileUpload,
  isSaving,
  version,
}) => {
  const [fontFamily, setFontFamily] = useState<'sans' | 'mono' | 'serif'>('mono');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Word and character stats
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lineCount = text ? text.split('\n').length : 1;
  const estimatedReadingTime = Math.ceil(wordCount / 200);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const updated = text.substring(0, start) + clipboardText + text.substring(end);
          onChange(updated);
        } else {
          onChange(text + clipboardText);
        }
      }
    } catch (e) {
      // If permission denied, focus text area
      textareaRef.current?.focus();
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clipboard-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInsertTimestamp = () => {
    const now = `[${new Date().toLocaleString()}]\n`;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const updated = text.substring(0, start) + now + text.substring(end);
      onChange(updated);
    } else {
      onChange(text + now);
    }
  };

  const handleTransformCase = (mode: 'upper' | 'lower' | 'trim' | 'formatJSON') => {
    if (mode === 'upper') onChange(text.toUpperCase());
    if (mode === 'lower') onChange(text.toLowerCase());
    if (mode === 'trim') onChange(text.trim());
    if (mode === 'formatJSON') {
      try {
        const parsed = JSON.parse(text);
        onChange(JSON.stringify(parsed, null, 2));
      } catch (err) {
        alert('Text is not valid JSON');
      }
    }
  };

  // Drag and Drop handlers for file upload directly into textbox
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files);
    }
  };

  // Font styling class mapping
  const fontClasses = {
    mono: 'font-mono tracking-tight',
    sans: 'font-sans',
    serif: 'font-serif',
  };

  const sizeClasses = {
    sm: 'text-xs leading-relaxed',
    base: 'text-sm leading-relaxed',
    lg: 'text-base leading-relaxed',
    xl: 'text-lg leading-relaxed',
  };

  return (
    <div
      className={`relative bg-slate-900/90 border rounded-2xl shadow-xl flex flex-col transition-all duration-200 overflow-hidden ${
        isDragOver ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800'
      } ${isFullscreen ? 'fixed inset-4 z-50 rounded-xl' : 'w-full'}`}
    >
      {/* Editor Toolbar */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-300">
        
        {/* Left Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Font Family selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setFontFamily('mono')}
              className={`px-2 py-1 rounded-md transition-colors ${
                fontFamily === 'mono' ? 'bg-indigo-600 text-white font-mono' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Monospace Font"
            >
              Code
            </button>
            <button
              onClick={() => setFontFamily('sans')}
              className={`px-2 py-1 rounded-md transition-colors ${
                fontFamily === 'sans' ? 'bg-indigo-600 text-white font-sans' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sans-serif Font"
            >
              Sans
            </button>
            <button
              onClick={() => setFontFamily('serif')}
              className={`px-2 py-1 rounded-md transition-colors ${
                fontFamily === 'serif' ? 'bg-indigo-600 text-white font-serif' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Serif Font"
            >
              Serif
            </button>
          </div>

          {/* Font Size selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => setFontSize(sz)}
                className={`px-2 py-1 rounded-md uppercase font-medium transition-colors ${
                  fontSize === sz ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Quick Actions */}
          <button
            onClick={handlePaste}
            className="hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 transition-colors"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Paste</span>
          </button>

          <button
            onClick={handleInsertTimestamp}
            className="hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 transition-colors"
            title="Insert timestamp at cursor"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Timestamp</span>
          </button>

          <button
            onClick={() => handleTransformCase('formatJSON')}
            className="hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 transition-colors"
            title="Format text as clean JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Format JSON</span>
          </button>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!text}
            className="hover:bg-slate-800 disabled:opacity-40 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 transition-colors"
            title="Save text as .txt file"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Download .txt</span>
          </button>

          <button
            onClick={handleCopy}
            className="bg-indigo-600/90 hover:bg-indigo-600 text-white px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium shadow-sm"
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

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="hover:bg-slate-800 text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Editor'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Main Text Area Container with Drag and Drop Overlay */}
      <div
        className="relative flex-1 bg-slate-900/60 flex"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Line Numbers sidebar */}
        <div className="bg-slate-950/40 select-none text-slate-600 border-r border-slate-800/80 px-3 py-4 text-right font-mono text-xs hidden sm:block overflow-hidden min-w-[2.75rem]">
          {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
            <div key={i} className="leading-relaxed">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type or paste any text here... It syncs automatically across all your devices in real-time. Drop files here to upload!"
          className={`w-full p-4 bg-transparent text-slate-100 focus:outline-none resize-none min-h-[320px] ${
            isFullscreen ? 'h-full' : 'h-[360px] md:h-[420px]'
          } ${fontClasses[fontFamily]} ${sizeClasses[fontSize]} placeholder:text-slate-600 selection:bg-indigo-600 selection:text-white`}
          spellCheck={false}
        />

        {/* Drag and Drop visual overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-indigo-950/90 backdrop-blur-sm border-2 border-dashed border-indigo-400 rounded-xl flex flex-col items-center justify-center text-indigo-100 z-20 pointer-events-none p-6 text-center animate-fade-in">
            <UploadCloud className="w-16 h-16 text-indigo-400 animate-bounce mb-3" />
            <p className="text-lg font-semibold text-white">Drop files to upload</p>
            <p className="text-xs text-indigo-300 mt-1">Files will be attached to this public clipboard board instantly</p>
          </div>
        )}
      </div>

      {/* Footer Stats Bar */}
      <div className="bg-slate-950/90 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            <strong className="text-slate-200">{charCount}</strong> characters
          </span>
          <span>•</span>
          <span>
            <strong className="text-slate-200">{wordCount}</strong> words
          </span>
          <span>•</span>
          <span>
            <strong className="text-slate-200">{lineCount}</strong> lines
          </span>
          {wordCount > 0 && (
            <>
              <span>•</span>
              <span className="text-slate-500">~{estimatedReadingTime} min read</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
          <span>Version #{version}</span>
          <span>•</span>
          <span>Drag & Drop files onto board</span>
        </div>
      </div>
    </div>
  );
};
