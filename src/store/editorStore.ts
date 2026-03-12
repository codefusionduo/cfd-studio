import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { Asset, EditorState, TrackItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface EditorStore extends EditorState {
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  addTrackItem: (item: Omit<TrackItem, 'id'>) => string;
  updateTrackItem: (id: string, updates: Partial<TrackItem>) => void;
  removeTrackItem: (id: string) => void;
  splitTrackItem: (id: string, splitTime: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSelectedItem: (id: string | null) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setZoom: (zoom: number) => void;
  previewZoom: number | 'fit';
  setPreviewZoom: (zoom: number | 'fit') => void;
  clearAll: () => void;
}

export const useEditorStore = create<EditorStore>()(
  temporal(
    persist(
      (set) => ({
        assets: [],
        tracks: [],
        currentTime: 0,
        isPlaying: false,
        duration: 30, // Default 30s timeline
        selectedItemId: null,
        canvasSize: { width: 1080, height: 1920 }, // Default 9:16 (TikTok/Reels style)
        zoom: 10, // Pixels per second
        previewZoom: 'fit',

        addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
        
        updateAsset: (id, updates) => set((state) => ({
          assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

        removeAsset: (id) => set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
          // Also remove any track items that use this asset
          tracks: state.tracks.filter((t) => t.assetId !== id),
          selectedItemId: state.tracks.find(t => t.id === state.selectedItemId)?.assetId === id ? null : state.selectedItemId,
        })),

        addTrackItem: (item) => {
          const id = uuidv4();
          const newItem = { ...item, id };
          set((state) => ({ tracks: [...state.tracks, newItem] }));
          return id;
        },

        updateTrackItem: (id, updates) => set((state) => ({
          tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

        removeTrackItem: (id) => set((state) => ({
          tracks: state.tracks.filter((t) => t.id !== id),
          selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
        })),

        splitTrackItem: (id, splitTime) => set((state) => {
          const itemIndex = state.tracks.findIndex((t) => t.id === id);
          if (itemIndex === -1) return {};

          const item = state.tracks[itemIndex];
          // Check if split time is valid within the clip
          if (splitTime <= item.start || splitTime >= item.start + item.duration) {
            return {};
          }

          const splitOffset = splitTime - item.start;
          const firstHalfDuration = splitOffset;
          const secondHalfDuration = item.duration - splitOffset;
          const playbackRate = item.playbackRate || 1;

          // Create second half
          const secondHalf: TrackItem = {
            ...item,
            id: uuidv4(),
            start: splitTime,
            duration: secondHalfDuration,
            offset: item.offset + (splitOffset * playbackRate),
          };

          // Update first half
          const updatedTracks = [...state.tracks];
          updatedTracks[itemIndex] = {
            ...item,
            duration: firstHalfDuration,
          };
          updatedTracks.push(secondHalf);

          return { tracks: updatedTracks, selectedItemId: secondHalf.id };
        }),

        setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
        setIsPlaying: (isPlaying) => set({ isPlaying }),
        setSelectedItem: (id) => set({ selectedItemId: id }),
        setCanvasSize: (size) => set({ canvasSize: size }),
        setZoom: (zoom) => set({ zoom }),
        setPreviewZoom: (previewZoom) => set({ previewZoom }),
        clearAll: () => set({ assets: [], tracks: [], selectedItemId: null, currentTime: 0 }),
      }),
      {
        name: 'editor-storage',
        partialize: (state) => ({
          canvasSize: state.canvasSize,
          duration: state.duration,
        }),
      }
    ),
    {
      partialize: (state) => ({
        tracks: state.tracks,
        assets: state.assets,
        canvasSize: state.canvasSize,
        duration: state.duration,
      }),
      limit: 100,
    }
  )
);
