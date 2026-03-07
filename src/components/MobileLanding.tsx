import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from '../store/editorStore';
import { Upload, ArrowRight, Music } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function MobileLanding({ onStart }: { onStart: () => void }) {
  const { addAsset, assets, addTrackItem, canvasSize } = useEditorStore();

  const addToTimeline = (asset: any) => {
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
  }, [addAsset, addTrackItem, canvasSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            CFD Studio
          </h1>
          <p className="text-white/60">Import your media to get started</p>
        </div>

        <div 
          {...getRootProps()} 
          className={`w-full max-w-sm aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-colors ${
            isDragActive ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/20 bg-white/5'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <Upload size={32} className="text-white/80" />
          </div>
          <p className="text-sm font-medium text-white/80">Tap to upload media</p>
        </div>

        {assets.length > 0 && (
            <div className="w-full max-w-sm space-y-2">
                <p className="text-sm text-white/40 uppercase tracking-wider font-medium">Selected ({assets.length})</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {assets.map(asset => (
                        <div key={asset.id} className="w-16 h-16 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden border border-white/10">
                            {asset.type === 'image' && <img src={asset.src} className="w-full h-full object-cover" />}
                            {asset.type === 'video' && <video src={asset.src} className="w-full h-full object-cover" />}
                            {asset.type === 'audio' && <div className="w-full h-full flex items-center justify-center"><Music size={20} /></div>}
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <button 
        onClick={onStart}
        disabled={assets.length === 0}
        className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
      >
        Start Editing <ArrowRight size={20} />
      </button>
    </div>
  );
}
