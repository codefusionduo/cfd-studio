import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Scissors, Trash2, Volume2, ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';

const Playhead = ({ zoom }: { zoom: number }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  return (
    <div 
      className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
      style={{ left: currentTime * zoom }}
    >
      <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-red-500 rotate-45" />
    </div>
  );
};

const TimeDisplay = () => {
  const currentTime = useEditorStore(state => state.currentTime);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  return <span className="font-mono text-sm text-white/70">{formatTime(currentTime)}</span>;
};

export default function Timeline() {
  const { 
    tracks, 
    assets,
    setCurrentTime, 
    isPlaying, 
    setIsPlaying, 
    duration,
    zoom,
    setZoom,
    selectedItemId,
    setSelectedItem,
    updateTrackItem,
    removeTrackItem,
    splitTrackItem
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [itemStartX, setItemStartX] = useState<number>(0);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  
  // Trimming state
  const [trimmingState, setTrimmingState] = useState<{
    id: string;
    side: 'start' | 'end';
    initialStart: number;
    initialDuration: number;
    initialOffset: number;
    startX: number;
  } | null>(null);

  // Fading state
  const [fadingState, setFadingState] = useState<{
    id: string;
    side: 'in' | 'out';
    initialFade: number;
    startX: number;
  } | null>(null);

  const tracksRef = useRef(tracks);
  const assetsRef = useRef(assets);
  
  useEffect(() => {
    tracksRef.current = tracks;
    assetsRef.current = assets;
  }, [tracks, assets]);

  // Sort tracks by layer descending for display (Top layer at top of list)
  const sortedTracks = [...tracks].sort((a, b) => b.layer - a.layer);

  // Calculate total content duration
  const contentDuration = tracks.length > 0 
    ? Math.max(...tracks.map(t => t.start + t.duration)) 
    : 0;
  
  // Effective timeline duration (at least default duration, or longer if content exists)
  const effectiveDuration = Math.max(duration, contentDuration);

  // Playback loop
  useEffect(() => {
    let lastTime = performance.now();
    
    const animate = (time: number) => {
      if (!useEditorStore.getState().isPlaying) {
        lastTime = time;
        return;
      }
      
      const currentStoreTime = useEditorStore.getState().currentTime;
      const stopTime = contentDuration > 0 ? contentDuration : duration;

      if (currentStoreTime >= stopTime) {
        setIsPlaying(false);
        return;
      }
      
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;
      
      const newTime = currentStoreTime + deltaTime;
      
      if (newTime >= stopTime) {
        setCurrentTime(stopTime);
        setIsPlaying(false);
      } else {
        setCurrentTime(newTime);
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      lastTime = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, duration, contentDuration, setCurrentTime, setIsPlaying]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (draggingId) return; // Don't seek if dragging
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollLeft = timelineRef.current.scrollLeft;
    const newTime = (x + scrollLeft) / zoom;
    setCurrentTime(Math.max(0, Math.min(effectiveDuration, newTime)));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      setZoom(Math.max(5, Math.min(100, zoom + delta)));
    } else {
      // Horizontal scroll
      if (timelineRef.current) {
        timelineRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, start: number) => {
    e.stopPropagation();
    setDraggingId(id);
    setDragStartX(e.clientX);
    setItemStartX(start);
    setSelectedItem(id);
  };

  const handleDelete = () => {
    if (selectedItemId) {
      removeTrackItem(selectedItemId);
    }
  };

  const handleSplit = () => {
    if (selectedItemId) {
      const currentTime = useEditorStore.getState().currentTime;
      splitTrackItem(selectedItemId, currentTime);
    }
  };

  const handleLayerUp = () => {
    if (!selectedItemId) return;
    const item = tracks.find(t => t.id === selectedItemId);
    if (item) {
      updateTrackItem(selectedItemId, { layer: item.layer + 1 });
    }
  };

  const handleLayerDown = () => {
    if (!selectedItemId) return;
    const item = tracks.find(t => t.id === selectedItemId);
    if (item) {
      updateTrackItem(selectedItemId, { layer: Math.max(0, item.layer - 1) });
    }
  };

  const handleTrimMouseDown = (e: React.MouseEvent, id: string, side: 'start' | 'end') => {
    e.stopPropagation();
    const item = tracks.find(t => t.id === id);
    if (!item) return;

    setTrimmingState({
      id,
      side,
      initialStart: item.start,
      initialDuration: item.duration,
      initialOffset: item.offset,
      startX: e.clientX
    });
    setSelectedItem(id);
  };

  const handleFadeMouseDown = (e: React.MouseEvent, id: string, side: 'in' | 'out') => {
    e.stopPropagation();
    const item = tracks.find(t => t.id === id);
    if (!item) return;
    
    setFadingState({
      id,
      side,
      initialFade: side === 'in' ? (item.fadeIn || 0) : (item.fadeOut || 0),
      startX: e.clientX
    });
    setSelectedItem(id);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (fadingState) {
        const deltaX = e.clientX - fadingState.startX;
        const deltaSeconds = deltaX / zoom;
        const item = tracksRef.current.find(t => t.id === fadingState.id);
        if (!item) return;

        if (fadingState.side === 'in') {
          let newFade = fadingState.initialFade + deltaSeconds;
          newFade = Math.max(0, Math.min(newFade, item.duration / 2)); // Max half duration
          updateTrackItem(fadingState.id, { fadeIn: newFade });
        } else {
          // Dragging left increases fade out (delta is negative when moving left)
          let newFade = fadingState.initialFade - deltaSeconds; 
          newFade = Math.max(0, Math.min(newFade, item.duration / 2));
          updateTrackItem(fadingState.id, { fadeOut: newFade });
        }
        return;
      }

      if (trimmingState) {
        const deltaX = e.clientX - trimmingState.startX;
        const deltaTime = deltaX / zoom;
        const item = tracksRef.current.find(t => t.id === trimmingState.id);
        const asset = assetsRef.current.find(a => a.id === item?.assetId);
        
        if (!item) return;

        const snapThreshold = 10 / zoom;
        const snapPoints = [0, useEditorStore.getState().currentTime];
        tracksRef.current.forEach(t => {
          if (t.id !== trimmingState.id) {
            snapPoints.push(t.start);
            snapPoints.push(t.start + t.duration);
          }
        });

        let activeSnapLine: number | null = null;
        let minDiff = snapThreshold;

        const playbackRate = item.playbackRate || 1;

        if (trimmingState.side === 'start') {
          // Trimming start
          let newStart = trimmingState.initialStart + deltaTime;
          
          snapPoints.forEach(point => {
            const diff = Math.abs(newStart - point);
            if (diff < minDiff) {
              minDiff = diff;
              newStart = point;
              activeSnapLine = point;
            }
          });

          let newDuration = trimmingState.initialDuration - (newStart - trimmingState.initialStart);
          let newOffset = trimmingState.initialOffset + (newStart - trimmingState.initialStart) * playbackRate;

          // Constraints
          if (newDuration < 0.1) {
            newDuration = 0.1;
            newStart = trimmingState.initialStart + (trimmingState.initialDuration - 0.1);
            newOffset = trimmingState.initialOffset + (trimmingState.initialDuration - 0.1) * playbackRate;
            activeSnapLine = null;
          }
          
          if (newOffset < 0) {
            newOffset = 0;
            newStart = trimmingState.initialStart - (trimmingState.initialOffset / playbackRate);
            newDuration = trimmingState.initialDuration + (trimmingState.initialOffset / playbackRate);
            activeSnapLine = null;
          }

          setSnapLine(activeSnapLine);
          updateTrackItem(trimmingState.id, {
            start: newStart,
            duration: newDuration,
            offset: newOffset
          });
        } else {
          // Trimming end
          let newEnd = trimmingState.initialStart + trimmingState.initialDuration + deltaTime;

          snapPoints.forEach(point => {
            const diff = Math.abs(newEnd - point);
            if (diff < minDiff) {
              minDiff = diff;
              newEnd = point;
              activeSnapLine = point;
            }
          });

          let newDuration = newEnd - trimmingState.initialStart;

          // Constraints
          if (newDuration < 0.1) {
             newDuration = 0.1;
             activeSnapLine = null;
          }
          
          // Max duration constraint if asset is video/audio
          if (asset && asset.duration) {
            const maxDuration = (asset.duration - item.offset) / playbackRate;
            if (newDuration > maxDuration) {
               newDuration = maxDuration;
               activeSnapLine = null;
            }
          }

          setSnapLine(activeSnapLine);
          updateTrackItem(trimmingState.id, {
            duration: newDuration
          });
        }
        return;
      }

      if (!draggingId) return;
      
      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / zoom;
      let newStart = Math.max(0, itemStartX + deltaTime);
      const item = tracksRef.current.find(t => t.id === draggingId);
      
      if (!item) return;

      const snapThreshold = 10 / zoom;
      const snapPoints = [0, useEditorStore.getState().currentTime];
      tracksRef.current.forEach(t => {
        if (t.id !== draggingId) {
          snapPoints.push(t.start);
          snapPoints.push(t.start + t.duration);
        }
      });

      let activeSnapLine: number | null = null;
      let minDiff = snapThreshold;

      snapPoints.forEach(point => {
        // Check start
        const diffStart = Math.abs(newStart - point);
        if (diffStart < minDiff) {
          minDiff = diffStart;
          newStart = point;
          activeSnapLine = point;
        }
        
        // Check end
        const newEnd = newStart + item.duration;
        const diffEnd = Math.abs(newEnd - point);
        if (diffEnd < minDiff) {
          minDiff = diffEnd;
          newStart = point - item.duration;
          activeSnapLine = point;
        }
      });

      setSnapLine(activeSnapLine);
      updateTrackItem(draggingId, { start: Math.max(0, newStart) });
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setTrimmingState(null);
      setFadingState(null);
      setSnapLine(null);
    };

    if (draggingId || trimmingState || fadingState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, trimmingState, fadingState, dragStartX, itemStartX, zoom, updateTrackItem]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-72 bg-[#1e1e1e] border-t border-white/10 flex flex-col select-none">
      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[#252525]">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 hover:bg-white/10 rounded-full text-white">
            {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
          </button>
          <TimeDisplay />
          
          <div className="h-6 w-px bg-white/10 mx-2" />

          <button 
            onClick={handleSplit}
            disabled={!selectedItemId} 
            className="p-2 hover:bg-white/10 rounded-full text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Split (Cut)"
          >
            <Scissors size={18} />
          </button>
          <button 
            onClick={handleDelete}
            disabled={!selectedItemId} 
            className="p-2 hover:bg-red-500/20 text-red-400 rounded-full disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>

          <div className="h-6 w-px bg-white/10 mx-2" />

          <button 
            onClick={handleLayerUp}
            disabled={!selectedItemId} 
            className="p-2 hover:bg-white/10 rounded-full text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Move Layer Up"
          >
            <ArrowUp size={18} />
          </button>
          <button 
            onClick={handleLayerDown}
            disabled={!selectedItemId} 
            className="p-2 hover:bg-white/10 rounded-full text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Move Layer Down"
          >
            <ArrowDown size={18} />
          </button>

          <div className="h-6 w-px bg-white/10 mx-2" />

          <button 
            onClick={() => {
              if (selectedItemId) {
                updateTrackItem(selectedItemId, { fadeIn: 0.5, fadeOut: 0.5 });
              }
            }}
            disabled={!selectedItemId} 
            className="px-3 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-full text-white disabled:opacity-30 disabled:hover:bg-white/10 transition-colors"
            title="Apply Default Fades (0.5s)"
          >
            Add Fade
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setZoom(Math.max(5, zoom - 5))} 
            className="p-1.5 hover:bg-white/10 rounded text-white/70 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          
          <div className="flex items-center gap-2 group">
            <input
              type="range"
              min="5"
              max="100"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
            />
          </div>

          <button 
            onClick={() => setZoom(Math.min(100, zoom + 5))} 
            className="p-1.5 hover:bg-white/10 rounded text-white/70 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Timeline Area */}
      <div 
        className="flex-1 overflow-auto relative custom-scrollbar" 
        ref={timelineRef}
        onWheel={handleWheel}
      >
        <div 
          className="relative min-w-full" 
          style={{ 
            width: effectiveDuration * zoom + 100,
            height: Math.max(300, 60 + tracks.length * 50) 
          }}
          onClick={handleTimelineClick}
        >
          {/* Ruler */}
          <div className="h-8 border-b border-white/10 flex items-end sticky top-0 bg-[#1e1e1e] z-10 pointer-events-none">
            {(() => {
              // Calculate step to ensure labels don't overlap (min 50px spacing)
              const step = Math.max(1, Math.ceil(50 / zoom));
              const markers = [];
              for (let i = 0; i <= Math.ceil(effectiveDuration); i += step) {
                markers.push(
                  <div 
                    key={i} 
                    className="absolute border-l border-white/20 h-3 text-[10px] text-white/40 pl-1"
                    style={{ left: i * zoom }}
                  >
                    {i}s
                  </div>
                );
              }
              return markers;
            })()}
          </div>

          {/* Playhead */}
          <Playhead zoom={zoom} />

          {/* Snap Line */}
          {snapLine !== null && (
            <div 
              className="absolute top-0 bottom-0 w-px bg-green-500 z-20 pointer-events-none shadow-[0_0_4px_rgba(34,197,94,0.8)]"
              style={{ left: snapLine * zoom }}
            />
          )}

          {/* Tracks */}
          <div className="p-4 space-y-2 pt-10">
            {/* We group tracks visually, but for now just render items in a flat list with offset y */}
            {/* In a real app, we'd group by 'layer' or 'trackId' */}
            {sortedTracks.map((item, index) => (
              <div
                key={item.id}
                className={clsx(
                  "h-12 rounded-md absolute cursor-pointer overflow-hidden border transition-opacity",
                  selectedItemId === item.id ? "border-yellow-400 ring-1 ring-yellow-400 z-10" : "border-transparent opacity-90 hover:opacity-100",
                  item.type === 'video' ? "bg-blue-900/50" : 
                  item.type === 'image' ? "bg-purple-900/50" : "bg-green-900/50"
                )}
                style={{
                  left: item.start * zoom,
                  width: item.duration * zoom,
                  top: 40 + (index * 50) // Simple stacking for now
                }}
                onMouseDown={(e) => handleMouseDown(e, item.id, item.start)}
              >
                {/* Fade Visuals */}
                <div 
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-black/50 to-transparent pointer-events-none z-10"
                    style={{ width: (item.fadeIn || 0) * zoom }}
                />
                <div 
                    className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-black/50 to-transparent pointer-events-none z-10"
                    style={{ width: (item.fadeOut || 0) * zoom }}
                />

                {/* Fade Handles */}
                <div 
                  className="absolute top-0 w-3 h-3 bg-white border border-black rounded-full cursor-ew-resize z-30 hover:scale-125 transition-transform shadow-sm"
                  style={{ left: (item.fadeIn || 0) * zoom, transform: 'translate(-50%, -25%)' }}
                  onMouseDown={(e) => handleFadeMouseDown(e, item.id, 'in')}
                  title="Fade In Duration"
                />
                <div 
                  className="absolute top-0 w-3 h-3 bg-white border border-black rounded-full cursor-ew-resize z-30 hover:scale-125 transition-transform shadow-sm"
                  style={{ right: (item.fadeOut || 0) * zoom, transform: 'translate(50%, -25%)' }}
                  onMouseDown={(e) => handleFadeMouseDown(e, item.id, 'out')}
                  title="Fade Out Duration"
                />

                {/* Drag Handles */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/50 cursor-ew-resize z-20 flex items-center justify-center group/handle"
                  onMouseDown={(e) => handleTrimMouseDown(e, item.id, 'start')}
                >
                  <div className="w-1 h-4 bg-white/50 rounded-full group-hover/handle:bg-white" />
                </div>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/50 cursor-ew-resize z-20 flex items-center justify-center group/handle"
                  onMouseDown={(e) => handleTrimMouseDown(e, item.id, 'end')}
                >
                  <div className="w-1 h-4 bg-white/50 rounded-full group-hover/handle:bg-white" />
                </div>
                
                <div className="px-3 py-2 text-xs text-white truncate font-medium select-none flex items-center gap-2">
                  <span>{item.type.toUpperCase()}</span>
                  {item.type === 'video' && <Volume2 size={12} className="opacity-70" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
