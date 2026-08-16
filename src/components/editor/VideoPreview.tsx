import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

export const VideoPreview: React.FC = () => {
  const { currentTime, isPlaying, setIsPlaying, setCurrentTime, duration, tracks, assets, isLooping = false } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Find the primary/active video item from tracks at current time
  const activeVideoItem = tracks
    .filter(item => item.type === 'video')
    .find(item => currentTime >= item.start && currentTime <= (item.start + item.duration));

  const activeAsset = activeVideoItem ? assets.find(a => a.id === activeVideoItem.assetId) : null;
  const videoSrc = activeAsset ? activeAsset.src : null;

  // Sync video time with editor currentTime
  useEffect(() => {
    if (!videoRef.current || !activeVideoItem) return;

    const video = videoRef.current;
    const itemRelativeTime = (currentTime - activeVideoItem.start) + (activeVideoItem.offset || 0);

    if (Math.abs(video.currentTime - itemRelativeTime) > 0.15) {
      video.currentTime = Math.max(0, itemRelativeTime);
    }
  }, [currentTime, activeVideoItem]);

  // Sync play/pause state
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, videoSrc]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative flex-1 bg-[#0d0d0f] flex items-center justify-center p-4 overflow-hidden select-none"
      id="video-preview-container"
    >
      <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center group">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain pointer-events-auto"
            muted={isMuted}
            playsInline
            onTimeUpdate={() => {
              if (isPlaying && videoRef.current && activeVideoItem) {
                const calculatedCurrentTime = activeVideoItem.start + (videoRef.current.currentTime - (activeVideoItem.offset || 0));
                if (Math.abs(calculatedCurrentTime - currentTime) > 0.05) {
                  setCurrentTime(calculatedCurrentTime);
                }
              }
            }}
            onEnded={() => {
              if (isLooping) {
                setCurrentTime(0);
              } else {
                setIsPlaying(false);
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-white/40 text-center p-6 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
              <Play className="w-8 h-8 text-cyan-400 opacity-60 pl-1" />
            </div>
            <p className="text-sm font-medium text-white/70">Video Preview Stage</p>
            <p className="text-xs text-white/40 max-w-xs">
              Add video tracks to the timeline to render and play video clips in real time.
            </p>
          </div>
        )}

        {/* Video Overlays and Controls */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <div className="font-mono text-xs text-white/80 bg-black/60 px-2.5 py-1 rounded-md border border-white/10">
              {currentTime.toFixed(2)}s / {(duration || 0).toFixed(2)}s
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Toggle Fullscreen"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;
