import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Trash2, Copy, Layers, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Move, Diamond } from 'lucide-react';

export default function PropertiesPanel() {
  const { selectedItemId, tracks, updateTrackItem, removeTrackItem, currentTime } = useEditorStore();
  
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
    <div className="w-72 bg-[#1e1e1e] border-l border-white/10 flex flex-col">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Properties</h2>
        <button 
          onClick={() => removeTrackItem(selectedItem.id)}
          className="p-2 hover:bg-red-500/20 text-red-500 rounded transition-colors"
        >
          <Trash2 size={16} />
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
        <div className="space-y-4 pt-4 border-t border-white/10">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Transitions</h3>
          
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
      </div>
    </div>
  );
}
