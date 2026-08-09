import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  File,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Code,
  Download,
  Trash2,
  Copy,
  Check,
  Eye,
  ExternalLink,
  X
} from 'lucide-react';
import { UploadedFile } from '../types';

interface FileUploadZoneProps {
  files: UploadedFile[];
  onFileUpload: (files: FileList | File[]) => void;
  onDeleteFile: (fileId: string) => void;
  isUploading: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  files,
  onFileUpload,
  onDeleteFile,
  isUploading,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-400" />;
    if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-rose-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-amber-400" />;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="w-5 h-5 text-emerald-400" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <Archive className="w-5 h-5 text-purple-400" />;
    if (filename.match(/\.(js|ts|tsx|jsx|json|py|html|css|cpp|c|go|rs|sh)$/i)) return <Code className="w-5 h-5 text-cyan-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const handleCopyLink = (file: UploadedFile) => {
    const fullUrl = `${window.location.origin}${file.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mt-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-400" />
            Public Attached Files
            {files.length > 0 && (
              <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs px-2 py-0.5 rounded-full font-medium">
                {files.length}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Files uploaded here are instantly accessible and downloadable on any device opening this board
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
        >
          <UploadCloud className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Upload Files'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Drop Target Banner / Quick Trigger */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-slate-950/80 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 group mb-4"
      >
        <div className="flex items-center justify-center gap-2 text-slate-400 group-hover:text-indigo-300">
          <UploadCloud className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          <span className="text-xs font-medium">
            Click here or drag files anywhere onto this page to upload (images, docs, audio, code, zip)
          </span>
        </div>
      </div>

      {/* Files Grid / List */}
      {files.length === 0 ? (
        <div className="text-center py-6 border border-slate-800/60 rounded-xl bg-slate-950/20">
          <File className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">No files attached yet</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Upload a photo, PDF, or document to share it across your devices</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file) => {
            const isImage = file.mimeType.startsWith('image/');
            return (
              <div
                key={file.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between transition-all group hover:shadow-lg"
              >
                {/* File Header */}
                <div className="flex items-start gap-3">
                  {/* Thumbnail / Icon */}
                  {isImage ? (
                    <div
                      onClick={() => setPreviewFile(file)}
                      className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 cursor-pointer relative group/img"
                    >
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      {getFileIcon(file.mimeType, file.originalName)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors cursor-pointer"
                      onClick={() => (isImage ? setPreviewFile(file) : window.open(file.url, '_blank'))}
                      title={file.originalName}
                    >
                      {file.originalName}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{new Date(file.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                {/* File Actions */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 mt-3">
                  <div className="flex items-center gap-1">
                    {isImage && (
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
                        title="Quick Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyLink(file)}
                      className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px]"
                      title="Copy Public File Link"
                    >
                      {copiedId === file.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <a
                      href={file.url}
                      download={file.originalName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3 text-indigo-400" />
                      Download
                    </a>
                    <button
                      onClick={() => onDeleteFile(file.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-950/40 transition-colors"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal for Images or Media */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-4 overflow-hidden relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 truncate pr-4">
                {previewFile.originalName}
              </h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto my-4 flex items-center justify-center min-h-[250px]">
              {previewFile.mimeType.startsWith('image/') ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.originalName}
                  className="max-h-[60vh] object-contain rounded-lg shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : previewFile.mimeType.startsWith('audio/') ? (
                <audio controls className="w-full">
                  <source src={previewFile.url} type={previewFile.mimeType} />
                  Your browser does not support audio playback.
                </audio>
              ) : previewFile.mimeType.startsWith('video/') ? (
                <video controls className="max-h-[60vh] w-full rounded-lg">
                  <source src={previewFile.url} type={previewFile.mimeType} />
                  Your browser does not support video playback.
                </video>
              ) : (
                <div className="text-center py-8">
                  <File className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Preview not available for this file type</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <a
                href={previewFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in New Tab
              </a>
              <a
                href={previewFile.url}
                download={previewFile.originalName}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download File
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
