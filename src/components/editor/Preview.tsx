import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Text, Shape } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import { Maximize, Minimize } from 'lucide-react';

const getInterpolatedValue = (item, property, currentTime, defaultValue) => {
  if (!item.keyframes || !item.keyframes[property] || item.keyframes[property].length === 0) {
    return item[property] ?? defaultValue;
  }
  
  const keyframes = [...item.keyframes[property]].sort((a, b) => a.time - b.time);
  const clipTime = currentTime - item.start;
  
  if (clipTime <= keyframes[0].time) return keyframes[0].value;
  if (clipTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;
  
  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];
    if (clipTime >= k1.time && clipTime <= k2.time) {
      const progress = (clipTime - k1.time) / (k2.time - k1.time);
      return k1.value + (k2.value - k1.value) * progress;
    }
  }
  
  return item[property] ?? defaultValue;
};

const PreviewTimeDisplay = () => {
  const currentTime = useEditorStore(state => state.currentTime);
  return (
    <div className="font-mono text-white bg-black/50 px-2 py-1 rounded text-sm">
      {currentTime.toFixed(2)}s
    </div>
  );
};

const MediaComponent = ({ item, isPlaying, onSelect, isSelected, onChange }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  const imageRef = useRef(null);
  const trRef = useRef(null);
  const videoElementRef = useRef(document.createElement('video'));
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imageBitmap, setImageBitmap] = useState(null);
  
  // Get asset source
  const asset = useEditorStore(state => state.assets.find(a => a.id === item.assetId));

  // Handle Video Loading
  useEffect(() => {
    if (!asset || asset.type !== 'video') return;
    const video = videoElementRef.current;
    video.src = asset.src;
    video.crossOrigin = 'anonymous';
    video.playsInline = true; // Important for mobile
    video.muted = false;
    video.volume = 1.0;
    video.preload = 'auto';
    video.load();
    
    const handleLoaded = () => setVideoLoaded(true);
    video.addEventListener('loadeddata', handleLoaded);
    
    return () => {
      video.removeEventListener('loadeddata', handleLoaded);
    };
  }, [asset]);

  // Handle Image Loading
  useEffect(() => {
    if (!asset || asset.type !== 'image') return;
    const img = new Image();
    img.src = asset.src;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageBitmap(img);
    };
  }, [asset]);

  // Sync video time with global time
  useEffect(() => {
    if (!asset || asset.type !== 'video') return;
    const video = videoElementRef.current;
    if (!videoLoaded) return;

    const playbackRate = item.playbackRate || 1;
    video.playbackRate = playbackRate;

    // Calculate local time in source media
    const timelineDelta = currentTime - item.start;
    const localTime = (timelineDelta * playbackRate) + item.offset;
    
    const isVisible = currentTime >= item.start && currentTime <= item.start + item.duration;

    // Calculate volume based on fade in/out
    let volume = 1;
    const clipTime = currentTime - item.start;
    const fadeIn = item.fadeIn || 0;
    const fadeOut = item.fadeOut || 0;

    if (fadeIn > 0 && clipTime < fadeIn) {
      volume = clipTime / fadeIn;
    } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
      volume = (item.duration - clipTime) / fadeOut;
    }
    volume = Math.max(0, Math.min(1, volume));
    if (Math.abs(video.volume - volume) > 0.01) {
      video.volume = volume;
    }

    if (isPlaying) {
      if (isVisible) {
        if (video.paused) {
          video.currentTime = localTime;
          video.play().catch(() => {});
        }
        // Increase threshold to prevent frequent seeking which causes stuttering
        if (Math.abs(video.currentTime - localTime) > 1.0 * playbackRate) {
          video.currentTime = localTime;
        }
      } else {
        if (!video.paused) video.pause();
      }
    } else {
      if (!video.paused) video.pause();
      if (isVisible && Math.abs(video.currentTime - localTime) > 0.05) {
        video.currentTime = localTime;
      }
    }
  }, [currentTime, isPlaying, item.start, item.offset, item.duration, videoLoaded, asset, item.fadeIn, item.fadeOut, item.playbackRate]);

  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  // Force update Konva layer when video updates
  useEffect(() => {
    if (!asset || asset.type !== 'video') return;
    let animFrame;
    
    const update = () => {
      if (imageRef.current) {
        imageRef.current.getLayer().batchDraw();
      }
      if (isPlaying) {
        animFrame = requestAnimationFrame(update);
      }
    };
    
    if (isPlaying) {
       update();
    }

    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, asset]);

  // Calculate opacity based on fade in/out
  let opacity = 1;
  const clipTime = currentTime - item.start;
  const fadeIn = item.fadeIn || 0;
  const fadeOut = item.fadeOut || 0;

  if (fadeIn > 0 && clipTime < fadeIn) {
    opacity = clipTime / fadeIn;
  } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
    opacity = (item.duration - clipTime) / fadeOut;
  }
  opacity = Math.max(0, Math.min(1, opacity));

  if (!asset || currentTime < item.start || currentTime > item.start + item.duration) {
    return null;
  }

  const currentX = getInterpolatedValue(item, 'x', currentTime, item.x || 0);
  const currentY = getInterpolatedValue(item, 'y', currentTime, item.y || 0);
  const currentRotation = getInterpolatedValue(item, 'rotation', currentTime, item.rotation || 0);
  const currentWidth = getInterpolatedValue(item, 'width', currentTime, item.width || 300);
  const currentHeight = getInterpolatedValue(item, 'height', currentTime, item.height || (asset.type === 'video' ? 500 : 300));

  const handleTransformChange = (newAttrs) => {
    const clipTime = currentTime - item.start;
    const canKeyframe = clipTime >= 0 && clipTime <= item.duration;
    
    let updatedKeyframes = { ...(item.keyframes || {}) };
    let hasKeyframeUpdates = false;

    // Check if we need to update existing keyframes instead of base values
    if (canKeyframe) {
      Object.keys(newAttrs).forEach(key => {
        const currentKeyframes = updatedKeyframes[key] || [];
        const existingIndex = currentKeyframes.findIndex(k => Math.abs(k.time - clipTime) < 0.05);
        if (existingIndex >= 0) {
          updatedKeyframes[key] = [...currentKeyframes];
          updatedKeyframes[key][existingIndex] = { time: clipTime, value: newAttrs[key] };
          hasKeyframeUpdates = true;
          delete newAttrs[key]; // Remove from base attrs so we don't overwrite the base value
        }
      });
    }

    if (hasKeyframeUpdates) {
      onChange({ ...newAttrs, keyframes: updatedKeyframes });
    } else {
      onChange(newAttrs);
    }
  };

  return (
    <>
      <Shape
        ref={imageRef}
        x={currentX}
        y={currentY}
        rotation={currentRotation}
        width={currentWidth}
        height={currentHeight}
        opacity={opacity}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          handleTransformChange({
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = imageRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          node.scaleX(1);
          node.scaleY(1);
          
          handleTransformChange({
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
        sceneFunc={(ctx, shape) => {
          const img = asset.type === 'video' ? videoElementRef.current : imageBitmap;
          if (img) {
            ctx.save();
            const b = item.brightness ?? 100;
            const c = item.contrast ?? 100;
            const s = item.saturation ?? 100;
            const hasFilter = b !== 100 || c !== 100 || s !== 100;
            
            if (ctx._context && hasFilter) {
              ctx._context.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
            }
            ctx.drawImage(img, 0, 0, shape.width(), shape.height());
            if (ctx._context && hasFilter) {
              ctx._context.filter = 'none';
            }
            ctx.restore();
          }
          ctx.fillStrokeShape(shape);
        }}
        hitFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.rect(0, 0, shape.width(), shape.height());
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

const TextComponent = ({ item, onSelect, isSelected, onChange }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  const shapeRef = useRef(null);
  const trRef = useRef(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  // Calculate opacity based on fade in/out
  let opacity = 1;
  const clipTime = currentTime - item.start;
  const fadeIn = item.fadeIn || 0;
  const fadeOut = item.fadeOut || 0;

  if (fadeIn > 0 && clipTime < fadeIn) {
    opacity = clipTime / fadeIn;
  } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
    opacity = (item.duration - clipTime) / fadeOut;
  }
  opacity = Math.max(0, Math.min(1, opacity));

  if (currentTime < item.start || currentTime > item.start + item.duration) {
    return null;
  }

  const currentX = getInterpolatedValue(item, 'x', currentTime, item.x || 100);
  const currentY = getInterpolatedValue(item, 'y', currentTime, item.y || 100);
  const currentRotation = getInterpolatedValue(item, 'rotation', currentTime, item.rotation || 0);

  const handleTransformChange = (newAttrs) => {
    const clipTime = currentTime - item.start;
    const canKeyframe = clipTime >= 0 && clipTime <= item.duration;
    
    let updatedKeyframes = { ...(item.keyframes || {}) };
    let hasKeyframeUpdates = false;

    if (canKeyframe) {
      Object.keys(newAttrs).forEach(key => {
        const currentKeyframes = updatedKeyframes[key] || [];
        const existingIndex = currentKeyframes.findIndex(k => Math.abs(k.time - clipTime) < 0.05);
        if (existingIndex >= 0) {
          updatedKeyframes[key] = [...currentKeyframes];
          updatedKeyframes[key][existingIndex] = { time: clipTime, value: newAttrs[key] };
          hasKeyframeUpdates = true;
          delete newAttrs[key];
        }
      });
    }

    if (hasKeyframeUpdates) {
      onChange({ ...newAttrs, keyframes: updatedKeyframes });
    } else {
      onChange(newAttrs);
    }
  };

  return (
    <>
      <Text
        ref={shapeRef}
        text={item.text || 'Double Click to Edit'}
        fontSize={item.fontSize || 24}
        fill={item.fontFill || 'white'}
        x={currentX}
        y={currentY}
        rotation={currentRotation}
        opacity={opacity}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          handleTransformChange({
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          
          node.scaleX(1);
          node.scaleY(1);
          
          handleTransformChange({
            x: node.x(),
            y: node.y(),
            fontSize: (item.fontSize || 24) * scaleX,
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

const AudioComponent = ({ item, isPlaying }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  const audioRef = useRef(document.createElement('audio'));
  const [loaded, setLoaded] = useState(false);
  const asset = useEditorStore(state => state.assets.find(a => a.id === item.assetId));

  useEffect(() => {
    if (!asset || asset.type !== 'audio') return;
    const audio = audioRef.current;
    audio.src = asset.src;
    audio.crossOrigin = 'anonymous';
    audio.load();
    
    const handleLoaded = () => setLoaded(true);
    audio.addEventListener('loadeddata', handleLoaded);
    return () => audio.removeEventListener('loadeddata', handleLoaded);
  }, [asset]);

  useEffect(() => {
    if (!asset || !loaded) return;
    const audio = audioRef.current;
    
    const playbackRate = item.playbackRate || 1;
    audio.playbackRate = playbackRate;

    const timelineDelta = currentTime - item.start;
    const localTime = (timelineDelta * playbackRate) + item.offset;
    
    const isVisible = currentTime >= item.start && currentTime <= item.start + item.duration;

    // Calculate volume based on fade in/out
    let volume = 1;
    const clipTime = currentTime - item.start;
    const fadeIn = item.fadeIn || 0;
    const fadeOut = item.fadeOut || 0;

    if (fadeIn > 0 && clipTime < fadeIn) {
      volume = clipTime / fadeIn;
    } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
      volume = (item.duration - clipTime) / fadeOut;
    }
    volume = Math.max(0, Math.min(1, volume));
    if (Math.abs(audio.volume - volume) > 0.01) {
      audio.volume = volume;
    }

    if (isPlaying) {
      if (isVisible) {
        if (audio.paused) {
          audio.currentTime = localTime;
          audio.play().catch(() => {});
        }
        if (Math.abs(audio.currentTime - localTime) > 1.0 * playbackRate) {
          audio.currentTime = localTime;
        }
      } else {
        if (!audio.paused) audio.pause();
      }
    } else {
      if (!audio.paused) audio.pause();
      if (isVisible && Math.abs(audio.currentTime - localTime) > 0.05) {
        audio.currentTime = localTime;
      }
    }
  }, [currentTime, isPlaying, item.start, item.offset, item.duration, loaded, asset, item.fadeIn, item.fadeOut, item.playbackRate]);

  return null;
};

export default function Preview() {
  const { 
    tracks, 
    isPlaying, 
    selectedItemId, 
    setSelectedItem, 
    updateTrackItem,
    canvasSize 
  } = useEditorStore();

  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<'fit' | number>('fit');

  const toggleFullScreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  // Calculate scale based on zoom mode
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      
      if (previewZoom === 'fit') {
        const { offsetWidth, offsetHeight } = containerRef.current;
        const scaleW = offsetWidth / canvasSize.width;
        const scaleH = offsetHeight / canvasSize.height;
        const newScale = Math.min(scaleW, scaleH) * 0.9; // 90% fit
        setScale(newScale);
      } else {
        setScale(previewZoom);
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasSize, isFullScreen, previewZoom]);

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedItem(null);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 bg-black flex items-center justify-center overflow-auto relative custom-scrollbar"
    >
      {/* Audio Tracks (Invisible) */}
      {tracks.filter(t => t.type === 'audio').map(item => (
        <AudioComponent 
          key={item.id} 
          item={item} 
          isPlaying={isPlaying} 
        />
      ))}

      <div style={{
        width: canvasSize.width * scale,
        height: canvasSize.height * scale,
      }}>
        <Stage
          width={canvasSize.width * scale}
          height={canvasSize.height * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={handleStageClick}
          onTouchStart={handleStageClick}
          className="bg-gray-900 shadow-2xl"
        >
          <Layer>
            {/* Render items sorted by layer/z-index */}
            {tracks
              .sort((a, b) => a.layer - b.layer)
              .map((item) => {
                if (item.type === 'video' || item.type === 'image') {
                  return (
                    <MediaComponent
                      key={item.id}
                      item={item}
                      isPlaying={isPlaying}
                      isSelected={selectedItemId === item.id}
                      onSelect={() => setSelectedItem(item.id)}
                      onChange={(newAttrs) => updateTrackItem(item.id, newAttrs)}
                    />
                  );
                }
                if (item.type === 'text') {
                  return (
                    <TextComponent
                      key={item.id}
                      item={item}
                      isSelected={selectedItemId === item.id}
                      onSelect={() => setSelectedItem(item.id)}
                      onChange={(newAttrs) => updateTrackItem(item.id, newAttrs)}
                    />
                  );
                }
                return null;
              })}
          </Layer>
        </Stage>
      </div>
      
      {/* Time Display Overlay & Full Screen Toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <PreviewTimeDisplay />
        
        <select 
          value={previewZoom}
          onChange={(e) => setPreviewZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
          className="bg-black/50 text-white text-xs px-2 py-1 rounded border border-white/10 outline-none focus:border-cyan-500"
        >
          <option value="fit">Fit</option>
          <option value={0.25}>25%</option>
          <option value={0.5}>50%</option>
          <option value={0.75}>75%</option>
          <option value={1}>100%</option>
          <option value={1.5}>150%</option>
          <option value={2}>200%</option>
        </select>

        <button 
          onClick={toggleFullScreen}
          className="p-1.5 bg-black/50 rounded text-white hover:bg-white/20 transition-colors"
          title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
        >
          {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>
    </div>
  );
}
