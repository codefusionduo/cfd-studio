import { createH264MP4Encoder } from 'h264-mp4-encoder';
import { useEditorStore } from '../store/editorStore';

export interface ExportOptions {
  name: string;
  resolution: string;
  frameRate: string;
}

export async function exportToMP4(
  options: ExportOptions,
  onProgress: (progress: number, statusText: string) => void
): Promise<Blob> {
  const store = useEditorStore.getState();
  
  // Calculate total duration based on timeline content
  const contentDuration = store.tracks.length > 0 
    ? Math.max(...store.tracks.map(t => t.start + t.duration)) 
    : store.duration;
  const duration = contentDuration > 0 ? contentDuration : store.duration;
  
  // Get and parse frame rate
  const fps = parseInt(options.frameRate) || 30;
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  
  onProgress(0, 'Initializing H.264 MP4 Encoder...');
  
  // Find the high-resolution Konva canvas
  const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found. Please ensure the preview screen is visible.');
  }
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Create H264MP4Encoder instance
  const encoder = await createH264MP4Encoder();
  encoder.width = width;
  encoder.height = height;
  encoder.frameRate = fps;
  encoder.kbps = 15000; // 15 Mbps for rich, crisp export quality
  encoder.speed = 10;   // Fastest encoding speed (excellent quality, great browser performance)
  encoder.outputFilename = 'output.mp4';
  
  encoder.initialize();
  
  // Save original timeline states to restore after exporting
  const wasPlaying = store.isPlaying;
  const originalTime = store.currentTime;
  
  // Pause playback during rendering
  store.setIsPlaying(false);
  
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not obtain 2D canvas rendering context.');
    }
    
    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / fps;
      
      // Seek timeline to the current frame timestamp
      store.setCurrentTime(t);
      
      // Wait for React to render, update effects, and video elements to seek
      // 80ms is an optimal and highly reliable timeframe to render and decode frames in full-resolution
      await new Promise(resolve => setTimeout(resolve, 80));
      
      // Capture the exact pixels from the high-resolution canvas
      const imgData = ctx.getImageData(0, 0, width, height);
      encoder.addFrameRgba(imgData.data);
      
      // Dispatch progress callback
      const progress = Math.round((frame / totalFrames) * 100);
      onProgress(progress, `Rendering frame ${frame + 1} of ${totalFrames} (${t.toFixed(2)}s)...`);
    }
    
    onProgress(98, 'Bundling into final MP4 video...');
    encoder.finalize();
    
    // Read the compiled MP4 file from the Emscripten virtual filesystem
    const uint8Array = encoder.FS.readFile(encoder.outputFilename);
    const blob = new Blob([uint8Array], { type: 'video/mp4' });
    
    onProgress(100, 'Export complete!');
    return blob;
  } catch (error) {
    console.error('Error during MP4 export:', error);
    throw error;
  } finally {
    // Restore the editor state
    store.setCurrentTime(originalTime);
    store.setIsPlaying(wasPlaying);
    
    // Release WebAssembly encoder memory
    encoder.delete();
  }
}
