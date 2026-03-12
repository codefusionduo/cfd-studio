import React, { useState, useEffect, useRef } from 'react';
import AssetLibrary from './AssetLibrary';
import Preview from './Preview';
import Timeline from './Timeline';
import PropertiesPanel from './PropertiesPanel';
import { Download, Settings, Scissors, Loader2, Type, Sparkles, Plus } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { motion, AnimatePresence } from 'motion/react';
import MobileLanding from '../MobileLanding';
import { v4 as uuidv4 } from 'uuid';

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-[#121212] flex flex-col items-center justify-center"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <motion.div
          initial={{ rotate: -180 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 1, delay: 0.2, type: "spring" }}
          className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/20"
        >
          <Scissors size={48} className="text-white" />
        </motion.div>
        
        <motion.h1 
          className="text-4xl font-bold text-white tracking-tight mb-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          cfd studio
        </motion.h1>
        
        <motion.div 
          className="h-1 w-0 bg-cyan-500 rounded-full"
          animate={{ width: 100 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        />
      </motion.div>
    </motion.div>
  );
}

export default function EditorLayout() {
  const { 
    setIsPlaying, 
    setCurrentTime, 
    duration, 
    currentTime,
    isPlaying,
    selectedItemId,
    removeTrackItem,
    canvasSize,
    setCanvasSize,
    addAsset,
    addTrackItem,
    setSelectedItem,
    clearAll
  } = useEditorStore();
  
  const [isExporting, setIsExporting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(288); // Default 72 * 4 = 288px
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      // Check if any persisted state changed
      if (
        state.tracks !== prevState.tracks ||
        state.assets !== prevState.assets ||
        state.canvasSize !== prevState.canvasSize ||
        state.duration !== prevState.duration
      ) {
        setIsSaving(true);
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          setIsSaving(false);
        }, 1000);
      }
    });
    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = timelineHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(startHeight + delta, window.innerHeight - 200));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const aspectRatios = [
    { label: '9:16 (TikTok)', width: 1080, height: 1920 },
    { label: '16:9 (YouTube)', width: 1920, height: 1080 },
    { label: '1:1 (Square)', width: 1080, height: 1080 },
    { label: '4:5 (Portrait)', width: 1080, height: 1350 },
    { label: '4:3 (Standard)', width: 1440, height: 1080 },
  ];

  const handleRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = aspectRatios.find(r => r.label === e.target.value);
    if (selected) {
      setCanvasSize({ width: selected.width, height: selected.height });
    }
  };

  const currentRatioLabel = aspectRatios.find(
    r => r.width === canvasSize.width && r.height === canvasSize.height
  )?.label || 'Custom';

  useEffect(() => {
    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < 768;
      const isUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(isUA || isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && hasStarted) {
      try {
        if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } catch (e) {}
    }
  }, [isMobile, hasStarted]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useEditorStore.temporal.getState().redo();
        } else {
          useEditorStore.temporal.getState().undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        useEditorStore.temporal.getState().redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId) {
          removeTrackItem(selectedItemId);
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, isPlaying, removeTrackItem, setIsPlaying]);

  const handleExport = async () => {
    if (isExporting) return;
    
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    setIsExporting(true);
    setIsPlaying(false);
    setCurrentTime(0);

    // Wait for seek
    await new Promise(resolve => setTimeout(resolve, 500));

    const mimeTypes = [
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    let selectedMimeType = 'video/webm';
    let extension = 'webm';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        if (type.includes('mp4')) {
          extension = 'mp4';
        }
        break;
      }
    }

    const stream = canvas.captureStream(30); // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: selectedMimeType });
      const filename = `cfd-studio-${Date.now()}.${extension}`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      setIsExporting(false);
      setCurrentTime(0);
      
      // Automatically clear the project after successful export
      if (window.confirm('Video exported successfully! Would you like to clear the project and start a new one?')) {
        useEditorStore.getState().clearAll();
        setHasStarted(false);
      }
    };

    mediaRecorder.start();
    setIsPlaying(true);

    // Stop recording when we reach the end
    // We need to check this periodically or use a timeout
    // Since we can't easily hook into the store's internal loop from here without effects,
    // we'll use a simple timeout for the duration of the video.
    // Note: This assumes real-time playback. If rendering lags, this might cut off.
    // A better way is to listen to store changes, but for MVP this is okay.
    
    setTimeout(() => {
      mediaRecorder.stop();
      setIsPlaying(false);
    }, duration * 1000 + 500); // Add buffer
  };

  const addTextLayer = () => {
    useEditorStore.getState().addTrackItem({
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAIEditClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    const addToTimelineAndSelect = (finalAsset: any) => {
      let width = 500;
      let height = 500;
      let x = 0;
      let y = 0;

      if (finalAsset.width && finalAsset.height) {
        const scale = Math.min(
          canvasSize.width / finalAsset.width,
          canvasSize.height / finalAsset.height
        );
        width = finalAsset.width * scale;
        height = finalAsset.height * scale;
        x = (canvasSize.width - width) / 2;
        y = (canvasSize.height - height) / 2;
      }

      const trackItemId = addTrackItem({
        assetId: finalAsset.id,
        start: 0,
        duration: finalAsset.duration || 5,
        offset: 0,
        layer: 1,
        type: finalAsset.type,
        x,
        y,
        width,
        height,
      });

      setSelectedItem(trackItemId);
    };

    if (type === 'video') {
       const video = document.createElement('video');
       video.src = url;
       video.onloadedmetadata = () => {
          asset.duration = video.duration;
          asset.width = video.videoWidth;
          asset.height = video.videoHeight;
          addAsset(asset);
          addToTimelineAndSelect(asset);
       };
    } else if (type === 'image') {
       const img = new Image();
       img.src = url;
       img.onload = () => {
          asset.width = img.width;
          asset.height = img.height;
          addAsset(asset);
          addToTimelineAndSelect(asset);
       };
    } else {
       addAsset(asset);
       addToTimelineAndSelect(asset);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isMobile && !hasStarted) {
    return <MobileLanding onStart={() => setHasStarted(true)} />;
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      
      {/* Portrait Mode Overlay */}
      <div className="md:hidden portrait:flex hidden fixed inset-0 z-[200] bg-[#121212] flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 mb-8 relative">
          <motion.div 
            className="absolute inset-0 border-4 border-cyan-500 rounded-2xl"
            animate={{ rotate: 90 }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Rotate your device</h2>
        <p className="text-white/60">CFD Studio requires landscape mode for the best editing experience.</p>
      </div>

      <div className="h-screen bg-[#121212] flex flex-col text-white overflow-hidden font-sans">
        {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#1e1e1e] z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight hidden sm:block">cfd studio</h1>
          
          <button 
            onClick={handleAIEditClick}
            className="ml-2 sm:ml-4 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg flex items-center gap-2 transition-colors border border-purple-500/30"
          >
            <Sparkles size={16} />
            <span className="text-sm font-medium hidden sm:block">AI Edit</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*,image/*,audio/*"
            className="hidden"
          />
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => {
              if (window.confirm('Are you sure you want to start a new project? This will delete all current assets and edits.')) {
                clearAll();
                setHasStarted(false);
              }
            }}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium hidden sm:block">New</span>
          </button>

          {isMobile && (
            <button 
              onClick={addTextLayer}
              className="px-3 py-1.5 bg-pink-500/20 hover:bg-pink-500/30 text-pink-500 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Type size={16} />
              <span className="text-sm font-medium hidden sm:block">Text</span>
            </button>
          )}

          <select
            value={currentRatioLabel}
            onChange={handleRatioChange}
            className="bg-[#252525] text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 outline-none focus:border-cyan-500 transition-colors"
          >
            {aspectRatios.map(ratio => (
              <option key={ratio.label} value={ratio.label}>
                {ratio.label}
              </option>
            ))}
          </select>

          <button className="px-4 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center gap-2">
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Draft saved'
            )}
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-black font-semibold rounded-full flex items-center gap-2 transition-colors"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {!isMobile && <AssetLibrary />}
        
        <div className="flex-1 flex flex-col min-w-0">
          <Preview />
          
          {/* Resizer */}
          <div 
            className="h-1 bg-white/10 hover:bg-cyan-500 cursor-row-resize transition-colors z-50 relative"
            onMouseDown={handleResizerMouseDown}
          >
            <div className="absolute inset-x-0 -top-1 -bottom-1" />
          </div>

          <div style={{ height: timelineHeight }} className="flex-shrink-0">
            <Timeline />
          </div>
        </div>
        
        <PropertiesPanel />
      </div>
    </div>
    </>
  );
}
