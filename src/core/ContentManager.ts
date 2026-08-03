import type { ContentItem, Playlist } from '../types';
import { uid } from '../utils/math';

export class ContentManager {
  items: Map<string, ContentItem> = new Map();
  playlists: Map<string, Playlist> = new Map();
  private activeWebcams: Map<string, MediaStream> = new Map();

  constructor() {
    // Initialize with built-in patterns
    this.addPattern('checker', 'Checker');
    this.addPattern('colorbars', 'Color Bars');
    this.addPattern('grid', 'Grid');
    this.addPattern('gradient', 'Gradient');
    this.addPattern('brightness', 'Brightness Ramp');
  }

  private addPattern(id: string, name: string) {
    this.items.set(id, {
      id,
      name,
      type: 'pattern',
      src: id,
      loop: true,
      volume: 0,
    });
  }

  addImage(name: string, src: string): ContentItem {
    const item: ContentItem = {
      id: uid(),
      name,
      type: 'image',
      src,
      loop: true,
      volume: 0,
    };
    this.items.set(item.id, item);
    return item;
  }

  addVideo(name: string, src: string): ContentItem {
    const item: ContentItem = {
      id: uid(),
      name,
      type: 'video',
      src,
      loop: true,
      volume: 0,
    };
    this.items.set(item.id, item);
    return item;
  }

  addSolidColor(name: string, color: string): ContentItem {
    const item: ContentItem = {
      id: uid(),
      name,
      type: 'color',
      src: color,
      loop: true,
      volume: 0,
    };
    this.items.set(item.id, item);
    return item;
  }

  addWebcam(name: string): ContentItem {
    const item: ContentItem = {
      id: uid(),
      name,
      type: 'webcam',
      src: '',
      loop: true,
      volume: 0,
    };
    this.items.set(item.id, item);
    return item;
  }

  addNDI(name: string, src: string): ContentItem {
    const item: ContentItem = {
      id: uid(),
      name,
      type: 'ndi',
      src,
      loop: true,
      volume: 0,
    };
    this.items.set(item.id, item);
    return item;
  }

  removeItem(id: string) {
    const item = this.items.get(id);
    if (item?.type === 'webcam') {
      this.stopWebcam(id);
    }
    this.items.delete(id);
  }

  getItem(id: string): ContentItem | undefined {
    return this.items.get(id);
  }

  getAllItems(): ContentItem[] {
    return Array.from(this.items.values());
  }

  getBuiltInPatterns(): ContentItem[] {
    return this.getAllItems().filter(i => i.type === 'pattern');
  }

  getUserContent(): ContentItem[] {
    return this.getAllItems().filter(i => i.type !== 'pattern');
  }

  // Playlist management
  createPlaylist(name: string): Playlist {
    const playlist: Playlist = {
      id: uid(),
      name,
      items: [],
      currentIndex: 0,
      autoAdvance: true,
      transitionDuration: 0.5,
    };
    this.playlists.set(playlist.id, playlist);
    return playlist;
  }

  addToPlaylist(playlistId: string, contentId: string) {
    const playlist = this.playlists.get(playlistId);
    if (playlist && this.items.has(contentId)) {
      playlist.items.push(contentId);
    }
  }

  removeFromPlaylist(playlistId: string, index: number) {
    const playlist = this.playlists.get(playlistId);
    if (playlist) {
      playlist.items.splice(index, 1);
      if (playlist.currentIndex >= playlist.items.length) {
        playlist.currentIndex = Math.max(0, playlist.items.length - 1);
      }
    }
  }

  advancePlaylist(playlistId: string): ContentItem | null {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || playlist.items.length === 0) return null;

    playlist.currentIndex = (playlist.currentIndex + 1) % playlist.items.length;
    return this.items.get(playlist.items[playlist.currentIndex]) || null;
  }

  getCurrentPlaylistItem(playlistId: string): ContentItem | null {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || playlist.items.length === 0) return null;
    return this.items.get(playlist.items[playlist.currentIndex]) || null;
  }

  deletePlaylist(id: string) {
    this.playlists.delete(id);
  }

  // Webcam management
  async startWebcam(contentId: string): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1920, height: 1080 },
      audio: false,
    });
    this.activeWebcams.set(contentId, stream);
    return stream;
  }

  stopWebcam(contentId: string) {
    const stream = this.activeWebcams.get(contentId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      this.activeWebcams.delete(contentId);
    }
  }

  // Load media from file
  async loadFile(file: File): Promise<ContentItem> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);

      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => resolve(this.addImage(file.name, url));
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      } else if (file.type.startsWith('video/')) {
        resolve(this.addVideo(file.name, url));
      } else {
        reject(new Error('Unsupported file type'));
      }
    });
  }

  // Load from URL
  async loadURL(url: string, name?: string): Promise<ContentItem> {
    const isVideo = /\.(mp4|webm|mov|avi)$/i.test(url);
    if (isVideo) {
      return this.addVideo(name || url.split('/').pop() || 'Video', url);
    } else {
      return this.addImage(name || url.split('/').pop() || 'Image', url);
    }
  }

  // Export/Import
  exportData(): { items: ContentItem[]; playlists: Playlist[] } {
    return {
      items: Array.from(this.items.values()),
      playlists: Array.from(this.playlists.values()),
    };
  }

  importData(data: { items: ContentItem[]; playlists: Playlist[] }) {
    for (const item of data.items) {
      this.items.set(item.id, item);
    }
    for (const playlist of data.playlists) {
      this.playlists.set(playlist.id, playlist);
    }
  }

  destroy() {
    this.activeWebcams.forEach(stream => {
      stream.getTracks().forEach(t => t.stop());
    });
    this.activeWebcams.clear();
  }
}
