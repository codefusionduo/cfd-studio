import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from '../../store/editorStore';
import { Upload, Image as ImageIcon, Video, Music, Type, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function AssetLibrary() {
  const { addAsset, assets, addTrackItem, canvasSize } = useEditorStore();

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

  const addTextLayer = () => {
    addTrackItem({
      assetId: 'text-asset',
      start: 0,
      duration: 5,
      offset: 0,
      layer: 2,
      type: 'text',
      text: 'New Text',
      fontSize: 48,
      fontFill: '#ffffff',
      x: 100,
      y: 100
    });
  };

  return (
    <div className="w-72 bg-[#1e1e1e] border-r border-white/10 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white mb-4">Assets</h2>
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:border-white/20'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-6 h-6 text-white/50 mx-auto mb-2" />
          <p className="text-xs text-white/50">Drop files here or click to upload</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Actions */}
        <button 
          onClick={addTextLayer}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
        >
          <div className="w-8 h-8 rounded bg-pink-500/20 flex items-center justify-center text-pink-500">
            <Type size={16} />
          </div>
          <span className="text-sm font-medium">Add Text</span>
        </button>

        <div className="space-y-2">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Media</h3>
          {assets.map(asset => (
            <div 
              key={asset.id}
              className="group relative flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
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
    </div>
  );
}
