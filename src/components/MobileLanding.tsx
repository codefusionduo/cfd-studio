import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from '../store/editorStore';
import { Upload, ArrowRight, Music, X, Trash2, Scissors, Sparkles, Smartphone, Monitor, Square } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function MobileLanding({ onStart }: { onStart: () => void }) {
  const { addAsset, assets, addTrackItem, canvasSize, setCanvasSize, removeAsset, clearAll } = useEditorStore();
  const [selectedRatio, setSelectedRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');

  const setRatio = (ratio: '9:16' | '16:9' | '1:1') => {
    setSelectedRatio(ratio);
    if (ratio === '9:16') {
      setCanvasSize({ width: 1080, height: 1920 });
    } else if (ratio === '16:9') {
      setCanvasSize({ width: 1920, height: 1080 });
    } else {
      setCanvasSize({ width: 1080, height: 1080 });
    }
  };

  const addToTimeline = (asset: any) => {
    let width = 500;
    let height = 500;
    let x = 0;
    let y = 0;

    if (asset.width && asset.height) {
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
  };

  const addSampleMedia = () => {
    // Add a vibrant gradient demo image/asset to get started instantly
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 1080;
    sampleCanvas.height = 1920;
    const ctx = sampleCanvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
      gradient.addColorStop(0, '#06b6d4');
      gradient.addColorStop(0.5, '#3b82f6');
      gradient.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TIMELINE X', 540, 900);
      ctx.font = '36px sans-serif';
      ctx.fillText('Mobile Video Editor', 540, 980);
    }

    const dataUrl = sampleCanvas.toDataURL('image/png');
    const asset: any = {
      id: uuidv4(),
      type: 'image',
      src: dataUrl,
      name: 'Sample Background',
      duration: 5,
      width: 1080,
      height: 1920
    };

    addAsset(asset);
    addToTimeline(asset);
  };

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
        duration: 5
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
  }, [addAsset, addTrackItem, canvasSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Scissors size={20} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Timeline X</span>
        </div>
        <span className="text-xs px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full font-medium">
          Mobile Studio
        </span>
      </div>

      {/* Main Content */}
      <div className="my-auto space-y-6 py-4">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Create Videos on Mobile
          </h1>
          <p className="text-xs text-white/60">Choose ratio, upload clips, edit on timeline</p>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block text-center">
            Project Format
          </label>
          <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => setRatio('9:16')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedRatio === '9:16'
                  ? 'border-cyan-500 bg-cyan-500/15 text-white shadow-lg shadow-cyan-500/10'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Smartphone size={20} className={selectedRatio === '9:16' ? 'text-cyan-400' : ''} />
              <span className="text-xs font-semibold">9:16</span>
              <span className="text-[10px] text-white/40">Reels/Shorts</span>
            </button>

            <button
              type="button"
              onClick={() => setRatio('16:9')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedRatio === '16:9'
                  ? 'border-cyan-500 bg-cyan-500/15 text-white shadow-lg shadow-cyan-500/10'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Monitor size={20} className={selectedRatio === '16:9' ? 'text-cyan-400' : ''} />
              <span className="text-xs font-semibold">16:9</span>
              <span className="text-[10px] text-white/40">Landscape</span>
            </button>

            <button
              type="button"
              onClick={() => setRatio('1:1')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedRatio === '1:1'
                  ? 'border-cyan-500 bg-cyan-500/15 text-white shadow-lg shadow-cyan-500/10'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Square size={20} className={selectedRatio === '1:1' ? 'text-cyan-400' : ''} />
              <span className="text-xs font-semibold">1:1</span>
              <span className="text-[10px] text-white/40">Square</span>
            </button>
          </div>
        </div>

        {/* Media Dropzone */}
        <div 
          {...getRootProps()} 
          className={`w-full max-w-sm mx-auto p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
            isDragActive ? 'border-cyan-500 bg-cyan-500/15 scale-[1.02]' : 'border-white/15 bg-white/5 hover:border-white/30'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Upload size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Tap to add Videos or Photos</p>
            <p className="text-[11px] text-white/40 mt-0.5">Supports MP4, MOV, WebM, PNG, JPG</p>
          </div>
        </div>

        {/* Selected Media Chips or Quick Sample */}
        {assets.length > 0 ? (
          <div className="w-full max-w-sm mx-auto space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Loaded Media ({assets.length})</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-medium"
              >
                <Trash2 size={12} /> Clear
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {assets.map(asset => (
                <div key={asset.id} className="relative w-16 h-16 rounded-xl bg-white/10 flex-shrink-0 overflow-hidden border border-white/10">
                  {asset.type === 'image' && <img src={asset.src} className="w-full h-full object-cover" />}
                  {asset.type === 'video' && <video src={asset.src} className="w-full h-full object-cover" />}
                  {asset.type === 'audio' && <div className="w-full h-full flex items-center justify-center"><Music size={20} /></div>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAsset(asset.id);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <button
              type="button"
              onClick={addSampleMedia}
              className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1.5 py-1.5 px-3 bg-cyan-500/10 rounded-full border border-cyan-500/20 font-medium transition-colors"
            >
              <Sparkles size={14} /> Don't have media? Load sample background
            </button>
          </div>
        )}
      </div>

      {/* Start Button */}
      <div className="space-y-2 pb-2 max-w-sm mx-auto w-full">
        <button 
          onClick={onStart}
          className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-base text-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all"
        >
          Open Mobile Editor <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

