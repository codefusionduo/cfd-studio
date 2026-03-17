import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Trash2, Copy, Layers, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Move, Diamond, Wand2, Loader2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import { v4 as uuidv4 } from 'uuid';

export default function PropertiesPanel() {
  const { selectedItemId, tracks, assets, updateTrackItem, removeTrackItem, addAsset, currentTime } = useEditorStore();
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  
  const selectedItem = tracks.find(t => t.id === selectedItemId);

  if (!selectedItem) {
    return (
      <div className="w-72 bg-[#1e1e1e] border-l border-white/10 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Layers className="text-white/20" size={24} />
        </div>
        <p className="text-sm text-white/50">Select an item on the timeline or preview to edit its properties</p>
      </div>
    );
  }

  const clipTime = currentTime - selectedItem.start;
  const canKeyframe = clipTime >= 0 && clipTime <= selectedItem.duration;

  const toggleKeyframe = (property: string, value: number) => {
    if (!canKeyframe) return;
    const currentKeyframes = selectedItem.keyframes?.[property as keyof typeof selectedItem.keyframes] || [];
    const existingIndex = currentKeyframes.findIndex(k => Math.abs(k.time - clipTime) < 0.05);
    
    let newKeyframes = [...currentKeyframes];
    if (existingIndex >= 0) {
      newKeyframes.splice(existingIndex, 1);
    } else {
      newKeyframes.push({ time: clipTime, value });
    }
    
    updateTrackItem(selectedItem.id, {
      keyframes: {
        ...(selectedItem.keyframes || {}),
        [property]: newKeyframes
      }
    });
  };

  const hasKeyframe = (property: string) => {
    if (!selectedItem.keyframes?.[property as keyof typeof selectedItem.keyframes]) return false;
    return selectedItem.keyframes[property as keyof typeof selectedItem.keyframes]!.some(k => Math.abs(k.time - clipTime) < 0.05);
  };

  const handleRemoveBackground = async () => {
    if (!selectedItem || selectedItem.type !== 'image') return;
    const asset = assets.find(a => a.id === selectedItem.assetId);
    if (!asset) return;

    setIsRemovingBg(true);
    try {
      const blob = await removeBackground(asset.src);
      const url = URL.createObjectURL(blob);
      
      const newAsset = {
        ...asset,
        id: uuidv4(),
        src: url,
        name: `${asset.name} (No BG)`
      };
      
      addAsset(newAsset);
      updateTrackItem(selectedItem.id, { assetId: newAsset.id });
    } catch (error) {
      console.error("Failed to remove background:", error);
      alert("Failed to remove background.");
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handlePropertyChange = (property: string, value: number | string) => {
    if (canKeyframe) {
      const currentKeyframes = selectedItem.keyframes?.[property as keyof typeof selectedItem.keyframes] || [];
      const existingIndex = currentKeyframes.findIndex(k => Math.abs(k.time - clipTime) < 0.05);
      
      if (existingIndex >= 0) {
        const newKeyframes = [...currentKeyframes];
        newKeyframes[existingIndex] = { time: clipTime, value: value as number };
        updateTrackItem(selectedItem.id, {
          keyframes: {
            ...(selectedItem.keyframes || {}),
            [property]: newKeyframes
          }
        });
        return;
      }
    }
    
    updateTrackItem(selectedItem.id, { [property]: value });
  };

  const KeyframeButton = ({ property, value }: { property: string, value: number }) => (
    <button
      onClick={() => toggleKeyframe(property, value)}
      disabled={!canKeyframe}
      className={`p-1 rounded transition-colors ${
        hasKeyframe(property) ? 'text-blue-400 bg-blue-400/20' : 'text-white/30 hover:text-white/70 hover:bg-white/10'
      } disabled:opacity-30 disabled:hover:bg-transparent`}
      title="Toggle Keyframe"
    >
      <Diamond size={12} fill={hasKeyframe(property) ? "currentColor" : "none"} />
    </button>
  );

  return (
    <div className="w-64 md:w-72 bg-[#1e1e1e] border-l border-white/10 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Properties</h2>
        <button 
          onClick={() => removeTrackItem(selectedItem.id)}
          className="px-2 py-1.5 flex items-center gap-1.5 hover:bg-red-500/20 text-red-500 rounded transition-colors text-xs font-medium"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Transform Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Transform</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-white/50">Position X</label>
                <KeyframeButton property="x" value={selectedItem.x || 0} />
              </div>
              <input 
                type="number" 
                value={Math.round(selectedItem.x || 0)}
                onChange={(e) => handlePropertyChange('x', Number(e.target.value))}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-white/50">Position Y</label>
                <KeyframeButton property="y" value={selectedItem.y || 0} />
              </div>
              <input 
                type="number" 
                value={Math.round(selectedItem.y || 0)}
                onChange={(e) => handlePropertyChange('y', Number(e.target.value))}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Nudge Controls */}
          <div className="pt-2">
             <label className="block text-xs text-white/50 mb-2 text-center">Nudge</label>
             <div className="grid grid-cols-3 gap-1 w-[120px] mx-auto">
               <div />
               <button 
                 onClick={() => handlePropertyChange('y', (selectedItem.y || 0) - 10)}
                 className="aspect-square bg-white/5 hover:bg-white/10 rounded flex items-center justify-center transition-colors active:bg-blue-500/50"
                 title="Move Up"
               >
                 <ChevronUp size={16} />
               </button>
               <div />
               
               <button 
                 onClick={() => handlePropertyChange('x', (selectedItem.x || 0) - 10)}
                 className="aspect-square bg-white/5 hover:bg-white/10 rounded flex items-center justify-center transition-colors active:bg-blue-500/50"
                 title="Move Left"
               >
                 <ChevronLeft size={16} />
               </button>
               <div className="flex items-center justify-center">
                 <Move size={16} className="text-white/20" />
               </div>
               <button 
                 onClick={() => handlePropertyChange('x', (selectedItem.x || 0) + 10)}
                 className="aspect-square bg-white/5 hover:bg-white/10 rounded flex items-center justify-center transition-colors active:bg-blue-500/50"
                 title="Move Right"
               >
                 <ChevronRight size={16} />
               </button>

               <div />
               <button 
                 onClick={() => handlePropertyChange('y', (selectedItem.y || 0) + 10)}
                 className="aspect-square bg-white/5 hover:bg-white/10 rounded flex items-center justify-center transition-colors active:bg-blue-500/50"
                 title="Move Down"
               >
                 <ChevronDown size={16} />
               </button>
               <div />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-white/50">Width</label>
                <KeyframeButton property="width" value={selectedItem.width || 0} />
              </div>
              <input 
                type="number" 
                value={Math.round(selectedItem.width || 0)}
                onChange={(e) => handlePropertyChange('width', Number(e.target.value))}
                disabled={selectedItem.type === 'text'}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-white/50">Height</label>
                <KeyframeButton property="height" value={selectedItem.height || 0} />
              </div>
              <input 
                type="number" 
                value={Math.round(selectedItem.height || 0)}
                onChange={(e) => handlePropertyChange('height', Number(e.target.value))}
                disabled={selectedItem.type === 'text'}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-white/50">Rotation</label>
              <KeyframeButton property="rotation" value={selectedItem.rotation || 0} />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="0" 
                max="360" 
                value={selectedItem.rotation || 0}
                onChange={(e) => handlePropertyChange('rotation', Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-white w-8 text-right">{Math.round(selectedItem.rotation || 0)}°</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-white/50">Layer Order</label>
            </div>
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded border border-white/10">
              <button 
                onClick={() => handlePropertyChange('layer', (selectedItem.layer || 0) + 1)}
                className="flex-1 py-1.5 hover:bg-white/10 rounded text-white flex items-center justify-center transition-colors"
                title="Bring Forward"
              >
                <ChevronUp size={16} />
              </button>
              <button 
                onClick={() => handlePropertyChange('layer', Math.max(0, (selectedItem.layer || 0) - 1))}
                className="flex-1 py-1.5 hover:bg-white/10 rounded text-white flex items-center justify-center transition-colors"
                title="Send Backward"
              >
                <ChevronDown size={16} />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button 
                onClick={() => {
                  const maxLayer = Math.max(...tracks.map(t => t.layer || 0));
                  handlePropertyChange('layer', maxLayer + 1);
                }}
                className="flex-1 py-1.5 hover:bg-white/10 rounded text-white flex items-center justify-center transition-colors"
                title="Bring to Front"
              >
                <ArrowUp size={16} />
              </button>
              <button 
                onClick={() => {
                  const minLayer = Math.min(...tracks.map(t => t.layer || 0));
                  handlePropertyChange('layer', Math.max(0, minLayer - 1));
                }}
                className="flex-1 py-1.5 hover:bg-white/10 rounded text-white flex items-center justify-center transition-colors"
                title="Send to Back"
              >
                <ArrowDown size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Text Specific Properties */}
        {selectedItem.type === 'text' && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Text</h3>
            
            <div>
              <label className="block text-xs text-white/50 mb-1">Content</label>
              <textarea 
                value={selectedItem.text || ''}
                onChange={(e) => updateTrackItem(selectedItem.id, { text: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Size</label>
                <input 
                  type="number" 
                  value={selectedItem.fontSize || 24}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fontSize: Number(e.target.value) })}
                  className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Color</label>
                <input 
                  type="color" 
                  value={selectedItem.fontFill || '#ffffff'}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fontFill: e.target.value })}
                  className="w-full h-[34px] bg-black/20 border border-white/10 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">Text Animation</label>
              <select
                value={selectedItem.textAnimation || 'none'}
                onChange={(e) => updateTrackItem(selectedItem.id, { textAnimation: e.target.value as any })}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
                <option value="typewriter">Typewriter</option>
              </select>
            </div>
          </div>
        )}

        {/* Effects Section */}
        {(selectedItem.type === 'video' || selectedItem.type === 'image') && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Effects</h3>
            
            {selectedItem.type === 'image' && (
              <button
                onClick={handleRemoveBackground}
                disabled={isRemovingBg}
                className="w-full py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/30 rounded flex items-center justify-center gap-2 text-sm text-white transition-colors disabled:opacity-50"
              >
                {isRemovingBg ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {isRemovingBg ? 'Removing Background...' : 'Remove Background'}
              </button>
            )}

            <div>
              <label className="block text-xs text-white/50 mb-1">Filter Preset</label>
              <select
                value={selectedItem.effect || 'none'}
                onChange={(e) => updateTrackItem(selectedItem.id, { effect: e.target.value as any })}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              >
                <option value="none">None</option>
                <option value="grayscale">Grayscale</option>
                <option value="sepia">Sepia</option>
                <option value="blur">Blur</option>
                <option value="invert">Invert</option>
                <option value="hue-rotate">Hue Rotate</option>
                <option value="pixelate">Pixelate</option>
                <option value="noise">Noise</option>
                <option value="vignette">Vignette</option>
                <option value="edge-detection">Edge Detection</option>
                <option value="emboss">Emboss</option>
                <option value="chroma-key">Chroma Key (Green Screen)</option>
              </select>
            </div>

            {selectedItem.effect === 'chroma-key' && (
              <div className="space-y-3 p-3 bg-black/20 rounded border border-white/5">
                <h4 className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Chroma Key Settings</h4>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Key Color</label>
                  <input 
                    type="color" 
                    value={selectedItem.chromaKeyColor || '#00ff00'}
                    onChange={(e) => updateTrackItem(selectedItem.id, { chromaKeyColor: e.target.value })}
                    className="w-full h-8 bg-black/20 border border-white/10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-white/50">Similarity</label>
                    <span className="text-[10px] text-white/30">{Math.round((selectedItem.chromaKeySimilarity ?? 0.1) * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={selectedItem.chromaKeySimilarity ?? 0.1}
                    onChange={(e) => updateTrackItem(selectedItem.id, { chromaKeySimilarity: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-white/50">Smoothness</label>
                    <span className="text-[10px] text-white/30">{Math.round((selectedItem.chromaKeySmoothness ?? 0.1) * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={selectedItem.chromaKeySmoothness ?? 0.1}
                    onChange={(e) => updateTrackItem(selectedItem.id, { chromaKeySmoothness: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-white/50">Brightness</label>
                  <span className="text-[10px] text-white/30">{selectedItem.brightness ?? 100}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={selectedItem.brightness ?? 100}
                  onChange={(e) => updateTrackItem(selectedItem.id, { brightness: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-white/50">Contrast</label>
                  <span className="text-[10px] text-white/30">{selectedItem.contrast ?? 100}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={selectedItem.contrast ?? 100}
                  onChange={(e) => updateTrackItem(selectedItem.id, { contrast: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-white/50">Saturation</label>
                  <span className="text-[10px] text-white/30">{selectedItem.saturation ?? 100}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={selectedItem.saturation ?? 100}
                  onChange={(e) => updateTrackItem(selectedItem.id, { saturation: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Timing Section */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Timing</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Start Time</label>
              <input 
                type="number" 
                step="0.1"
                value={selectedItem.start}
                onChange={(e) => updateTrackItem(selectedItem.id, { start: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Duration</label>
              <input 
                type="number" 
                step="0.1"
                value={selectedItem.duration}
                onChange={(e) => updateTrackItem(selectedItem.id, { duration: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          
          {(selectedItem.type === 'video' || selectedItem.type === 'audio') && (
            <div className="pt-2">
              <label className="block text-xs text-white/50 mb-1">Playback Speed ({selectedItem.playbackRate || 1}x)</label>
              <input 
                type="range" 
                min="0.25" 
                max="4" 
                step="0.25"
                value={selectedItem.playbackRate || 1}
                onChange={(e) => {
                  const newRate = Number(e.target.value);
                  const oldRate = selectedItem.playbackRate || 1;
                  const newDuration = Math.max(0.1, selectedItem.duration * (oldRate / newRate));
                  updateTrackItem(selectedItem.id, { 
                    playbackRate: newRate,
                    duration: newDuration
                  });
                }}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-white/30 px-1">
                <span>0.25x</span>
                <span>1x</span>
                <span>4x</span>
              </div>
            </div>
          )}
        </div>

        {/* Color Correction Section */}
        {(selectedItem.type === 'video' || selectedItem.type === 'image') && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Color</h3>
            
            <div>
              <label className="block text-xs text-white/50 mb-1">Brightness ({selectedItem.brightness ?? 100}%)</label>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={selectedItem.brightness ?? 100}
                onChange={(e) => updateTrackItem(selectedItem.id, { brightness: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-xs text-white/50 mb-1">Contrast ({selectedItem.contrast ?? 100}%)</label>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={selectedItem.contrast ?? 100}
                onChange={(e) => updateTrackItem(selectedItem.id, { contrast: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-xs text-white/50 mb-1">Saturation ({selectedItem.saturation ?? 100}%)</label>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={selectedItem.saturation ?? 100}
                onChange={(e) => updateTrackItem(selectedItem.id, { saturation: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Transitions Section */}
        {(selectedItem.type === 'video' || selectedItem.type === 'image' || selectedItem.type === 'text') && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Transitions</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-white/50">Type</label>
                  <div 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'transition',
                        transitionType: 'in',
                        value: selectedItem.transitionInType || 'fade',
                        duration: selectedItem.fadeIn || 0.5
                      }));
                    }}
                    className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/80"
                    title="Drag to apply to other clips"
                  >
                    <GripVertical size={12} />
                  </div>
                </div>
                <select
                  value={selectedItem.transitionInType || 'fade'}
                  onChange={(e) => updateTrackItem(selectedItem.id, { transitionInType: e.target.value as any })}
                  className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none mb-2"
                >
                  <option value="fade">Fade</option>
                  <option value="slide-left">Slide Left</option>
                  <option value="slide-right">Slide Right</option>
                  <option value="slide-up">Slide Up</option>
                  <option value="slide-down">Slide Down</option>
                  <option value="zoom-in">Zoom In</option>
                  <option value="zoom-out">Zoom Out</option>
                  <option value="spin-in">Spin In</option>
                  <option value="flip-x">Flip X</option>
                  <option value="flip-y">Flip Y</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Audio Fades Section */}
        {selectedItem.type === 'audio' && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Audio Fades</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Fade In (s)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max={selectedItem.duration / 2}
                  value={selectedItem.fadeIn || 0}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fadeIn: Number(e.target.value) })}
                  className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Fade Out (s)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max={selectedItem.duration / 2}
                  value={selectedItem.fadeOut || 0}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fadeOut: Number(e.target.value) })}
                  className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
