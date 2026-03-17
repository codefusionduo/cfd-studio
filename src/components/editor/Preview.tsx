import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Text, Shape } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import { Maximize, Minimize, Play, Pause } from 'lucide-react';

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

const MediaComponent = ({ item, isPlaying, onSelect, isSelected, onChange, audioContext, audioDestination }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  const canvasSize = useEditorStore(state => state.canvasSize);
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

    const playbackRate = item.playbackRate || 1;
    if (video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate;
    }

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
          if (Math.abs(video.currentTime - localTime) > 1.0 * playbackRate) {
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
    } else if (item.transitionInType === 'spin-in') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      displayRotation = currentRotation - 180 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'flip-x') {
      displayScaleX = -1 + 2 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'flip-y') {
      displayScaleY = -1 + 2 * easeOut;
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
    } else if (item.transitionOutType === 'spin-out') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 180 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-x') {
      displayScaleX = 1 - 2 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-y') {
      displayScaleY = 1 - 2 * easeIn;
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
            const hasFilter = b !== 100 || c !== 100 || s !== 100 || (effect !== 'none' && effect !== 'chroma-key' && effect !== 'pixelate' && effect !== 'noise' && effect !== 'vignette' && effect !== 'edge-detection' && effect !== 'emboss');
            
            if (ctx._context && hasFilter) {
              let filterStr = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
              if (effect === 'grayscale') filterStr += ' grayscale(100%)';
              if (effect === 'sepia') filterStr += ' sepia(100%)';
              if (effect === 'blur') filterStr += ' blur(10px)';
              if (effect === 'invert') filterStr += ' invert(100%)';
              if (effect === 'hue-rotate') filterStr += ' hue-rotate(90deg)';
              ctx._context.filter = filterStr;
            }

            if (effect === 'chroma-key' || effect === 'pixelate' || effect === 'noise' || effect === 'vignette' || effect === 'edge-detection' || effect === 'emboss') {
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
                } else if (effect === 'edge-detection' || effect === 'emboss') {
                  const imageData = tempCtx.getImageData(0, 0, width, height);
                  const data = imageData.data;
                  const output = tempCtx.createImageData(width, height);
                  const outData = output.data;
                  
                  const kernel = effect === 'edge-detection' ? 
                    [-1, -1, -1, -1, 8, -1, -1, -1, -1] : 
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
    } else if (item.transitionInType === 'spin-in') {
      displayScaleX = easeOut;
      displayScaleY = easeOut;
      displayRotation = currentRotation - 180 * (1 - easeOut);
      opacity = progress;
    } else if (item.transitionInType === 'flip-x') {
      displayScaleX = -1 + 2 * easeOut;
      opacity = progress;
    } else if (item.transitionInType === 'flip-y') {
      displayScaleY = -1 + 2 * easeOut;
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
    } else if (item.transitionOutType === 'spin-out') {
      displayScaleX = 1 - easeIn;
      displayScaleY = 1 - easeIn;
      displayRotation = currentRotation + 180 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-x') {
      displayScaleX = 1 - 2 * easeIn;
      opacity = 1 - progress;
    } else if (item.transitionOutType === 'flip-y') {
      displayScaleY = 1 - 2 * easeIn;
      opacity = 1 - progress;
    }
  }

  let displayOpacity = opacity;
  let displayText = item.text || 'Double Click to Edit';

  if (item.textAnimation === 'fade') {
    const animDuration = Math.min(1, item.duration); // 1 second or duration
    if (clipTime < animDuration) {
      displayOpacity = opacity * (clipTime / animDuration);
    }
  } else if (item.textAnimation === 'slide') {
    const animDuration = Math.min(1, item.duration);
    if (clipTime < animDuration) {
      const progress = clipTime / animDuration;
      // ease out cubic
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

  return (
    <>
      <Text
        ref={shapeRef}
        text={displayText}
        fontSize={item.fontSize || 24}
        fill={item.fontFill || 'white'}
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

const AudioComponent = ({ item, isPlaying, audioContext, audioDestination }) => {
  const currentTime = useEditorStore(state => state.currentTime);
  const audioRef = useRef(document.createElement('audio'));
  const [loaded, setLoaded] = useState(false);
  const asset = useEditorStore(state => state.assets.find(a => a.id === item.assetId));
  const sourceNodeRef = useRef<any>(null);

  // Handle Audio Context Connection
  useEffect(() => {
    if (!asset || asset.type !== 'audio' || !audioContext || !audioDestination) return;
    const audio = audioRef.current;
    
    if (!sourceNodeRef.current) {
      try {
        sourceNodeRef.current = audioContext.createMediaElementSource(audio);
        sourceNodeRef.current.connect(audioDestination);
        sourceNodeRef.current.connect(audioContext.destination);
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
    
    const playbackRate = item.playbackRate || 1;
    if (audio.playbackRate !== playbackRate) {
      audio.playbackRate = playbackRate;
    }

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
  }, [currentTime, isPlaying, item.start, item.offset, item.duration, loaded, asset, item.fadeIn, item.fadeOut, item.playbackRate]);

  return null;
};

const Preview = forwardRef((props, ref) => {
  const { 
    tracks, 
    isPlaying, 
    setIsPlaying,
    selectedItemId, 
    setSelectedItem, 
    updateTrackItem,
    canvasSize,
    previewZoom,
    setPreviewZoom
  } = useEditorStore();

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<any>(null);

  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        audioContextRef.current = new AudioContextClass();
        audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
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

  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);

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
        if (offsetWidth === 0 || offsetHeight === 0) return;
        const scaleW = offsetWidth / canvasSize.width;
        const scaleH = offsetHeight / canvasSize.height;
        const newScale = Math.max(0.05, Math.min(scaleW, scaleH) * 0.9); // 90% fit, min 5%
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
          audioContext={audioContextRef.current}
          audioDestination={audioDestinationRef.current}
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
          pixelRatio={1 / scale}
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
                      audioContext={audioContextRef.current}
                      audioDestination={audioDestinationRef.current}
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
        <button 
          onClick={() => {
            if (!isPlaying) {
              const state = useEditorStore.getState();
              const contentDuration = state.tracks.length > 0 
                ? Math.max(...state.tracks.map(t => t.start + t.duration)) 
                : state.duration;
              const stopTime = contentDuration > 0 ? contentDuration : state.duration;
              if (state.currentTime >= stopTime) {
                state.setCurrentTime(0);
              }
            }
            setIsPlaying(!isPlaying);
          }}
          className="p-1.5 bg-black/50 rounded text-white hover:bg-white/20 transition-colors"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
        </button>
        <PreviewTimeDisplay />

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
});

export default Preview;
