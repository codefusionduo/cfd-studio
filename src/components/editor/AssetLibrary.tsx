import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from '../../store/editorStore';
import { Upload, Image as ImageIcon, Video, Music, Type, Trash2, Zap, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const TRANSITIONS = [
  { id: 'fade', name: 'Fade', icon: '🌫️' },
  { id: 'slide-left', name: 'Slide Left', icon: '⬅️' },
  { id: 'slide-right', name: 'Slide Right', icon: '➡️' },
  { id: 'slide-up', name: 'Slide Up', icon: '⬆️' },
  { id: 'slide-down', name: 'Slide Down', icon: '⬇️' },
  { id: 'zoom-in', name: 'Zoom In', icon: '🔍' },
  { id: 'zoom-out', name: 'Zoom Out', icon: '🔎' },
  { id: 'spin', name: 'Spin', icon: '🌀' },
  { id: 'flip-x', name: 'Flip X', icon: '↔️' },
  { id: 'flip-y', name: 'Flip Y', icon: '↕️' },
  { id: 'drop', name: 'Drop', icon: '☄️' },
  { id: 'elastic', name: 'Elastic', icon: '〰️' },
  { id: 'rotate', name: 'Rotate', icon: '🔄' },
  { id: 'slide-rotate', name: 'Slide Rotate', icon: '🤸' },
  { id: 'zoom-spin', name: 'Zoom Spin', icon: '🌪️' },
  { id: 'glitch', name: 'Glitch Jitter', icon: '👾' },
  { id: 'bounce', name: 'Bounce Ease', icon: '🏀' },
  { id: 'swing', name: 'Pendulum Swing', icon: '🎪' },
  { id: 'heartbeat', name: 'Heartbeat', icon: '💓' },
  { id: 'shutter', name: 'Camera Shutter', icon: '📸' },
  { id: 'diagonal-slide', name: 'Diagonal Slide', icon: '↙️' },
  { id: 'wave-warp', name: 'Wave Warp', icon: '🌊' },
  { id: 'kaleidoscope', name: 'Kaleidoscope', icon: '🌀' },
  { id: 'pixel-dissolve', name: 'Pixel Dissolve', icon: '🧱' },
  { id: 'blur-fade', name: 'Blur Fade', icon: '💨' },
];

const EFFECTS = [
  { id: 'grayscale', name: 'Grayscale', icon: '⚪' },
  { id: 'sepia', name: 'Sepia', icon: '📜' },
  { id: 'blur', name: 'Blur', icon: '🌫️' },
  { id: 'invert', name: 'Invert', icon: '🌓' },
  { id: 'hue-rotate', name: 'Hue Rotate', icon: '🌈' },
  { id: 'pixelate', name: 'Pixelate', icon: '👾' },
  { id: 'noise', name: 'Noise', icon: '📺' },
  { id: 'vignette', name: 'Vignette', icon: '🖼️' },
  { id: 'edge-detection', name: 'Edges', icon: '📐' },
  { id: 'emboss', name: 'Emboss', icon: '🗿' },
  { id: 'sharpen', name: 'Sharpen', icon: '🔪' },
  { id: 'posterize', name: 'Posterize', icon: '🎨' },
  { id: 'solarize', name: 'Solarize', icon: '☀️' },
  { id: 'chroma-key', name: 'Green Screen', icon: '🟩' },
  { id: 'scanlines', name: 'CRT Scanlines', icon: '📺' },
  { id: 'duotone', name: 'Duotone Violet', icon: '💜' },
  { id: 'dreamy', name: 'Dreamy Glow', icon: '☁️' },
  { id: 'halftone', name: 'Comic Halftone', icon: '🦓' },
  { id: 'rgb-split', name: 'RGB Split', icon: '🕶️' },
  { id: 'night-vision', name: 'Night Vision', icon: '💚' },
  { id: 'thermal', name: 'Thermal Map', icon: '🔥' },
  { id: 'old-movie', name: 'Old Movie Scratches', icon: '🎥' },
  { id: 'ascii', name: 'ASCII Art', icon: '🔡' },
  { id: 'glitch-static', name: 'VHS Static', icon: '🎚️' },
  { id: 'oil-paint', name: 'Oil Painting', icon: '🖌️' },
  { id: 'vaporwave', name: 'Vaporwave Neon', icon: '🌆' },
  { id: 'mirror-horizontal', name: 'Horizontal Mirror', icon: '🪞' },
  { id: 'edge-glow', name: 'Glow Outline', icon: '✨' },
];

export default function AssetLibrary() {
  const { addAsset, assets, addTrackItem, canvasSize, currentTime } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'media' | 'text' | 'transitions' | 'effects'>('media');
  const [textInput, setTextInput] = useState('New Text Overlay');
  const [fontSizeInput, setFontSizeInput] = useState(36);
  const [fontColorInput, setFontColorInput] = useState('#ffffff');
  const [durationInput, setDurationInput] = useState(5);

  const addToTimeline = useCallback((asset: any) => {
    let width = 500;
    let height = 500;
    let x = 0;
    let y = 0;

    if (asset.width && asset.height) {
      // Calculate scale to fit (contain)
      const scale = Math.min(
        canvasSize.width / asset.width,
        canvasSize.height / asset.height
      );
      width = asset.width * scale;
      height = asset.height * scale;
      x = (canvasSize.width - width) / 2;
      y = (canvasSize.height - height) / 2;
    }

    addTrackItem({
      assetId: asset.id,
      start: 0,
      duration: asset.duration || 5,
      offset: 0,
      layer: 1,
      type: asset.type,
      x,
      y,
      width,
      height,
    });
  }, [addTrackItem, canvasSize]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video') ? 'video' : 
                   file.type.startsWith('image') ? 'image' : 'audio';
      
      const asset: any = {
        id: uuidv4(),
        type: type as 'video' | 'image' | 'audio',
        src: url,
        name: file.name,
        duration: 5 // Placeholder
      };

      if (type === 'video') {
         const video = document.createElement('video');
         video.src = url;
         video.onloadedmetadata = () => {
            asset.duration = video.duration;
            asset.width = video.videoWidth;
            asset.height = video.videoHeight;
            addAsset(asset);
            addToTimeline(asset);
         };
      } else if (type === 'image') {
         const img = new Image();
         img.src = url;
         img.onload = () => {
            asset.width = img.width;
            asset.height = img.height;
            addAsset(asset);
            addToTimeline(asset);
         };
      } else {
         addAsset(asset);
         addToTimeline(asset);
      }
    });
  }, [addAsset, addToTimeline]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const addTextLayerWithPreset = (presetOverrides: Partial<any> = {}) => {
    const currentTracks = useEditorStore.getState().tracks;
    const maxLayer = currentTracks.reduce((max, track) => Math.max(max, track.layer || 0), 0);
    const newLayer = maxLayer + 10;

    const content = presetOverrides.text || textInput.trim() || 'New Text Overlay';
    const size = presetOverrides.fontSize || fontSizeInput || 36;
    const textWidthEstimate = content.length * (size * 0.5);
    const x = Math.max(20, (canvasSize.width - textWidthEstimate) / 2);
    const y = Math.max(20, (canvasSize.height - size) / 2);

    addTrackItem({
      assetId: 'text-asset',
      start: currentTime || 0,
      duration: durationInput || 5,
      offset: 0,
      layer: newLayer,
      type: 'text',
      text: content,
      fontSize: size,
      fontFill: presetOverrides.fontFill || fontColorInput,
      fontFamily: presetOverrides.fontFamily || 'sans-serif',
      fontWeight: presetOverrides.fontWeight || 'bold',
      fontStyle: presetOverrides.fontStyle || 'normal',
      textAlign: presetOverrides.textAlign || 'center',
      textTransform: presetOverrides.textTransform || 'none',
      backgroundColor: presetOverrides.backgroundColor,
      backgroundPadding: presetOverrides.backgroundPadding,
      borderRadius: presetOverrides.borderRadius,
      strokeColor: presetOverrides.strokeColor,
      strokeWidth: presetOverrides.strokeWidth,
      shadowColor: presetOverrides.shadowColor,
      shadowBlur: presetOverrides.shadowBlur,
      textAnimation: presetOverrides.textAnimation || 'fade',
      x,
      y
    });
  };

  return (
    <div className="w-full md:w-72 h-full bg-[#1e1e1e] border-r border-white/10 flex flex-col">
      <div className="flex border-b border-white/10 text-xs font-medium">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-2.5 text-center transition-colors ${
            activeTab === 'media' ? 'text-white border-b-2 border-blue-500 font-semibold' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Media
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-2.5 text-center transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'text' ? 'text-pink-400 border-b-2 border-pink-500 font-semibold' : 'text-white/50 hover:text-white/80'
          }`}
        >
          <Type size={12} />
          <span>Text</span>
        </button>
        <button
          onClick={() => setActiveTab('transitions')}
          className={`flex-1 py-2.5 text-center transition-colors ${
            activeTab === 'transitions' ? 'text-white border-b-2 border-blue-500 font-semibold' : 'text-white/50 hover:text-white/80'
          }`}
        >
          FX
        </button>
        <button
          onClick={() => setActiveTab('effects')}
          className={`flex-1 py-2.5 text-center transition-colors ${
            activeTab === 'effects' ? 'text-white border-b-2 border-blue-500 font-semibold' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Filters
        </button>
      </div>

      {activeTab === 'media' ? (
        <>
          <div className="p-4 border-b border-white/10">
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-5 h-5 text-white/50 mx-auto mb-1.5" />
              <p className="text-xs text-white/50">Drop video/audio/images or click</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Quick Text Button */}
            <button
              onClick={() => setActiveTab('text')}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 border border-pink-500/30 rounded-lg flex items-center justify-between text-xs text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-pink-500 flex items-center justify-center text-white">
                  <Type size={13} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Insert Text Overlay</p>
                  <p className="text-[10px] text-white/50">Add titles, captions & lower thirds</p>
                </div>
              </div>
              <Plus size={14} className="text-pink-400" />
            </button>

            <div className="space-y-2">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Media Assets</h3>
              {assets.map(asset => (
                <div 
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'media',
                      value: asset
                    }));
                  }}
                  className="group relative flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer cursor-grab active:cursor-grabbing"
                  onClick={() => addToTimeline(asset)}
                >
                  <div className="w-12 h-12 rounded bg-black/50 overflow-hidden flex-shrink-0">
                    {asset.type === 'video' && <video src={asset.src} className="w-full h-full object-cover" />}
                    {asset.type === 'image' && <img src={asset.src} className="w-full h-full object-cover" />}
                    {asset.type === 'audio' && <div className="w-full h-full flex items-center justify-center"><Music size={16} className="text-white/50" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{asset.name}</p>
                    <p className="text-xs text-white/40">{asset.type} • {Math.round(asset.duration || 0)}s</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 absolute right-2 flex items-center gap-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        addToTimeline(asset);
                      }}
                      className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors"
                      title="Add to Timeline"
                    >
                       <span className="text-xs font-bold flex items-center justify-center w-3 h-3">+</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        useEditorStore.getState().removeAsset(asset.id);
                      }}
                      className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full transition-colors"
                      title="Delete Asset"
                    >
                       <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              
              {assets.length === 0 && (
                <div className="text-center py-8 text-white/20 text-xs">
                  No media imported yet
                </div>
              )}
            </div>
          </div>
        </>
      ) : activeTab === 'text' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Custom Text Builder */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-white pb-1 border-b border-white/5">
              <div className="w-6 h-6 rounded bg-pink-500/20 flex items-center justify-center text-pink-400">
                <Type size={14} />
              </div>
              <span className="text-xs font-semibold tracking-wider uppercase text-white/80">Add Custom Text</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Text Content</label>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter text..."
                className="w-full bg-black/40 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Font Size (px)</label>
                <input
                  type="number"
                  value={fontSizeInput}
                  onChange={(e) => setFontSizeInput(Math.max(8, parseInt(e.target.value) || 24))}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Duration (s)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={durationInput}
                  onChange={(e) => setDurationInput(Math.max(0.5, parseFloat(e.target.value) || 3))}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Font Color</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="color"
                  value={fontColorInput}
                  onChange={(e) => setFontColorInput(e.target.value)}
                  className="w-8 h-[29px] bg-transparent border-0 cursor-pointer outline-none rounded p-0 overflow-hidden"
                />
                <input
                  type="text"
                  value={fontColorInput}
                  onChange={(e) => setFontColorInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => addTextLayerWithPreset()}
              disabled={!textInput.trim()}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              <span>Insert Text at {currentTime.toFixed(1)}s</span>
            </button>
          </div>

          {/* Text Presets */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Text Overlay Presets</h3>
            <div className="grid grid-cols-1 gap-2">
              {/* Caption Box Preset */}
              <button
                type="button"
                onClick={() => addTextLayerWithPreset({
                  text: textInput.trim() || 'Caption Subtitle Text',
                  fontSize: 28,
                  fontFill: '#ffffff',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  backgroundPadding: 10,
                  borderRadius: 6,
                  fontWeight: 'bold',
                  textAnimation: 'fade',
                })}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="inline-block px-2 py-0.5 bg-black/80 rounded text-xs font-bold text-white mb-1">
                    CC Subtitle Badge
                  </div>
                  <p className="text-[10px] text-white/40">Clean closed-caption box style</p>
                </div>
                <Plus size={16} className="text-white/40 group-hover:text-white transition-colors" />
              </button>

              {/* Neon Glow Preset */}
              <button
                type="button"
                onClick={() => addTextLayerWithPreset({
                  text: textInput.trim() || 'NEON TITLE',
                  fontSize: 42,
                  fontFill: '#22d3ee',
                  shadowColor: '#22d3ee',
                  shadowBlur: 20,
                  fontWeight: 'bold',
                  strokeColor: '#0891b2',
                  strokeWidth: 1,
                  textAnimation: 'bounce',
                })}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
              >
                <div>
                  <p className="text-sm font-bold text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] tracking-wide">
                    ⚡ NEON GLOW
                  </p>
                  <p className="text-[10px] text-white/40">Electric cyan glow effect</p>
                </div>
                <Plus size={16} className="text-white/40 group-hover:text-white transition-colors" />
              </button>

              {/* Reels Yellow Stroke */}
              <button
                type="button"
                onClick={() => addTextLayerWithPreset({
                  text: textInput.trim() || 'VIRAL REELS HIGHLIGHT',
                  fontSize: 38,
                  fontFill: '#facc15',
                  strokeColor: '#000000',
                  strokeWidth: 4,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAnimation: 'pop',
                })}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
              >
                <div>
                  <p className="text-sm font-extrabold text-yellow-400 tracking-tight" style={{ WebkitTextStroke: '1px black' }}>
                    🔥 REELS BOLD
                  </p>
                  <p className="text-[10px] text-white/40">Yellow highlight with thick stroke</p>
                </div>
                <Plus size={16} className="text-white/40 group-hover:text-white transition-colors" />
              </button>

              {/* Serif Gold */}
              <button
                type="button"
                onClick={() => addTextLayerWithPreset({
                  text: textInput.trim() || 'Elegant Cinematic Title',
                  fontSize: 36,
                  fontFill: '#fef08a',
                  fontFamily: 'Playfair Display, serif',
                  fontStyle: 'italic',
                  textAnimation: 'fade',
                })}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
              >
                <div>
                  <p className="text-sm font-serif italic text-yellow-200">
                    Cinematic Elegance
                  </p>
                  <p className="text-[10px] text-white/40">Soft gold serif editorial title</p>
                </div>
                <Plus size={16} className="text-white/40 group-hover:text-white transition-colors" />
              </button>

              {/* Minimalist Spaced */}
              <button
                type="button"
                onClick={() => addTextLayerWithPreset({
                  text: textInput.trim() || 'MODERN MINIMAL',
                  fontSize: 32,
                  fontFill: '#ffffff',
                  fontWeight: '300',
                  textTransform: 'uppercase',
                  textAnimation: 'slide',
                })}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
              >
                <div>
                  <p className="text-xs tracking-[0.3em] uppercase text-white font-light">
                    M I N I M A L
                  </p>
                  <p className="text-[10px] text-white/40">Spaced modern typography</p>
                </div>
                <Plus size={16} className="text-white/40 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'transitions' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="text-xs text-white/50 mb-4">Drag a transition and drop it onto a clip in the timeline.</p>
          <div className="grid grid-cols-2 gap-2">
            {TRANSITIONS.map(transition => (
              <div
                key={transition.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'transition',
                    source: 'library',
                    value: transition.id,
                    duration: 0.5
                  }));
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-2 cursor-grab active:cursor-grabbing transition-colors"
                title="Drag to timeline"
              >
                <span className="text-2xl">{transition.icon}</span>
                <span className="text-xs text-white/80 text-center">{transition.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="text-xs text-white/50 mb-4">Drag an effect and drop it onto a clip in the timeline.</p>
          <div className="grid grid-cols-2 gap-2">
            {EFFECTS.map(effect => (
              <div
                key={effect.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'effect',
                    value: effect.id
                  }));
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-2 cursor-grab active:cursor-grabbing transition-colors"
                title="Drag to timeline"
              >
                <span className="text-2xl">{effect.icon}</span>
                <span className="text-xs text-white/80 text-center">{effect.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
