export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface TextSnapshot {
  id: string;
  text: string;
  timestamp: string;
  preview: string;
}

export interface ClipboardData {
  roomId: string;
  text: string;
  files: UploadedFile[];
  version: number;
  updatedAt: string;
  history?: TextSnapshot[];
}

export interface ServerStateResponse {
  data: ClipboardData;
  activeClientsCount: number;
}
