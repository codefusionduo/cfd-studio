import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Trash2, Copy, Layers, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Move, Diamond, Wand2, Loader2, ArrowUp, ArrowDown, GripVertical, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Type, Sparkles, Clock, Palette } from 'lucide-react';
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
        {/* Layer Name Section */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Item Name</label>
          <input 
            type="text" 
            value={selectedItem.name || `${selectedItem.type.toUpperCase()} Clip`}
            onChange={(e) => updateTrackItem(selectedItem.id, { name: e.target.value })}
            placeholder="Enter clip name..."
            className="w-full bg-black/20 border border-white/10 rounded px-2.5 py-1.5 text-sm text-white focus:border-cyan-500 outline-none"
          />
        </div>

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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                <Type size={14} className="text-pink-400" />
                Text Style
              </h3>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider">Style Presets</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, {
                    fontFill: '#ffffff',
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    backgroundPadding: 8,
                    borderRadius: 6,
                    fontWeight: 'bold',
                    fontSize: selectedItem.fontSize || 28,
                    strokeWidth: 0,
                    shadowBlur: 0,
                  })}
                  className="px-2 py-1.5 bg-black/40 hover:bg-white/10 border border-white/10 rounded text-[11px] text-white flex items-center justify-center gap-1 transition-colors"
                >
                  <span className="bg-black text-white px-1 rounded text-[9px] font-bold">CC</span>
                  <span>Caption Box</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, {
                    fontFill: '#22d3ee',
                    backgroundColor: undefined,
                    shadowColor: '#22d3ee',
                    shadowBlur: 18,
                    fontWeight: 'bold',
                    strokeColor: '#0891b2',
                    strokeWidth: 1,
                  })}
                  className="px-2 py-1.5 bg-black/40 hover:bg-white/10 border border-white/10 rounded text-[11px] text-cyan-300 flex items-center justify-center gap-1 transition-colors"
                >
                  <Sparkles size={11} />
                  <span>Neon Glow</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, {
                    fontFill: '#facc15',
                    backgroundColor: undefined,
                    strokeColor: '#000000',
                    strokeWidth: 3,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  })}
                  className="px-2 py-1.5 bg-black/40 hover:bg-white/10 border border-white/10 rounded text-[11px] text-yellow-400 font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Reels Bold</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, {
                    fontFill: '#ffffff',
                    backgroundColor: undefined,
                    fontFamily: 'Playfair Display, serif',
                    fontStyle: 'italic',
                    fontWeight: 'normal',
                    strokeWidth: 0,
                  })}
                  className="px-2 py-1.5 bg-black/40 hover:bg-white/10 border border-white/10 rounded text-[11px] text-pink-200 italic flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Serif Gold</span>
                </button>
              </div>
            </div>

            {/* Content Input */}
            <div>
              <label className="block text-xs text-white/50 mb-1">Text Content</label>
              <textarea 
                value={selectedItem.text || ''}
                onChange={(e) => updateTrackItem(selectedItem.id, { text: e.target.value })}
                placeholder="Enter text..."
                className="w-full bg-black/30 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:border-pink-500 outline-none min-h-[70px] resize-y"
              />
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-xs text-white/50 mb-1">Font Family</label>
              <select
                value={selectedItem.fontFamily || 'sans-serif'}
                onChange={(e) => updateTrackItem(selectedItem.id, { fontFamily: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white focus:border-pink-500 outline-none"
              >
                <option value="sans-serif">Sans-Serif (Default)</option>
                <option value="Inter, sans-serif">Inter (Modern)</option>
                <option value="Montserrat, sans-serif">Montserrat (Clean)</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Impact, sans-serif">Impact (Bold Title)</option>
                <option value="Playfair Display, serif">Playfair Display (Serif)</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Caveat, cursive">Caveat (Handwritten)</option>
                <option value="Anton, sans-serif">Anton (Heavy Punch)</option>
                <option value="Oswald, sans-serif">Oswald (Condensed)</option>
                <option value="Courier New, monospace">Courier (Monospace)</option>
              </select>
            </div>

            {/* Font Size & Steppers */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-white/50">Font Size ({selectedItem.fontSize || 32}px)</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updateTrackItem(selectedItem.id, { fontSize: Math.max(8, (selectedItem.fontSize || 32) - 4) })}
                    className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] text-white/70"
                  >
                    -4
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrackItem(selectedItem.id, { fontSize: Math.min(200, (selectedItem.fontSize || 32) + 4) })}
                    className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] text-white/70"
                  >
                    +4
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="10" 
                  max="140"
                  value={selectedItem.fontSize || 32}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fontSize: Number(e.target.value) })}
                  className="flex-1"
                />
                <input 
                  type="number" 
                  value={selectedItem.fontSize || 32}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fontSize: Number(e.target.value) })}
                  className="w-14 bg-black/30 border border-white/10 rounded px-1.5 py-1 text-xs text-white text-center focus:border-pink-500 outline-none"
                />
              </div>
            </div>

            {/* Formatting & Alignment toolbar */}
            <div className="space-y-1.5">
              <label className="block text-xs text-white/50">Style & Alignment</label>
              <div className="flex items-center justify-between gap-1 bg-black/30 p-1 rounded-md border border-white/10">
                {/* Bold */}
                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, { 
                    fontWeight: selectedItem.fontWeight === 'bold' ? 'normal' : 'bold' 
                  })}
                  className={`p-1.5 rounded transition-colors ${
                    selectedItem.fontWeight === 'bold' ? 'bg-pink-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Bold"
                >
                  <Bold size={14} />
                </button>

                {/* Italic */}
                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, { 
                    fontStyle: selectedItem.fontStyle === 'italic' ? 'normal' : 'italic' 
                  })}
                  className={`p-1.5 rounded transition-colors ${
                    selectedItem.fontStyle === 'italic' ? 'bg-pink-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Italic"
                >
                  <Italic size={14} />
                </button>

                {/* Uppercase */}
                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, { 
                    textTransform: selectedItem.textTransform === 'uppercase' ? 'none' : 'uppercase' 
                  })}
                  className={`px-1.5 py-1 rounded text-xs font-bold transition-colors ${
                    selectedItem.textTransform === 'uppercase' ? 'bg-pink-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Uppercase"
                >
                  AA
                </button>

                <div className="w-px h-4 bg-white/10 my-auto" />

                {/* Align Left */}
                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, { textAlign: 'left' })}
                  className={`p-1.5 rounded transition-colors ${
                    (!selectedItem.textAlign || selectedItem.textAlign === 'left') ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft size={14} />
                </button>

                {/* Align Center */}
                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, { textAlign: 'center' })}
                  className={`p-1.5 rounded transition-colors ${
                    selectedItem.textAlign === 'center' ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Align Center"
                >
                  <AlignCenter size={14} />
                </button>

                {/* Align Right */}
                <button
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, { textAlign: 'right' })}
                  className={`p-1.5 rounded transition-colors ${
                    selectedItem.textAlign === 'right' ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Align Right"
                >
                  <AlignRight size={14} />
                </button>
              </div>
            </div>

            {/* Text Color & Swatches */}
            <div className="space-y-2">
              <label className="block text-xs text-white/50">Font Color</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={selectedItem.fontFill || '#ffffff'}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fontFill: e.target.value })}
                  className="w-9 h-8 bg-black/30 border border-white/10 rounded cursor-pointer overflow-hidden p-0"
                />
                <input 
                  type="text" 
                  value={selectedItem.fontFill || '#ffffff'}
                  onChange={(e) => updateTrackItem(selectedItem.id, { fontFill: e.target.value })}
                  className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-white focus:border-pink-500 outline-none"
                />
              </div>

              {/* Swatches */}
              <div className="flex items-center gap-1.5 pt-1">
                {['#ffffff', '#facc15', '#22d3ee', '#ec4899', '#ef4444', '#22c55e', '#000000'].map(hex => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => updateTrackItem(selectedItem.id, { fontFill: hex })}
                    className="w-5 h-5 rounded-full border border-white/20 transition-transform hover:scale-110"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>

            {/* Background Box Option */}
            <div className="space-y-2.5 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/80 cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!selectedItem.backgroundColor}
                    onChange={(e) => updateTrackItem(selectedItem.id, {
                      backgroundColor: e.target.checked ? 'rgba(0,0,0,0.75)' : undefined
                    })}
                    className="rounded border-white/20 bg-black/30 text-pink-500 focus:ring-pink-500"
                  />
                  Background Box
                </label>
              </div>

              {selectedItem.backgroundColor && (
                <div className="p-2.5 bg-black/30 rounded-md border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/60">Box Color</span>
                    <input
                      type="color"
                      value={selectedItem.backgroundColor.startsWith('#') ? selectedItem.backgroundColor : '#000000'}
                      onChange={(e) => updateTrackItem(selectedItem.id, { backgroundColor: e.target.value })}
                      className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                      <span>Box Padding</span>
                      <span>{selectedItem.backgroundPadding ?? 10}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      value={selectedItem.backgroundPadding ?? 10}
                      onChange={(e) => updateTrackItem(selectedItem.id, { backgroundPadding: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                      <span>Corner Radius</span>
                      <span>{selectedItem.borderRadius ?? 6}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      value={selectedItem.borderRadius ?? 6}
                      onChange={(e) => updateTrackItem(selectedItem.id, { borderRadius: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stroke / Outline Option */}
            <div className="space-y-2.5 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/80 cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(selectedItem.strokeWidth || 0) > 0}
                    onChange={(e) => updateTrackItem(selectedItem.id, {
                      strokeWidth: e.target.checked ? 2 : 0,
                      strokeColor: selectedItem.strokeColor || '#000000'
                    })}
                    className="rounded border-white/20 bg-black/30 text-pink-500 focus:ring-pink-500"
                  />
                  Text Outline / Stroke
                </label>
              </div>

              {(selectedItem.strokeWidth || 0) > 0 && (
                <div className="p-2.5 bg-black/30 rounded-md border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/60">Stroke Color</span>
                    <input
                      type="color"
                      value={selectedItem.strokeColor || '#000000'}
                      onChange={(e) => updateTrackItem(selectedItem.id, { strokeColor: e.target.value })}
                      className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                      <span>Stroke Width</span>
                      <span>{selectedItem.strokeWidth || 2}px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={selectedItem.strokeWidth || 2}
                      onChange={(e) => updateTrackItem(selectedItem.id, { strokeWidth: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Text Glow / Shadow Option */}
            <div className="space-y-2.5 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/80 cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!selectedItem.shadowColor}
                    onChange={(e) => updateTrackItem(selectedItem.id, {
                      shadowColor: e.target.checked ? '#22d3ee' : undefined,
                      shadowBlur: e.target.checked ? 12 : 0
                    })}
                    className="rounded border-white/20 bg-black/30 text-pink-500 focus:ring-pink-500"
                  />
                  Glow / Shadow
                </label>
              </div>

              {selectedItem.shadowColor && (
                <div className="p-2.5 bg-black/30 rounded-md border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/60">Glow Color</span>
                    <input
                      type="color"
                      value={selectedItem.shadowColor || '#22d3ee'}
                      onChange={(e) => updateTrackItem(selectedItem.id, { shadowColor: e.target.value })}
                      className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                      <span>Glow Blur Radius</span>
                      <span>{selectedItem.shadowBlur || 12}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="35"
                      value={selectedItem.shadowBlur || 12}
                      onChange={(e) => updateTrackItem(selectedItem.id, { shadowBlur: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Animation Selector */}
            <div className="pt-2 border-t border-white/5">
              <label className="block text-xs text-white/50 mb-1">Text Animation</label>
              <select
                value={selectedItem.textAnimation || 'none'}
                onChange={(e) => updateTrackItem(selectedItem.id, { textAnimation: e.target.value as any })}
                className="w-full bg-black/30 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white focus:border-pink-500 outline-none"
              >
                <option value="none">None</option>
                <option value="fade">Fade In</option>
                <option value="slide">Slide Up</option>
                <option value="typewriter">Typewriter</option>
                <option value="bounce">Bounce Pop</option>
                <option value="pop">Zoom Scale</option>
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
                <option value="sharpen">Sharpen</option>
                <option value="posterize">Posterize</option>
                <option value="solarize">Solarize</option>
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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-blue-400" />
              Timing & Duration
            </h3>
            <button
              type="button"
              onClick={() => updateTrackItem(selectedItem.id, { start: Math.max(0, currentTime) })}
              className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline"
              title="Snap start time to playhead"
            >
              Move to Playhead
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Start Time (s)</label>
              <input 
                type="number" 
                step="0.1"
                min="0"
                value={selectedItem.start}
                onChange={(e) => updateTrackItem(selectedItem.id, { start: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Duration (s)</label>
              <input 
                type="number" 
                step="0.1"
                min="0.1"
                value={selectedItem.duration}
                onChange={(e) => updateTrackItem(selectedItem.id, { duration: Math.max(0.1, Number(e.target.value)) })}
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Quick Duration Preset Buttons */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-white/40 uppercase font-bold">Quick Duration:</span>
            <div className="flex items-center gap-1">
              {[2, 3, 5, 8, 10].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => updateTrackItem(selectedItem.id, { duration: sec })}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                    selectedItem.duration === sec ? 'bg-blue-600 text-white font-bold' : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Fade In / Fade Out Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex justify-between text-[10px] text-white/50 mb-1">
                <span>Fade In</span>
                <span>{(selectedItem.fadeIn || 0).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.min(5, selectedItem.duration / 2)}
                step="0.1"
                value={selectedItem.fadeIn || 0}
                onChange={(e) => updateTrackItem(selectedItem.id, { fadeIn: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-white/50 mb-1">
                <span>Fade Out</span>
                <span>{(selectedItem.fadeOut || 0).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.min(5, selectedItem.duration / 2)}
                step="0.1"
                value={selectedItem.fadeOut || 0}
                onChange={(e) => updateTrackItem(selectedItem.id, { fadeOut: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
          
          {(selectedItem.type === 'video' || selectedItem.type === 'audio') && (
            <div className="pt-2 border-t border-white/5">
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

        {/* Audio Settings Section */}
        {(selectedItem.type === 'audio' || selectedItem.type === 'video') && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Audio Settings</h3>
            
            <div>
              <label className="block text-xs text-white/50 mb-1">Volume ({selectedItem.volume ?? 100}%)</label>
              <input 
                type="range" 
                min="0" 
                max="200"
                step="1"
                value={selectedItem.volume ?? 100}
                onChange={(e) => updateTrackItem(selectedItem.id, { volume: Number(e.target.value) })}
                className="w-full h-1 bg-white/20 rounded-full appearance-none accent-blue-500"
              />
            </div>

            {selectedItem.type === 'audio' && (
              <div>
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer hover:bg-white/5 p-1 -mx-1 rounded">
                  <input 
                    type="checkbox"
                    checked={selectedItem.autoDuck || false}
                    onChange={(e) => updateTrackItem(selectedItem.id, { autoDuck: e.target.checked })}
                    className="rounded border-white/20 bg-black/20 text-blue-500 focus:ring-blue-500"
                  />
                  Auto-duck (lower volume during video)
                </label>
              </div>
            )}
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
