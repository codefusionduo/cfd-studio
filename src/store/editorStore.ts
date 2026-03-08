import { create } from 'zustand';
import { temporal } from 'zundo';
import { Asset, EditorState, TrackItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface EditorStore extends EditorState {
  addAsset: (asset: Asset) => void;
  addTrackItem: (item: Omit<TrackItem, 'id'>) => void;
  updateTrackItem: (id: string, updates: Partial<TrackItem>) => void;
  removeTrackItem: (id: string) => void;
  splitTrackItem: (id: string, splitTime: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSelectedItem: (id: string | null) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setZoom: (zoom: number) => void;
}

export const useEditorStore = create<EditorStore>()(
  temporal(
    (set) => ({
      assets: [],
      tracks: [],
      currentTime: 0,
      isPlaying: false,
      duration: 30, // Default 30s timeline
      selectedItemId: null,
      canvasSize: { width: 1080, height: 1920 }, // Default 9:16 (TikTok/Reels style)
      zoom: 10, // Pixels per second

      addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
      
      addTrackItem: (item) => set((state) => {
        const newItem = { ...item, id: uuidv4() };
        return { tracks: [...state.tracks, newItem] };
      }),

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
    }),
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
