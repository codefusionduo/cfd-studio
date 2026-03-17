import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FolderOpen, Video, Music, FileImage } from 'lucide-react';
import Preview from './Preview';
import { useEditorStore } from '../../store/editorStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: any) => void;
  duration: number;
  sizeEstimate: string;
}

export default function ExportModal({ isOpen, onClose, onExport, duration, sizeEstimate }: ExportModalProps) {
  const [options, setOptions] = useState({
    name: 'Untitled',
    exportTo: 'C:/Users/Downloads',
    video: true,
    resolution: '1080P',
    bitRate: 'Recommended',
    codec: 'H.264',
    format: 'mp4',
    frameRate: '30fps',
    audio: false,
    audioFormat: 'MP3',
    exportGif: false,
  });

  const canvasSize = useMemo(() => {
    const currentStore = useEditorStore.getState();
    const aspectRatio = currentStore.canvasSize.width / currentStore.canvasSize.height;
    
    if (options.resolution === '4K') {
      return { width: 3840, height: Math.round(3840 / aspectRatio) };
    }
    // Default 1080P
    return { width: 1920, height: Math.round(1920 / aspectRatio) };
  }, [options.resolution]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Export</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white"><X size={20} /></button>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Preview */}
            <div className="w-1/3 p-6 border-r border-white/10 flex flex-col items-center justify-center bg-black/20">
              <div className="w-full aspect-[9/16] bg-black rounded-lg mb-4 overflow-hidden relative">
                <Preview canvasSize={canvasSize} />
              </div>
              <button className="text-sm text-cyan-400 hover:text-cyan-300">Edit cover</button>
            </div>

            {/* Form */}
            <div className="w-2/3 p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-white/50 mb-1">Name</label>
                  <input type="text" value={options.name} onChange={e => setOptions({...options, name: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-white/50 mb-1">Export to</label>
                  <div className="flex gap-2">
                    <input type="text" value={options.exportTo} readOnly className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                    <button className="bg-white/10 p-2 rounded"><FolderOpen size={16} /></button>
                  </div>
                </div>
              </div>

              {/* Video Options */}
              <div className="border border-white/10 rounded-lg p-4">
                <label className="flex items-center gap-2 text-white font-medium mb-4">
                  <input type="checkbox" checked={options.video} onChange={e => setOptions({...options, video: e.target.checked})} />
                  <Video size={16} /> Video
                </label>
                {options.video && (
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs text-white/50 mb-1">Resolution</label>
                      <select 
                        value={options.resolution}
                        onChange={e => setOptions({...options, resolution: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white"
                      >
                        <option value="1080P">1080P</option>
                        <option value="4K">4K</option>
                      </select>
                    </div>
                    <div><label className="block text-xs text-white/50 mb-1">Bit rate</label><select className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white"><option>Recommended</option></select></div>
                    <div><label className="block text-xs text-white/50 mb-1">Codec</label><select className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white"><option>H.264</option></select></div>
                    <div><label className="block text-xs text-white/50 mb-1">Format</label><select className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white"><option>mp4</option></select></div>
                    <div><label className="block text-xs text-white/50 mb-1">Frame rate</label>
                      <select 
                        value={options.frameRate}
                        onChange={e => setOptions({...options, frameRate: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white"
                      >
                        <option value="24fps">24fps</option>
                        <option value="30fps">30fps</option>
                        <option value="60fps">60fps</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-white/50">Duration: {duration}s | Size: {sizeEstimate}</div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10">Cancel</button>
              <button onClick={() => onExport(options)} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-sm font-medium">Export</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
