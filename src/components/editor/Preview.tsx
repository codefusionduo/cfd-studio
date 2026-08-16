import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Text, Shape, Rect, Group } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import { Maximize, Minimize, Play, Pause, Repeat, SkipBack, SkipForward, ChevronLeft, ChevronRight, Volume2, VolumeX, RotateCcw } from 'lucide-react';

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

const MediaComponent = ({ item, isPlaying, onSelect, isSelected, onChange, audioContext, audioDestination, analyser, volume = 100, muted = false }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  const tracks = useEditorStore(state => state.tracks);
  const canvasSize = useEditorStore(state => state.canvasSize);
  const globalPlayRate = useEditorStore(state => state.playbackRateMultiplier || 1.0);
  const imageRef = useRef(null);
  const trRef = useRef(null);
  const videoElementRef = useRef(document.createElement('video'));
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imageBitmap, setImageBitmap] = useState(null);
  const sourceNodeRef = useRef<any>(null);
  
  // Get asset source
  const asset = useEditorStore(state => state.assets.find(a => a.id === item.assetId));

  // Handle Audio Context Connection
  useEffect(() => {
    if (!asset || asset.type !== 'video' || !audioContext || !audioDestination) return;
    const video = videoElementRef.current;
    
    if (!sourceNodeRef.current) {
      try {
        sourceNodeRef.current = audioContext.createMediaElementSource(video);
        sourceNodeRef.current.connect(audioDestination);
        sourceNodeRef.current.connect(audioContext.destination);
        if (analyser) {
          sourceNodeRef.current.connect(analyser);
        }
      } catch (e) {
        console.warn('Failed to connect video to audio context', e);
      }
    }

    return () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch (e) {}
      }
    };
  }, [asset, audioContext, audioDestination]);

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
    
    const handleLoaded = () => {
      setVideoLoaded(true);
      if (imageRef.current) {
        const layer = imageRef.current.getLayer();
        if (layer) layer.batchDraw();
      }
    };
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
      if (imageRef.current) {
        const layer = imageRef.current.getLayer();
        if (layer) layer.batchDraw();
      }
    };
  }, [asset]);

  // Sync video time with global time
  useEffect(() => {
    if (!asset || asset.type !== 'video') return;
    const video = videoElementRef.current;
    if (!videoLoaded) return;

    const playbackRate = (item.playbackRate || 1) * globalPlayRate;
    if (video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate;
    }

    // Calculate local time in source media
    const timelineDelta = currentTime - item.start;
    const localTime = (timelineDelta * (item.playbackRate || 1)) + item.offset;
    
    const isVisible = currentTime >= item.start && currentTime <= item.start + item.duration;

    // Calculate volume based on fade in/out
    let volumeMultiplier = 1;
    const clipTime = currentTime - item.start;
    const fadeIn = item.fadeIn || 0;
    const fadeOut = item.fadeOut || 0;

    if (fadeIn > 0 && clipTime < fadeIn) {
      volumeMultiplier = clipTime / fadeIn;
    } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
      volumeMultiplier = (item.duration - clipTime) / fadeOut;
    }
    
    let targetVolume = ((item.volume ?? 100) / 100) * volumeMultiplier * (muted ? 0 : volume / 100);
    
    // Auto-duck logic (videos can theoretically duck too)
    if (item.autoDuck) {
      const isPlayingPrimary = tracks.some(t => {
        if (t.id === item.id) return false;
        const active = currentTime >= t.start && currentTime <= t.start + t.duration;
        if (!active) return false;
        const isVideoWithAudio = t.type === 'video' && (t.volume ?? 100) > 0;
        const isPrimaryAudio = t.type === 'audio' && !t.autoDuck && (t.volume ?? 100) > 0;
        return isVideoWithAudio || isPrimaryAudio;
      });
      if (isPlayingPrimary) {
        targetVolume *= 0.15; // Duck to 15%
      }
    }

    targetVolume = Math.max(0, Math.min(1, targetVolume));
    if (Math.abs(video.volume - targetVolume) > 0.01) {
      video.volume = targetVolume;
    }

    if (isPlaying) {
      if (isVisible) {
        if (video.paused) {
          // Only seek if we are far off, to avoid seeking right before play
          if (Math.abs(video.currentTime - localTime) > 0.5) {
            video.currentTime = localTime;
          }
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Autoplay prevented, we can't do much here without user interaction
            });
          }
        } else {
          // Increase threshold to prevent frequent seeking which causes stuttering
          if (Math.abs(video.currentTime - localTime) > 1.0 * (item.playbackRate || 1)) {
            video.currentTime = localTime;
          }
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
  }, [currentTime, isPlaying, item.start, item.offset, item.duration, videoLoaded, asset, item.fadeIn, item.fadeOut, item.playbackRate, globalPlayRate]);

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
        const layer = imageRef.current.getLayer();
        if (layer) layer.batchDraw();
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

  // Redraw when currentTime changes while paused
  useEffect(() => {
    if (!isPlaying && asset?.type === 'video' && imageRef.current) {
      const layer = imageRef.current.getLayer();
      if (layer) layer.batchDraw();
    }
  }, [currentTime, isPlaying, asset]);

  // Redraw when video seeked
  useEffect(() => {
    if (!asset || asset.type !== 'video') return;
    const video = videoElementRef.current;
    const handleSeeked = () => {
      if (imageRef.current) {
        const layer = imageRef.current.getLayer();
        if (layer) layer.batchDraw();
      }
    };
    video.addEventListener('seeked', handleSeeked);
    return () => video.removeEventListener('seeked', handleSeeked);
  }, [asset]);

  const isVisible = currentTime >= item.start && currentTime <= item.start + item.duration;
  const clipTime = currentTime - item.start;
  const fadeIn = item.fadeIn || 0;
  const fadeOut = item.fadeOut || 0;
  let opacity = 1;

  const currentX = getInterpolatedValue(item, 'x', currentTime, item.x || 0);
  const currentY = getInterpolatedValue(item, 'y', currentTime, item.y || 0);
  const currentRotation = getInterpolatedValue(item, 'rotation', currentTime, item.rotation || 0);
  const currentWidth = getInterpolatedValue(item, 'width', currentTime, item.width || 300);
  const currentHeight = getInterpolatedValue(item, 'height', currentTime, item.height || (asset?.type === 'video' ? 500 : 300));

  let displayX = currentX;
  let displayY = currentY;
  let displayScaleX = 1;
  let displayScaleY = 1;
  let displayRotation = currentRotation;

  if (fadeIn > 0 && clipTime < fadeIn) {
    const progress = clipTime / fadeIn;
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    if (item.transitionInType === 'fade' || !item.transitionInType) {
      opacity = progress;
    } else if (item.transitionInType === 'slide-left') {
      displayX = currentX + canvasSize.width * (1 - easeOut);
    } else if (item.transitionInType === 'slide-right') {
      displayX = currentX - canvasSize.width * (1 - easeOut);
    } else if (item.transitionInType === 'slide-up') {
      displayY = currentY + canvasSize.height * (1 - easeOut);
    } else if (item.transitionInType === 'slide-down') {
      displayY = currentY - canvasSize.height * (1 - easeOut);
    } else if (item.transitionInType === 'zoom-in') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'zoom-out') {
      displayScaleX = 2 - easeOut;
      displayScaleY = 2 - easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'spin-in' || item.transitionInType === 'spin') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      displayRotation = currentRotation - 180 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'drop') {
      displayY = currentY - canvasSize.height * (1 - Math.pow(easeOut, 2));
      displayScaleX = 0.5 + 0.5 * easeOut;
      displayScaleY = 0.5 + 0.5 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'elastic') {
      const elasticEaseOut = progress === 0 ? 0 : progress === 1 ? 1 : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
      displayScaleX = elasticEaseOut;
      displayScaleY = elasticEaseOut;
      opacity = progress < 0.2 ? progress / 0.2 : 1;
    } else if (item.transitionInType === 'rotate') {
      displayRotation = currentRotation - 90 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'flip-x') {
      displayScaleX = -1 + 2 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'flip-y') {
      displayScaleY = -1 + 2 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'slide-rotate') {
      displayX = currentX - canvasSize.width * (1 - easeOut);
      displayRotation = currentRotation - 360 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'zoom-spin') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      displayRotation = currentRotation - 720 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'glitch') {
      const jitterX = (Math.sin(progress * 50) * 15) * (1 - progress);
      const jitterY = (Math.cos(progress * 55) * 15) * (1 - progress);
      displayX = currentX + jitterX;
      displayY = currentY + jitterY;
      opacity = progress > 0.1 && Math.random() > 0.2 ? progress : 0;
    } else if (item.transitionInType === 'bounce') {
      let bProgress = progress;
      let bounceVal = 0;
      if (bProgress < 1 / 2.75) {
        bounceVal = 7.5625 * bProgress * bProgress;
      } else if (bProgress < 2 / 2.75) {
        bProgress -= 1.5 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.75;
      } else if (bProgress < 2.5 / 2.75) {
        bProgress -= 2.25 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.9375;
      } else {
        bProgress -= 2.625 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.984375;
      }
      displayY = currentY - canvasSize.height * (1 - bounceVal);
      opacity = progress;
    } else if (item.transitionInType === 'swing') {
      displayRotation = currentRotation + Math.sin(progress * Math.PI * 3.5) * 30 * (1 - progress);
      opacity = progress;
    } else if (item.transitionInType === 'heartbeat') {
      const pulse = 1 + Math.sin(progress * Math.PI * 2.5) * 0.15 * (1 - progress);
      displayScaleX = pulse;
      displayScaleY = pulse;
      opacity = progress;
    } else if (item.transitionInType === 'shutter') {
      const factor = Math.abs(Math.sin(progress * Math.PI * 4));
      opacity = progress * factor;
    } else if (item.transitionInType === 'diagonal-slide') {
      displayX = currentX - canvasSize.width * (1 - easeOut);
      displayY = currentY - canvasSize.height * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'wave-warp') {
      displayX = currentX + canvasSize.width * (1 - easeOut);
      displayY = currentY + Math.sin(progress * Math.PI * 4) * 35 * (1 - progress);
      opacity = progress;
    } else if (item.transitionInType === 'kaleidoscope') {
      displayScaleX = easeOut * (Math.sin(progress * Math.PI * 2) > 0 ? 1 : -1);
      displayScaleY = easeOut;
      displayRotation = currentRotation + 180 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'pixel-dissolve') {
      const stepProg = Math.floor(progress * 8) / 8;
      displayScaleX = 0.8 + 0.2 * stepProg;
      displayScaleY = 0.8 + 0.2 * stepProg;
      opacity = stepProg;
    } else if (item.transitionInType === 'blur-fade') {
      displayScaleX = 0.7 + 0.3 * easeOut;
      displayScaleY = 0.7 + 0.3 * easeOut;
      opacity = progress;
    }
  } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
    const progress = (clipTime - (item.duration - fadeOut)) / fadeOut;
    const easeIn = Math.pow(progress, 3);
    
    if (item.transitionOutType === 'fade' || !item.transitionOutType) {
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'slide-left') {
      displayX = currentX - canvasSize.width * easeIn;
    } else if (item.transitionOutType === 'slide-right') {
      displayX = currentX + canvasSize.width * easeIn;
    } else if (item.transitionOutType === 'slide-up') {
      displayY = currentY - canvasSize.height * easeIn;
    } else if (item.transitionOutType === 'slide-down') {
      displayY = currentY + canvasSize.height * easeIn;
    } else if (item.transitionOutType === 'zoom-in') {
      displayScaleX = 1 + easeIn;
      displayScaleY = 1 + easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'zoom-out') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'spin-out' || item.transitionOutType === 'spin') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 180 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'drop') {
      displayY = currentY + canvasSize.height * easeIn;
      displayScaleX = 1 - 0.5 * Math.pow(easeIn, 2);
      displayScaleY = 1 - 0.5 * Math.pow(easeIn, 2);
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'elastic') {
      const pt = 1 - progress;
      const elasticEaseIn = pt === 0 ? 0 : pt === 1 ? 1 : -(Math.pow(2, 10 * (pt - 1)) * Math.sin(((pt - 1) - 0.075) * ((2 * Math.PI) / 0.3)));
      displayScaleX = 1 - elasticEaseIn;
      displayScaleY = 1 - elasticEaseIn;
      opacity = progress > 0.8 ? (1 - progress) / 0.2 : 1;
    } else if (item.transitionOutType === 'rotate') {
      displayRotation = currentRotation + 90 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-x') {
      displayScaleX = 1 - 2 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-y') {
      displayScaleY = 1 - 2 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'slide-rotate') {
      displayX = currentX + canvasSize.width * easeIn;
      displayRotation = currentRotation + 360 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'zoom-spin') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 720 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'glitch') {
      const jitterX = (Math.sin(progress * 50) * 15) * progress;
      const jitterY = (Math.cos(progress * 55) * 15) * progress;
      displayX = currentX + jitterX;
      displayY = currentY + jitterY;
      opacity = progress < 0.9 && Math.random() > 0.2 ? 1 - progress : 0;
    } else if (item.transitionOutType === 'bounce') {
      const pt = 1 - progress;
      let bProgress = pt;
      let bounceVal = 0;
      if (bProgress < 1 / 2.75) {
        bounceVal = 7.5625 * bProgress * bProgress;
      } else if (bProgress < 2 / 2.75) {
        bProgress -= 1.5 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.75;
      } else if (bProgress < 2.5 / 2.75) {
        bProgress -= 2.25 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.9375;
      } else {
        bProgress -= 2.625 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.984375;
      }
      displayY = currentY + canvasSize.height * (1 - bounceVal);
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'swing') {
      displayRotation = currentRotation + Math.sin(progress * Math.PI * 3.5) * 30 * progress;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'heartbeat') {
      const pulse = 1 - Math.sin(progress * Math.PI * 2.5) * 0.15 * progress;
      displayScaleX = Math.max(0, pulse * (1 - progress));
      displayScaleY = Math.max(0, pulse * (1 - progress));
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'shutter') {
      const factor = Math.abs(Math.sin(progress * Math.PI * 4));
      opacity = (1 - progress) * factor;
    } else if (item.transitionOutType === 'diagonal-slide') {
      displayX = currentX + canvasSize.width * easeIn;
      displayY = currentY + canvasSize.height * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'wave-warp') {
      displayX = currentX - canvasSize.width * easeIn;
      displayY = currentY + Math.sin(progress * Math.PI * 4) * 35 * progress;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'kaleidoscope') {
      displayScaleX = (1 - easeIn) * (Math.sin(progress * Math.PI * 2) > 0 ? 1 : -1);
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 180 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'pixel-dissolve') {
      const stepProg = Math.floor((1 - progress) * 8) / 8;
      displayScaleX = 0.8 + 0.2 * stepProg;
      displayScaleY = 0.8 + 0.2 * stepProg;
      opacity = stepProg;
    } else if (item.transitionOutType === 'blur-fade') {
      displayScaleX = 1 + 0.5 * easeIn;
      displayScaleY = 1 + 0.5 * easeIn;
      opacity = 1 - progress;
    }
  }

  if (!asset) return null;

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
        x={displayX}
        y={displayY}
        scaleX={displayScaleX}
        scaleY={displayScaleY}
        rotation={displayRotation}
        width={currentWidth}
        height={currentHeight}
        opacity={opacity}
        visible={isVisible}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          const xOffset = displayX - currentX;
          const yOffset = displayY - currentY;
          handleTransformChange({
            x: e.target.x() - xOffset,
            y: e.target.y() - yOffset,
          });
        }}
        onTransformEnd={(e) => {
          const node = imageRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          node.scaleX(1);
          node.scaleY(1);
          
          const xOffset = displayX - currentX;
          const yOffset = displayY - currentY;
          handleTransformChange({
            x: node.x() - xOffset,
            y: node.y() - yOffset,
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
        sceneFunc={(ctx, shape) => {
          const img = asset.type === 'video' ? videoElementRef.current : imageBitmap;
          const isVideoReady = asset.type !== 'video' || (img && (img as HTMLVideoElement).readyState >= 2);
          if (img && isVideoReady) {
            ctx.save();
            const b = item.brightness ?? 100;
            const c = item.contrast ?? 100;
            const s = item.saturation ?? 100;
            const effect = item.effect || 'none';
            const hasFilter = b !== 100 || c !== 100 || s !== 100 || (effect !== 'none' && effect !== 'chroma-key' && effect !== 'pixelate' && effect !== 'noise' && effect !== 'vignette' && effect !== 'edge-detection' && effect !== 'emboss' && effect !== 'sharpen' && effect !== 'posterize' && effect !== 'solarize' && effect !== 'scanlines' && effect !== 'duotone' && effect !== 'dreamy' && effect !== 'halftone' && effect !== 'rgb-split' && effect !== 'night-vision' && effect !== 'thermal' && effect !== 'old-movie' && effect !== 'ascii' && effect !== 'glitch-static' && effect !== 'oil-paint' && effect !== 'vaporwave' && effect !== 'mirror-horizontal' && effect !== 'edge-glow');
            
            if (ctx._context && hasFilter) {
              let filterStr = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
              if (effect === 'grayscale') filterStr += ' grayscale(100%)';
              if (effect === 'sepia') filterStr += ' sepia(100%)';
              if (effect === 'blur') filterStr += ' blur(10px)';
              if (effect === 'invert') filterStr += ' invert(100%)';
              if (effect === 'hue-rotate') filterStr += ' hue-rotate(90deg)';
              ctx._context.filter = filterStr;
            }

            if (effect === 'chroma-key' || effect === 'pixelate' || effect === 'noise' || effect === 'vignette' || effect === 'edge-detection' || effect === 'emboss' || effect === 'sharpen' || effect === 'posterize' || effect === 'solarize' || effect === 'scanlines' || effect === 'duotone' || effect === 'dreamy' || effect === 'halftone' || effect === 'rgb-split' || effect === 'night-vision' || effect === 'thermal' || effect === 'old-movie' || effect === 'ascii' || effect === 'glitch-static' || effect === 'oil-paint' || effect === 'vaporwave' || effect === 'mirror-horizontal' || effect === 'edge-glow') {
              // Advanced effects that require pixel manipulation or multiple draws
              const width = shape.width();
              const height = shape.height();
              
              // Create a temporary canvas for pixel manipulation if needed
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = width;
              tempCanvas.height = height;
              const tempCtx = tempCanvas.getContext('2d');
              
              if (tempCtx) {
                tempCtx.drawImage(img, 0, 0, width, height);
                
                if (effect === 'chroma-key') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  const targetColor = item.chromaKeyColor || '#00ff00';
                  const r_target = parseInt(targetColor.slice(1, 3), 16);
                  const g_target = parseInt(targetColor.slice(3, 5), 16);
                  const b_target = parseInt(targetColor.slice(5, 7), 16);
                  const similarity = (item.chromaKeySimilarity ?? 0.1) * 255;
                  const smoothness = (item.chromaKeySmoothness ?? 0.1) * 255;

                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    const distance = Math.sqrt(
                      Math.pow(r - r_target, 2) + 
                      Math.pow(g - g_target, 2) + 
                      Math.pow(b - b_target, 2)
                    );

                    if (distance < similarity) {
                      data[i + 3] = 0;
                    } else if (distance < similarity + smoothness) {
                      data[i + 3] = ((distance - similarity) / smoothness) * 255;
                    }
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                } else if (effect === 'pixelate') {
                  const size = 10;
                  tempCtx.imageSmoothingEnabled = false;
                  tempCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width / size, height / size);
                  tempCtx.drawImage(tempCanvas, 0, 0, width / size, height / size, 0, 0, width, height);
                } else if (effect === 'noise') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 50;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                } else if (effect === 'vignette') {
                  const gradient = tempCtx.createRadialGradient(
                    width / 2, height / 2, 0,
                    width / 2, height / 2, Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2))
                  );
                  gradient.addColorStop(0, 'rgba(0,0,0,0)');
                  gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
                  tempCtx.fillStyle = gradient;
                  tempCtx.fillRect(0, 0, width, height);
                } else if (effect === 'edge-detection' || effect === 'emboss' || effect === 'sharpen') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  const output = tempCtx.createImageData(width, height);
                  const outData = output.data;
                  
                  const kernel = effect === 'edge-detection' ? 
                    [-1, -1, -1, -1, 8, -1, -1, -1, -1] : 
                    effect === 'sharpen' ?
                    [0, -1, 0, -1, 5, -1, 0, -1, 0] :
                    [-2, -1, 0, -1, 1, 1, 0, 1, 2];

                  for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                      for (let c = 0; c < 3; c++) {
                        let val = 0;
                        for (let ky = -1; ky <= 1; ky++) {
                          for (let kx = -1; kx <= 1; kx++) {
                            val += data[((y + ky) * width + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
                          }
                        }
                        outData[(y * width + x) * 4 + c] = effect === 'emboss' ? val + 128 : val;
                      }
                      outData[(y * width + x) * 4 + 3] = 255;
                    }
                  }
                  tempCtx.putImageData(output, 0, 0);
                } else if (effect === 'posterize' || effect === 'solarize') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    if (effect === 'posterize') {
                      data[i] = data[i] & 0xE0;
                      data[i + 1] = data[i + 1] & 0xE0;
                      data[i + 2] = data[i + 2] & 0xE0;
                    } else if (effect === 'solarize') {
                      data[i] = data[i] > 127 ? 255 - data[i] : data[i];
                      data[i + 1] = data[i + 1] > 127 ? 255 - data[i + 1] : data[i + 1];
                      data[i + 2] = data[i + 2] > 127 ? 255 - data[i + 2] : data[i + 2];
                    }
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                } else if (effect === 'scanlines') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] * 1.1);
                    data[i + 2] = Math.min(255, data[i + 2] * 0.9);
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                  
                  tempCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                  for (let y = 0; y < height; y += 4) {
                    tempCtx.fillRect(0, y, width, 2);
                  }
                  const grad = tempCtx.createRadialGradient(width/2, height/2, width/4, width/2, height/2, width/2);
                  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
                  grad.addColorStop(1, 'rgba(0,0,0,0.4)');
                  tempCtx.fillStyle = grad;
                  tempCtx.fillRect(0, 0, width, height);
                } else if (effect === 'duotone') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const avg = 0.299 * r + 0.587 * g + 0.114 * b;
                    const ratio = avg / 255;
                    data[i] = 26 + (255 - 26) * ratio;
                    data[i+1] = 5 + (51 - 5) * ratio;
                    data[i+2] = 46 + (161 - 46) * ratio;
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                } else if (effect === 'dreamy') {
                  const blurCanvas = document.createElement('canvas');
                  blurCanvas.width = width;
                  blurCanvas.height = height;
                  const blurCtx = blurCanvas.getContext('2d');
                  if (blurCtx) {
                    blurCtx.filter = 'blur(6px) saturate(150%) brightness(120%)';
                    blurCtx.drawImage(tempCanvas, 0, 0, width, height);
                    tempCtx.save();
                    tempCtx.globalAlpha = 0.5;
                    tempCtx.globalCompositeOperation = 'screen';
                    tempCtx.drawImage(blurCanvas, 0, 0, width, height);
                    tempCtx.restore();
                  }
                } else if (effect === 'halftone') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  tempCtx.fillStyle = '#ffffff';
                  tempCtx.fillRect(0, 0, width, height);
                  tempCtx.fillStyle = '#000000';
                  
                  const dotSize = 8;
                  for (let y = 0; y < height; y += dotSize) {
                    for (let x = 0; x < width; x += dotSize) {
                      const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
                      if (idx < data.length) {
                        const r = data[idx];
                        const g = data[idx+1];
                        const b = data[idx+2];
                        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        const radius = (dotSize / 2) * (1 - luma / 255);
                        if (radius > 0.5) {
                          tempCtx.beginPath();
                          tempCtx.arc(x + dotSize/2, y + dotSize/2, radius, 0, Math.PI * 2);
                          tempCtx.fill();
                        }
                      }
                    }
                  }
                } else if (effect === 'rgb-split') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  const output = tempCtx.createImageData(width, height);
                  const outData = output.data;
                  const offset = 6;
                  
                  for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                      const idx = (y * width + x) * 4;
                      const rx = Math.max(0, x - offset);
                      const ridx = (y * width + rx) * 4;
                      const bx = Math.min(width - 1, x + offset);
                      const bidx = (y * width + bx) * 4;
                      
                      outData[idx] = data[ridx];
                      outData[idx+1] = data[idx+1];
                      outData[idx+2] = data[bidx+2];
                      outData[idx+3] = data[idx+3];
                    }
                  }
                  tempCtx.putImageData(output, 0, 0);
                } else if (effect === 'night-vision') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    data[i] = 0;
                    data[i+1] = Math.min(255, luma * 1.5);
                    data[i+2] = 0;
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                  
                  tempCtx.fillStyle = 'rgba(0, 255, 0, 0.15)';
                  for (let y = 0; y < height; y += 3) {
                    tempCtx.fillRect(0, y, width, 1);
                  }
                } else if (effect === 'thermal') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    if (luma < 85) {
                      data[i] = 0;
                      data[i+1] = 0;
                      data[i+2] = Math.min(255, luma * 3);
                    } else if (luma < 170) {
                      data[i] = Math.min(255, (luma - 85) * 3);
                      data[i+1] = 0;
                      data[i+2] = Math.max(0, 255 - (luma - 85) * 3);
                    } else {
                      data[i] = 255;
                      data[i+1] = Math.min(255, (luma - 170) * 3);
                      data[i+2] = 0;
                    }
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                } else if (effect === 'old-movie') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i+1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i+2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                  
                  tempCtx.strokeStyle = 'rgba(255,255,255,0.15)';
                  tempCtx.lineWidth = 1;
                  if (Math.random() < 0.4) {
                    const scratchX = Math.random() * width;
                    tempCtx.beginPath();
                    tempCtx.moveTo(scratchX, 0);
                    tempCtx.lineTo(scratchX + (Math.random() - 0.5) * 10, height);
                    tempCtx.stroke();
                  }
                  
                  if (Math.random() < 0.25) {
                    tempCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                    tempCtx.beginPath();
                    tempCtx.arc(Math.random() * width, Math.random() * height, Math.random() * 3 + 1, 0, Math.PI * 2);
                    tempCtx.fill();
                  }
                } else if (effect === 'ascii') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  tempCtx.fillStyle = '#111827';
                  tempCtx.fillRect(0, 0, width, height);
                  tempCtx.fillStyle = '#10B981';
                  tempCtx.font = '8px monospace';
                  const chars = '@#S%?*+;:. ';
                  const charWidth = 6;
                  const charHeight = 8;
                  for (let y = 0; y < height; y += charHeight) {
                    for (let x = 0; x < width; x += charWidth) {
                      const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
                      if (idx < data.length) {
                        const r = data[idx];
                        const g = data[idx+1];
                        const b = data[idx+2];
                        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        const charIdx = Math.min(chars.length - 1, Math.floor((luma / 255) * chars.length));
                        tempCtx.fillText(chars[charIdx], x, y);
                      }
                    }
                  }
                } else if (effect === 'glitch-static') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  const glitchedData = tempCtx.createImageData(width, height);
                  const out = glitchedData.data;
                  const jitterAmount = 15;
                  
                  const shiftRows: Array<{y: number, h: number, shift: number}> = [];
                  for (let i = 0; i < 5; i++) {
                    shiftRows.push({
                      y: Math.floor(Math.random() * height),
                      h: Math.floor(Math.random() * 20) + 5,
                      shift: Math.floor((Math.random() - 0.5) * jitterAmount),
                    });
                  }

                  for (let y = 0; y < height; y++) {
                    let currentShift = 0;
                    const shiftRow = shiftRows.find(r => y >= r.y && y < r.y + r.h);
                    if (shiftRow) {
                      currentShift = shiftRow.shift;
                    }
                    for (let x = 0; x < width; x++) {
                      const targetX = (x + currentShift + width) % width;
                      const srcIdx = (y * width + targetX) * 4;
                      const destIdx = (y * width + x) * 4;
                      
                      out[destIdx] = data[srcIdx];
                      out[destIdx + 1] = data[((y * width + ((targetX + 4) % width)) * 4) + 1];
                      out[destIdx + 2] = data[((y * width + ((targetX - 4 + width) % width)) * 4) + 2];
                      out[destIdx + 3] = data[srcIdx + 3];
                    }
                  }
                  tempCtx.putImageData(glitchedData, 0, 0);
                  tempCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                  for (let i = 0; i < 15; i++) {
                    if (Math.random() < 0.5) {
                      const lineY = Math.random() * height;
                      tempCtx.fillRect(0, lineY, width, Math.random() * 2 + 1);
                    }
                  }
                } else if (effect === 'oil-paint') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  tempCtx.clearRect(0, 0, width, height);
                  const step = 6;
                  for (let y = 0; y < height; y += step) {
                    for (let x = 0; x < width; x += step) {
                      const idx = (y * width + x) * 4;
                      if (idx < data.length) {
                        const r = data[idx];
                        const g = data[idx+1];
                        const b = data[idx+2];
                        tempCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
                        tempCtx.beginPath();
                        const radius = step * (1 + Math.random() * 0.5);
                        tempCtx.arc(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3, radius, 0, Math.PI * 2);
                        tempCtx.fill();
                      }
                    }
                  }
                } else if (effect === 'vaporwave') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                    const ratio = luma / 255;
                    data[i] = Math.min(255, 30 + (255 - 30) * ratio);
                    data[i+1] = Math.min(255, 5 + (180 - 5) * ratio);
                    data[i+2] = Math.min(255, 120 + (255 - 120) * ratio);
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                  const gridGrad = tempCtx.createLinearGradient(0, 0, 0, height);
                  gridGrad.addColorStop(0, 'rgba(0, 240, 255, 0.1)');
                  gridGrad.addColorStop(1, 'rgba(255, 0, 128, 0.25)');
                  tempCtx.fillStyle = gridGrad;
                  tempCtx.fillRect(0, 0, width, height);
                } else if (effect === 'mirror-horizontal') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  const halfWidth = Math.floor(width / 2);
                  for (let y = 0; y < height; y++) {
                    for (let x = 0; x < halfWidth; x++) {
                      const leftIdx = (y * width + x) * 4;
                      const rightIdx = (y * width + (width - 1 - x)) * 4;
                      data[rightIdx] = data[leftIdx];
                      data[rightIdx+1] = data[leftIdx+1];
                      data[rightIdx+2] = data[leftIdx+2];
                      data[rightIdx+3] = data[leftIdx+3];
                    }
                  }
                  tempCtx.putImageData(imageData, 0, 0);
                } else if (effect === 'edge-glow') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  const edgeData = tempCtx.createImageData(width, height);
                  const out = edgeData.data;
                  for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                      const idx = (y * width + x) * 4;
                      const lumaCenter = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
                      const lumaRight = 0.299 * data[idx+4] + 0.587 * data[idx+5] + 0.114 * data[idx+6];
                      const lumaDown = 0.299 * data[idx + width*4] + 0.587 * data[idx + width*4 + 1] + 0.114 * data[idx + width*4 + 2];
                      const dx = Math.abs(lumaCenter - lumaRight);
                      const dy = Math.abs(lumaCenter - lumaDown);
                      const edgeVal = Math.min(255, dx + dy);
                      if (edgeVal > 30) {
                        out[idx] = 0;
                        out[idx+1] = 255;
                        out[idx+2] = 255;
                        out[idx+3] = edgeVal;
                      } else {
                        out[idx] = Math.floor(data[idx] * 0.3);
                        out[idx+1] = Math.floor(data[idx+1] * 0.3);
                        out[idx+2] = Math.floor(data[idx+2] * 0.3);
                        out[idx+3] = data[idx+3];
                      }
                    }
                  }
                  tempCtx.putImageData(edgeData, 0, 0);
                }
                
                ctx.drawImage(tempCanvas, 0, 0, width, height);
              }
            } else {
              ctx.drawImage(img, 0, 0, shape.width(), shape.height());
            }

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
  const canvasSize = useEditorStore(state => state.canvasSize);
  const shapeRef = useRef(null);
  const trRef = useRef(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const isVisible = currentTime >= item.start && currentTime <= item.start + item.duration;
  const clipTime = currentTime - item.start;
  const fadeIn = item.fadeIn || 0;
  const fadeOut = item.fadeOut || 0;
  let opacity = 1;

  const currentX = getInterpolatedValue(item, 'x', currentTime, item.x || 100);
  const currentY = getInterpolatedValue(item, 'y', currentTime, item.y || 100);
  const currentRotation = getInterpolatedValue(item, 'rotation', currentTime, item.rotation || 0);

  let displayX = currentX;
  let displayY = currentY;
  let displayScaleX = 1;
  let displayScaleY = 1;
  let displayRotation = currentRotation;

  if (fadeIn > 0 && clipTime < fadeIn) {
    const progress = clipTime / fadeIn;
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    if (item.transitionInType === 'fade' || !item.transitionInType) {
      opacity = progress;
    } else if (item.transitionInType === 'slide-left') {
      displayX = currentX + canvasSize.width * (1 - easeOut);
    } else if (item.transitionInType === 'slide-right') {
      displayX = currentX - canvasSize.width * (1 - easeOut);
    } else if (item.transitionInType === 'slide-up') {
      displayY = currentY + canvasSize.height * (1 - easeOut);
    } else if (item.transitionInType === 'slide-down') {
      displayY = currentY - canvasSize.height * (1 - easeOut);
    } else if (item.transitionInType === 'zoom-in') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'zoom-out') {
      displayScaleX = 2 - easeOut;
      displayScaleY = 2 - easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'spin-in' || item.transitionInType === 'spin') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      displayRotation = currentRotation - 180 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'drop') {
      displayY = currentY - canvasSize.height * (1 - Math.pow(easeOut, 2));
      displayScaleX = 0.5 + 0.5 * easeOut;
      displayScaleY = 0.5 + 0.5 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'elastic') {
      const elasticEaseOut = progress === 0 ? 0 : progress === 1 ? 1 : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
      displayScaleX = elasticEaseOut;
      displayScaleY = elasticEaseOut;
      opacity = progress < 0.2 ? progress / 0.2 : 1;
    } else if (item.transitionInType === 'rotate') {
      displayRotation = currentRotation - 90 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'flip-x') {
      displayScaleX = -1 + 2 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'flip-y') {
      displayScaleY = -1 + 2 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'slide-rotate') {
      displayX = currentX - canvasSize.width * (1 - easeOut);
      displayRotation = currentRotation - 360 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'zoom-spin') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      displayRotation = currentRotation - 720 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'glitch') {
      const jitterX = (Math.sin(progress * 50) * 15) * (1 - progress);
      const jitterY = (Math.cos(progress * 55) * 15) * (1 - progress);
      displayX = currentX + jitterX;
      displayY = currentY + jitterY;
      opacity = progress > 0.1 && Math.random() > 0.2 ? progress : 0;
    } else if (item.transitionInType === 'bounce') {
      let bProgress = progress;
      let bounceVal = 0;
      if (bProgress < 1 / 2.75) {
        bounceVal = 7.5625 * bProgress * bProgress;
      } else if (bProgress < 2 / 2.75) {
        bProgress -= 1.5 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.75;
      } else if (bProgress < 2.5 / 2.75) {
        bProgress -= 2.25 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.9375;
      } else {
        bProgress -= 2.625 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.984375;
      }
      displayY = currentY - canvasSize.height * (1 - bounceVal);
      opacity = progress;
    } else if (item.transitionInType === 'swing') {
      displayRotation = currentRotation + Math.sin(progress * Math.PI * 3.5) * 30 * (1 - progress);
      opacity = progress;
    } else if (item.transitionInType === 'heartbeat') {
      const pulse = 1 + Math.sin(progress * Math.PI * 2.5) * 0.15 * (1 - progress);
      displayScaleX = pulse;
      displayScaleY = pulse;
      opacity = progress;
    } else if (item.transitionInType === 'shutter') {
      const factor = Math.abs(Math.sin(progress * Math.PI * 4));
      opacity = progress * factor;
    } else if (item.transitionInType === 'diagonal-slide') {
      displayX = currentX - canvasSize.width * (1 - easeOut);
      displayY = currentY - canvasSize.height * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'wave-warp') {
      displayX = currentX + canvasSize.width * (1 - easeOut);
      displayY = currentY + Math.sin(progress * Math.PI * 4) * 35 * (1 - progress);
      opacity = progress;
    } else if (item.transitionInType === 'kaleidoscope') {
      displayScaleX = easeOut * (Math.sin(progress * Math.PI * 2) > 0 ? 1 : -1);
      displayScaleY = easeOut;
      displayRotation = currentRotation + 180 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'pixel-dissolve') {
      const stepProg = Math.floor(progress * 8) / 8;
      displayScaleX = 0.8 + 0.2 * stepProg;
      displayScaleY = 0.8 + 0.2 * stepProg;
      opacity = stepProg;
    } else if (item.transitionInType === 'blur-fade') {
      displayScaleX = 0.7 + 0.3 * easeOut;
      displayScaleY = 0.7 + 0.3 * easeOut;
      opacity = progress;
    }
  } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
    const progress = (clipTime - (item.duration - fadeOut)) / fadeOut;
    const easeIn = Math.pow(progress, 3);
    
    if (item.transitionOutType === 'fade' || !item.transitionOutType) {
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'slide-left') {
      displayX = currentX - canvasSize.width * easeIn;
    } else if (item.transitionOutType === 'slide-right') {
      displayX = currentX + canvasSize.width * easeIn;
    } else if (item.transitionOutType === 'slide-up') {
      displayY = currentY - canvasSize.height * easeIn;
    } else if (item.transitionOutType === 'slide-down') {
      displayY = currentY + canvasSize.height * easeIn;
    } else if (item.transitionOutType === 'zoom-in') {
      displayScaleX = 1 + easeIn;
      displayScaleY = 1 + easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'zoom-out') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'spin-out' || item.transitionOutType === 'spin') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 180 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'drop') {
      displayY = currentY + canvasSize.height * easeIn;
      displayScaleX = 1 - 0.5 * Math.pow(easeIn, 2);
      displayScaleY = 1 - 0.5 * Math.pow(easeIn, 2);
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'elastic') {
      const pt = 1 - progress;
      const elasticEaseIn = pt === 0 ? 0 : pt === 1 ? 1 : -(Math.pow(2, 10 * (pt - 1)) * Math.sin(((pt - 1) - 0.075) * ((2 * Math.PI) / 0.3)));
      displayScaleX = 1 - elasticEaseIn;
      displayScaleY = 1 - elasticEaseIn;
      opacity = progress > 0.8 ? (1 - progress) / 0.2 : 1;
    } else if (item.transitionOutType === 'rotate') {
      displayRotation = currentRotation + 90 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-x') {
      displayScaleX = 1 - 2 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-y') {
      displayScaleY = 1 - 2 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'slide-rotate') {
      displayX = currentX + canvasSize.width * easeIn;
      displayRotation = currentRotation + 360 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'zoom-spin') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 720 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'glitch') {
      const jitterX = (Math.sin(progress * 50) * 15) * progress;
      const jitterY = (Math.cos(progress * 55) * 15) * progress;
      displayX = currentX + jitterX;
      displayY = currentY + jitterY;
      opacity = progress < 0.9 && Math.random() > 0.2 ? 1 - progress : 0;
    } else if (item.transitionOutType === 'bounce') {
      const pt = 1 - progress;
      let bProgress = pt;
      let bounceVal = 0;
      if (bProgress < 1 / 2.75) {
        bounceVal = 7.5625 * bProgress * bProgress;
      } else if (bProgress < 2 / 2.75) {
        bProgress -= 1.5 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.75;
      } else if (bProgress < 2.5 / 2.75) {
        bProgress -= 2.25 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.9375;
      } else {
        bProgress -= 2.625 / 2.75;
        bounceVal = 7.5625 * bProgress * bProgress + 0.984375;
      }
      displayY = currentY + canvasSize.height * (1 - bounceVal);
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'swing') {
      displayRotation = currentRotation + Math.sin(progress * Math.PI * 3.5) * 30 * progress;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'heartbeat') {
      const pulse = 1 - Math.sin(progress * Math.PI * 2.5) * 0.15 * progress;
      displayScaleX = Math.max(0, pulse * (1 - progress));
      displayScaleY = Math.max(0, pulse * (1 - progress));
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'shutter') {
      const factor = Math.abs(Math.sin(progress * Math.PI * 4));
      opacity = (1 - progress) * factor;
    } else if (item.transitionOutType === 'diagonal-slide') {
      displayX = currentX + canvasSize.width * easeIn;
      displayY = currentY + canvasSize.height * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'wave-warp') {
      displayX = currentX - canvasSize.width * easeIn;
      displayY = currentY + Math.sin(progress * Math.PI * 4) * 35 * progress;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'kaleidoscope') {
      displayScaleX = (1 - easeIn) * (Math.sin(progress * Math.PI * 2) > 0 ? 1 : -1);
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 180 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'pixel-dissolve') {
      const stepProg = Math.floor((1 - progress) * 8) / 8;
      displayScaleX = 0.8 + 0.2 * stepProg;
      displayScaleY = 0.8 + 0.2 * stepProg;
      opacity = stepProg;
    } else if (item.transitionOutType === 'blur-fade') {
      displayScaleX = 1 + 0.5 * easeIn;
      displayScaleY = 1 + 0.5 * easeIn;
      opacity = 1 - progress;
    }
  }

  let displayOpacity = opacity;
  let displayText = item.text || 'Text Overlay';

  if (item.textTransform === 'uppercase') {
    displayText = displayText.toUpperCase();
  } else if (item.textTransform === 'lowercase') {
    displayText = displayText.toLowerCase();
  } else if (item.textTransform === 'capitalize') {
    displayText = displayText.replace(/\b\w/g, c => c.toUpperCase());
  }

  if (item.textAnimation === 'fade') {
    const animDuration = Math.min(1, item.duration); // 1 second or duration
    if (clipTime < animDuration) {
      displayOpacity = opacity * (clipTime / animDuration);
    }
  } else if (item.textAnimation === 'slide') {
    const animDuration = Math.min(1, item.duration);
    if (clipTime < animDuration) {
      const progress = clipTime / animDuration;
      const easeOut = 1 - Math.pow(1 - progress, 3);
      displayY = currentY + 50 * (1 - easeOut);
      displayOpacity = opacity * easeOut;
    }
  } else if (item.textAnimation === 'typewriter') {
    const animDuration = Math.min(2, item.duration); // 2 seconds for typewriter
    if (clipTime < animDuration) {
      const progress = clipTime / animDuration;
      const charCount = Math.floor(displayText.length * progress);
      displayText = displayText.substring(0, charCount);
    }
  } else if (item.textAnimation === 'bounce') {
    const animDuration = Math.min(1, item.duration);
    if (clipTime < animDuration) {
      const progress = clipTime / animDuration;
      const bounceVal = Math.abs(Math.sin(progress * Math.PI * 3)) * (1 - progress);
      displayY = currentY - 35 * bounceVal;
      displayOpacity = opacity * Math.min(1, progress * 2);
    }
  } else if (item.textAnimation === 'pop' || item.textAnimation === 'zoom') {
    const animDuration = Math.min(0.8, item.duration);
    if (clipTime < animDuration) {
      const progress = clipTime / animDuration;
      const scaleVal = 0.2 + 0.8 * Math.sin(progress * Math.PI * 0.5);
      displayScaleX *= scaleVal;
      displayScaleY *= scaleVal;
      displayOpacity = opacity * progress;
    }
  }

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

  const isBold = item.fontWeight === 'bold' || item.fontWeight === '800' || item.fontWeight === '600' || item.fontWeight === '700';
  const isItalic = item.fontStyle === 'italic';
  const computedFontStyle = `${isBold ? 'bold' : ''} ${isItalic ? 'italic' : ''}`.trim() || 'normal';

  const bgPadding = item.backgroundPadding ?? 10;
  const bgCornerRadius = item.borderRadius ?? 6;
  const bgWidth = (shapeRef.current?.width() || 140) + bgPadding * 2;
  const bgHeight = (shapeRef.current?.height() || 36) + bgPadding * 2;

  return (
    <>
      {item.backgroundColor && (
        <Rect
          x={displayX - bgPadding}
          y={displayY - bgPadding}
          width={bgWidth}
          height={bgHeight}
          fill={item.backgroundColor}
          cornerRadius={bgCornerRadius}
          opacity={displayOpacity}
          rotation={displayRotation}
          scaleX={displayScaleX}
          scaleY={displayScaleY}
          visible={isVisible}
        />
      )}
      <Text
        ref={shapeRef}
        text={displayText}
        fontFamily={item.fontFamily || 'sans-serif'}
        fontSize={item.fontSize || 32}
        fontStyle={computedFontStyle}
        align={item.textAlign || 'left'}
        letterSpacing={item.letterSpacing || 0}
        lineHeight={item.lineHeight || 1.2}
        fill={item.fontFill || '#ffffff'}
        stroke={item.strokeColor || undefined}
        strokeWidth={item.strokeWidth || 0}
        shadowColor={item.shadowColor || undefined}
        shadowBlur={item.shadowBlur || 0}
        shadowOffsetX={item.shadowOffsetX || 0}
        shadowOffsetY={item.shadowOffsetY || 0}
        shadowOpacity={item.shadowColor ? 0.8 : 0}
        x={displayX}
        y={displayY}
        scaleX={displayScaleX}
        scaleY={displayScaleY}
        rotation={displayRotation}
        opacity={displayOpacity}
        visible={isVisible}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          const xOffset = displayX - currentX;
          const yOffset = displayY - currentY;
          handleTransformChange({
            x: e.target.x() - xOffset,
            y: e.target.y() - yOffset,
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          
          node.scaleX(1);
          node.scaleY(1);
          
          const xOffset = displayX - currentX;
          const yOffset = displayY - currentY;
          handleTransformChange({
            x: node.x() - xOffset,
            y: node.y() - yOffset,
            fontSize: (item.fontSize || 32) * scaleX,
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

const AudioComponent = ({ item, isPlaying, audioContext, audioDestination, analyser, volume = 100, muted = false }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  const tracks = useEditorStore(state => state.tracks);
  const audioRef = useRef(document.createElement('audio'));
  const [loaded, setLoaded] = useState(false);
  const asset = useEditorStore(state => state.assets.find(a => a.id === item.assetId));
  const sourceNodeRef = useRef<any>(null);
  const globalPlayRate = useEditorStore(state => state.playbackRateMultiplier || 1.0);

  // Handle Audio Context Connection
  useEffect(() => {
    if (!asset || asset.type !== 'audio' || !audioContext || !audioDestination) return;
    const audio = audioRef.current;
    
    if (!sourceNodeRef.current) {
      try {
        sourceNodeRef.current = audioContext.createMediaElementSource(audio);
        sourceNodeRef.current.connect(audioDestination);
        sourceNodeRef.current.connect(audioContext.destination);
        if (analyser) {
          sourceNodeRef.current.connect(analyser);
        }
      } catch (e) {
        console.warn('Failed to connect audio to audio context', e);
      }
    }

    return () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch (e) {}
      }
    };
  }, [asset, audioContext, audioDestination]);

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
    
    const playbackRate = (item.playbackRate || 1) * globalPlayRate;
    if (audio.playbackRate !== playbackRate) {
      audio.playbackRate = playbackRate;
    }

    const timelineDelta = currentTime - item.start;
    const localTime = (timelineDelta * (item.playbackRate || 1)) + item.offset;
    
    const isVisible = currentTime >= item.start && currentTime <= item.start + item.duration;

    // Calculate volume based on fade in/out
    let volumeMultiplier = 1;
    const clipTime = currentTime - item.start;
    const fadeIn = item.fadeIn || 0;
    const fadeOut = item.fadeOut || 0;

    if (fadeIn > 0 && clipTime < fadeIn) {
      volumeMultiplier = clipTime / fadeIn;
    } else if (fadeOut > 0 && clipTime > item.duration - fadeOut) {
      volumeMultiplier = (item.duration - clipTime) / fadeOut;
    }
    
    let targetVolume = ((item.volume ?? 100) / 100) * volumeMultiplier * (muted ? 0 : volume / 100);
    
    // Auto-duck logic
    if (item.autoDuck) {
      const isPlayingPrimary = tracks.some(t => {
        if (t.id === item.id) return false;
        const active = currentTime >= t.start && currentTime <= t.start + t.duration;
        if (!active) return false;
        const isVideoWithAudio = t.type === 'video' && (t.volume ?? 100) > 0;
        const isPrimaryAudio = t.type === 'audio' && !t.autoDuck && (t.volume ?? 100) > 0;
        return isVideoWithAudio || isPrimaryAudio;
      });
      if (isPlayingPrimary) {
        targetVolume *= 0.15; // Duck to 15%
      }
    }

    targetVolume = Math.max(0, Math.min(1, targetVolume));
    if (Math.abs(audio.volume - targetVolume) > 0.01) {
      audio.volume = targetVolume;
    }

    if (isPlaying) {
      if (isVisible) {
        if (audio.paused) {
          if (Math.abs(audio.currentTime - localTime) > 0.5) {
            audio.currentTime = localTime;
          }
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }
        } else {
          if (Math.abs(audio.currentTime - localTime) > 1.0 * playbackRate) {
            audio.currentTime = localTime;
          }
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
  }, [currentTime, isPlaying, item.start, item.offset, item.duration, loaded, asset, item.fadeIn, item.fadeOut, item.playbackRate, globalPlayRate]);

  return null;
};

const RealtimeVisualizer = ({ analyser }: { analyser: AnalyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(74, 222, 128, ${0.5 + barHeight / canvas.height})`; // green-400
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      requestAnimationFrame(draw);
    };

    const animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={40}
      className="absolute bottom-4 left-4 bg-black/40 rounded border border-white/10 z-50 pointer-events-none"
    />
  );
};

const Preview = forwardRef((props: { canvasSize?: { width: number, height: number } }, ref) => {
  const { 
    tracks, 
    isPlaying, 
    setIsPlaying,
    selectedItemId, 
    setSelectedItem, 
    updateTrackItem,
    canvasSize: storeCanvasSize,
    previewZoom,
    setPreviewZoom,
    currentTime,
    setCurrentTime,
    duration,
    isLooping = false,
    setIsLooping,
    playbackRateMultiplier = 1.0,
    setPlaybackRateMultiplier
  } = useEditorStore();

  const canvasSize = props.canvasSize || storeCanvasSize;

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        audioContextRef.current = new AudioContextClass();
        audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
        
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 128;
        analyserRef.current = analyser;
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getAudioStream: () => {
      return audioDestinationRef.current?.stream || null;
    }
  }));

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Video player control states
  const [playerVolume, setPlayerVolume] = useState(100);
  const [isPlayerMuted, setIsPlayerMuted] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const centis = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  const projectDuration = tracks.length > 0 
    ? Math.max(...tracks.map(t => t.start + t.duration)) 
    : duration;

  const progressPercent = projectDuration > 0 
    ? (currentTime / projectDuration) * 100 
    : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(Math.min(projectDuration, Math.max(0, newTime)));
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(percentage * projectDuration);
    setHoverPosition(percentage * 100);
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
  };

  const handlePlayPause = () => {
    if (!isPlaying && currentTime >= projectDuration) {
      setCurrentTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (setPlaybackRateMultiplier) {
      setPlaybackRateMultiplier(parseFloat(e.target.value));
    }
  };

  // Keyboard shortcut controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime(Math.max(0, currentTime - 0.1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime(Math.min(projectDuration, currentTime + 0.1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, projectDuration]);

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
      if (!canvasWrapperRef.current) return;
      
      if (previewZoom === 'fit') {
        const { offsetWidth, offsetHeight } = canvasWrapperRef.current;
        if (offsetWidth === 0 || offsetHeight === 0) return;
        const scaleW = offsetWidth / canvasSize.width;
        const scaleH = offsetHeight / canvasSize.height;
        const newScale = Math.max(0.05, Math.min(scaleW, scaleH) * 0.92); // 92% fit, min 5%
        setScale(newScale);
      } else {
        setScale(previewZoom);
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);

    let resizeObserver: ResizeObserver | null = null;
    if (canvasWrapperRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateScale();
      });
      resizeObserver.observe(canvasWrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [canvasSize, isFullScreen, previewZoom]);

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedItem(null);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-[#121214] flex flex-col overflow-hidden relative border border-white/10 rounded-lg"
    >
      {/* Canvas View Area */}
      <div 
        ref={canvasWrapperRef}
        className="flex-1 bg-black flex items-center justify-center overflow-auto relative custom-scrollbar p-4 min-h-0"
      >
        {/* Audio Tracks (Invisible) */}
        {tracks.filter(t => t.type === 'audio').map(item => (
          <AudioComponent 
            key={item.id} 
            item={item} 
            isPlaying={isPlaying} 
            audioContext={audioContextRef.current}
            audioDestination={audioDestinationRef.current}
            analyser={analyserRef.current}
            volume={playerVolume}
            muted={isPlayerMuted}
          />
        ))}

        {isPlaying && analyserRef.current && (
          <RealtimeVisualizer analyser={analyserRef.current} />
        )}

        <div style={{
          width: canvasSize.width * scale,
          height: canvasSize.height * scale,
        }} className="relative shadow-2xl">
          <Stage
            width={canvasSize.width * scale}
            height={canvasSize.height * scale}
            scaleX={scale}
            scaleY={scale}
            pixelRatio={1 / scale}
            onMouseDown={handleStageClick}
            onTouchStart={handleStageClick}
            className="bg-gray-900"
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
                        audioContext={audioContextRef.current}
                        audioDestination={audioDestinationRef.current}
                        analyser={analyserRef.current}
                        volume={playerVolume}
                        muted={isPlayerMuted}
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
        
        {/* Top-Right overlays (Fullscreen etc) */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button 
            onClick={toggleFullScreen}
            className="p-1.5 bg-black/60 backdrop-blur rounded border border-white/10 text-white hover:bg-white/20 transition-all shadow-lg hover:scale-105"
            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
          >
            {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-[#18181b] border-t border-white/10 px-4 py-3 select-none flex flex-col gap-2 z-20 shrink-0">
        
        {/* Progress bar container */}
        <div className="relative group w-full flex items-center h-4">
          <div className="relative w-full h-1 bg-white/10 rounded-full group-hover:h-2 transition-all duration-150 overflow-visible">
            {/* Hover tooltip visual marker */}
            {hoverTime !== null && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white/40 pointer-events-none"
                style={{ left: `${hoverPosition}%` }}
              />
            )}
            
            {/* Progress line */}
            <div 
              className="absolute left-0 top-0 h-full bg-cyan-500 rounded-full group-hover:bg-cyan-400 transition-all shadow-[0_0_8px_rgba(6,182,212,0.5)]" 
              style={{ width: `${progressPercent}%` }}
            />
            
            {/* Thumb */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-cyan-500 shadow-md scale-0 group-hover:scale-100 transition-transform duration-150 -translate-x-1/2"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          {/* Interactive invisible range input */}
          <input
            type="range"
            min={0}
            max={projectDuration}
            step={0.01}
            value={currentTime}
            onChange={handleSeekChange}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={handleProgressMouseLeave}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          />

          {/* Tooltip */}
          {hoverTime !== null && (
            <div 
              className="absolute bottom-6 bg-[#09090b] text-white text-[11px] font-medium px-2 py-1 rounded border border-white/10 font-mono shadow-xl pointer-events-none transform -translate-x-1/2 z-50 flex items-center gap-1.5"
              style={{ left: `${hoverPosition}%` }}
            >
              <span className="text-cyan-400 font-semibold">Seek:</span>
              <span>{formatTime(hoverTime)}</span>
            </div>
          )}
        </div>

        {/* Buttons & Indicators Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left Block: Time Indicators */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white bg-white/5 border border-white/5 px-2.5 py-1 rounded select-none shadow-sm flex items-center gap-1.5">
              <span className="text-cyan-400 font-semibold">{formatTime(currentTime)}</span>
              <span className="text-white/30">/</span>
              <span className="text-white/60">{formatTime(projectDuration)}</span>
            </span>
            
            {isLooping && (
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded animate-pulse">
                Looping
              </span>
            )}
          </div>

          {/* Middle Block: Playback controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={() => setCurrentTime(0)}
              className="p-2 text-white/70 hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95"
              title="Skip to Start"
            >
              <SkipBack size={16} />
            </button>

            <button 
              onClick={() => setCurrentTime(Math.max(0, currentTime - 0.1))}
              className="p-2 text-white/70 hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95"
              title="Step Backward (0.1s)"
            >
              <ChevronLeft size={16} />
            </button>

            <button 
              onClick={handlePlayPause}
              className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/30"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>

            <button 
              onClick={() => setCurrentTime(Math.min(projectDuration, currentTime + 0.1))}
              className="p-2 text-white/70 hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95"
              title="Step Forward (0.1s)"
            >
              <ChevronRight size={16} />
            </button>

            <button 
              onClick={() => setCurrentTime(projectDuration)}
              className="p-2 text-white/70 hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95"
              title="Skip to End"
            >
              <SkipForward size={16} />
            </button>
          </div>

          {/* Right Block: Settings & Modifiers */}
          <div className="flex items-center gap-3 sm:gap-4 font-sans">
            
            {/* Speed Multiplier Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider hidden sm:inline">Speed</span>
              <select 
                value={playbackRateMultiplier}
                onChange={handleSpeedChange}
                className="bg-[#242427] hover:bg-[#2c2c30] text-xs font-semibold text-white/80 border border-white/10 rounded px-2.5 py-1 outline-none cursor-pointer focus:border-cyan-500 transition-colors"
                title="Playback Speed"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1.0x (Normal)</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
            </div>

            {/* Loop Toggle */}
            <button 
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded transition-all hover:scale-105 active:scale-95 border ${
                isLooping 
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                  : "bg-transparent border-transparent text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Loop Project Playback"
            >
              <Repeat size={16} className={isLooping ? "animate-spin-slow" : ""} />
            </button>

            {/* Master Volume Controls */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsPlayerMuted(!isPlayerMuted)}
                className="text-white/60 hover:text-white transition-colors"
                title={isPlayerMuted ? "Unmute" : "Mute"}
              >
                {isPlayerMuted || playerVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input 
                type="range"
                min={0}
                max={100}
                value={isPlayerMuted ? 0 : playerVolume}
                onChange={(e) => {
                  setPlayerVolume(parseInt(e.target.value));
                  if (isPlayerMuted) setIsPlayerMuted(false);
                }}
                className="w-16 sm:w-20 accent-cyan-500 h-1 bg-white/10 rounded-lg cursor-pointer hover:accent-cyan-400 transition-colors"
                title="Master Volume"
              />
            </div>

            {/* Control Bar Full Screen Button */}
            <button 
              onClick={toggleFullScreen}
              className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
});

export default Preview;
