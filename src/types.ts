export interface Asset {
  id: string;
  type: 'video' | 'image' | 'audio';
  src: string;
  name: string;
  duration?: number; // in seconds
  width?: number;
  height?: number;
}

export interface Keyframe {
  time: number; // Time relative to the start of the track item (0 to duration)
  value: number;
}

export interface TrackItem {
  id: string;
  assetId: string;
  start: number; // start time on timeline (seconds)
  duration: number; // duration of the clip (seconds)
  offset: number; // start time within the source asset (seconds)
  layer: number; // z-index equivalent
  type: 'video' | 'image' | 'text' | 'audio';
  // Visual properties
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  text?: string; // For text layers
  fontSize?: number;
  fontFill?: string;
  textAnimation?: 'none' | 'fade' | 'slide' | 'typewriter';
  fadeIn?: number; // duration in seconds
  fadeOut?: number; // duration in seconds
  transitionInType?: 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'zoom-out';
  transitionOutType?: 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'zoom-out';
  playbackRate?: number;
  
  // Color correction
  brightness?: number; // 0 to 200, default 100
  contrast?: number; // 0 to 200, default 100
  saturation?: number; // 0 to 200, default 100
  effect?: 'none' | 'grayscale' | 'sepia' | 'blur' | 'invert' | 'hue-rotate';

  // Keyframes
  keyframes?: {
    x?: Keyframe[];
    y?: Keyframe[];
    width?: Keyframe[];
    height?: Keyframe[];
    rotation?: Keyframe[];
  };
}

export interface EditorState {
  assets: Asset[];
  tracks: TrackItem[];
  currentTime: number;
  isPlaying: boolean;
  duration: number; // Total project duration
  selectedItemId: string | null;
  canvasSize: { width: number; height: number };
  zoom: number; // Timeline zoom level
}
