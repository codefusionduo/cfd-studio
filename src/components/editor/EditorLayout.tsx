import React, { useState, useEffect, useRef } from 'react';
import AssetLibrary from './AssetLibrary';
import Preview from './Preview';
import VideoPreview from './VideoPreview';
import Timeline from './Timeline';
import PropertiesPanel from './PropertiesPanel';
import ExportModal from './ExportModal';
import { Download, Settings, Scissors, Loader2, Type, Sparkles, Plus, X, Film, FolderPlus, Sliders } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { exportToMP4 } from '../../utils/exportVideo';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
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
          Timeline X
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
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [mobileTab, setMobileTab] = useState<'timeline' | 'media' | 'inspector'>('timeline');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, message: string, onConfirm: () => void } | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight < 500 ? 140 : 288;
    }
    return 288;
  });
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewRef = useRef<any>(null);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const headerInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPropertiesVisible, setIsPropertiesVisible] = useState(true);
  const propertiesInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetHeaderTimeout = () => {
    setIsHeaderVisible(true);
    if (headerInteractionTimeoutRef.current) {
      clearTimeout(headerInteractionTimeoutRef.current);
    }
    headerInteractionTimeoutRef.current = setTimeout(() => {
      setIsHeaderVisible(false);
    }, 5000);
  };

  const resetPropertiesTimeout = () => {
    setIsPropertiesVisible(true);
    if (propertiesInteractionTimeoutRef.current) {
      clearTimeout(propertiesInteractionTimeoutRef.current);
    }
    propertiesInteractionTimeoutRef.current = setTimeout(() => {
      setIsPropertiesVisible(false);
    }, 5000);
  };

  useEffect(() => {
    resetHeaderTimeout();
    resetPropertiesTimeout();
    return () => {
      if (headerInteractionTimeoutRef.current) {
        clearTimeout(headerInteractionTimeoutRef.current);
      }
      if (propertiesInteractionTimeoutRef.current) {
        clearTimeout(propertiesInteractionTimeoutRef.current);
      }
    };
  }, []);

  // Load saved state on initialization
  useEffect(() => {
    const savedState = localStorage.getItem('editor-auto-save');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        useEditorStore.getState().loadState(parsed);
        if (parsed.tracks && parsed.tracks.length > 0) {
          setHasStarted(true);
        }
      } catch (e) {
        console.error('Failed to load auto-save', e);
      }
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    const saveState = () => {
      const state = useEditorStore.getState();
      const stateToSave = {
        assets: state.assets,
        tracks: state.tracks,
        canvasSize: state.canvasSize,
        duration: state.duration,
      };
      localStorage.setItem('editor-auto-save', JSON.stringify(stateToSave));
      setIsSaving(false);
    };

    // Save every 60 seconds
    const interval = setInterval(() => {
      setIsSaving(true);
      saveState();
    }, 60000);

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
          saveState();
        }, 1000); // Save after significant changes (debounced)
      }
    });

    return () => {
      clearInterval(interval);
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
      const newHeight = Math.max(100, Math.min(startHeight + delta, window.innerHeight - 100));
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
    if (selectedItemId && isMobile) {
      setMobileTab('inspector');
    }
  }, [selectedItemId, isMobile]);

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
        if (!isPlaying) {
          const state = useEditorStore.getState();
          const contentDuration = state.tracks.length > 0 
            ? Math.max(...state.tracks.map(t => t.start + t.duration)) 
            : state.duration;
          const stopTime = contentDuration > 0 ? contentDuration : state.duration;
          if (state.currentTime >= stopTime) {
            setCurrentTime(0);
          }
        }
        setIsPlaying(!isPlaying);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, isPlaying, removeTrackItem, setIsPlaying]);

  const handleExport = async (options?: any) => {
    if (isExporting) return;
    
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Setting up render queue...');

    const finalOptions = options || {
      name: 'timeline-x-video',
      resolution: '1080P',
      frameRate: '30fps',
    };

    try {
      const blob = await exportToMP4(finalOptions, (progress, statusText) => {
        setExportProgress(progress);
        setExportStatus(statusText);
      });

      // Download the MP4 file
      const filename = `${finalOptions.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'video'}_${Date.now()}.mp4`;
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
      }, 150);

      setExportProgress(100);
      setExportStatus('MP4 Video Compiled!');

      // Short delay for visual closure
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsExporting(false);

      // Offer to clear project
      setConfirmModal({
        isOpen: true,
        message: 'Your MP4 video has been successfully encoded and downloaded! Would you like to clear the current timeline and start a new project?',
        onConfirm: () => {
          useEditorStore.getState().clearAll();
          setHasStarted(false);
          setConfirmModal(null);
        }
      });
    } catch (err: any) {
      console.error(err);
      setIsExporting(false);
      setConfirmModal({
        isOpen: true,
        message: `Export failed: ${err.message || 'An unknown error occurred during rendering.'} Please make sure the video is fully loaded.`,
        onConfirm: () => {
          setConfirmModal(null);
        }
      });
    }
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

      <div 
        className="h-screen bg-[#121212] flex flex-col text-white overflow-hidden font-sans relative"
        onMouseMove={(e) => {
          if (e.clientY < 80) resetHeaderTimeout();
          if (e.clientX > window.innerWidth - 80) resetPropertiesTimeout();
        }}
        onTouchMove={(e) => {
          if (e.touches[0].clientY < 80) resetHeaderTimeout();
          if (e.touches[0].clientX > window.innerWidth - 80) resetPropertiesTimeout();
        }}
      >
        {/* Interaction hit area for cursor near top */}
        <div 
          className="absolute top-0 left-0 right-0 h-16 z-[60]"
          style={{ pointerEvents: isHeaderVisible ? 'none' : 'auto' }}
          onMouseEnter={resetHeaderTimeout}
          onTouchStart={resetHeaderTimeout}
        />

        {/* Global pull-down handle (visible when header is hidden) */}
        {!isHeaderVisible && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 flex items-center justify-center cursor-pointer group z-[65] opacity-50 hover:opacity-100 transition-opacity"
               onMouseEnter={resetHeaderTimeout}
               onTouchStart={resetHeaderTimeout}>
            <div className="w-8 h-1 bg-white/50 rounded-full" />
          </div>
        )}

        {/* Header */}
        <header 
          className={clsx(
            "border-b border-white/10 flex items-center justify-between px-3 bg-[#1e1e1e] z-50 transition-all duration-500 ease-in-out shrink-0 relative",
            isHeaderVisible ? "translate-y-0 h-11 opacity-100" : "-translate-y-full h-0 opacity-0 overflow-hidden border-transparent"
          )}
          onMouseEnter={resetHeaderTimeout}
        >
          {isHeaderVisible && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-14 h-2.5 flex items-center justify-center cursor-pointer group hover:bg-black/20 rounded-b-xl z-[60] bg-[#1e1e1e] border-x border-b border-white/10"
                 onMouseEnter={resetHeaderTimeout}
                 onTouchStart={resetHeaderTimeout}>
              <div className="w-6 h-1 bg-white/20 group-hover:bg-white/50 rounded-full" />
            </div>
          )}

          <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-md flex items-center justify-center">
            <Scissors size={15} className="text-white" />
          </div>
          <h1 className="font-bold text-sm tracking-tight hidden sm:block">Timeline X</h1>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*,image/*,audio/*"
            className="hidden"
          />
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                message: 'Are you sure you want to start a new project? This will delete all current assets and edits.',
                onConfirm: () => {
                  clearAll();
                  setHasStarted(false);
                  setConfirmModal(null);
                }
              });
            }}
            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded-md flex items-center gap-1.5 transition-colors text-xs"
          >
            <Plus size={14} />
            <span className="font-medium hidden sm:block">New</span>
          </button>

          {isMobile && (
            <button 
              onClick={addTextLayer}
              className="px-2.5 py-1 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded-md flex items-center gap-1.5 transition-colors text-xs"
            >
              <Type size={14} />
              <span className="font-medium hidden sm:block">Text</span>
            </button>
          )}

          <select
            value={currentRatioLabel}
            onChange={handleRatioChange}
            className="bg-[#252525] text-white text-[11px] px-2 py-1 rounded-md border border-white/10 outline-none focus:border-cyan-500 transition-colors"
          >
            {aspectRatios.map(ratio => (
              <option key={ratio.label} value={ratio.label}>
                {ratio.label}
              </option>
            ))}
          </select>

          <button className="px-2 py-1 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center gap-1 hidden md:flex">
            {isSaving ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Draft saved'
            )}
          </button>
          <button 
            onClick={() => setShowExportModal(true)}
            disabled={isExporting}
            className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-black font-semibold text-xs rounded-full flex items-center gap-1.5 transition-colors"
          >
            {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </header>

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)}
        onExport={(options) => {
          setShowExportModal(false);
          handleExport(options);
        }}
        duration={useEditorStore.getState().tracks.length > 0 ? Math.max(...useEditorStore.getState().tracks.map(t => t.start + t.duration)) : useEditorStore.getState().duration}
        sizeEstimate="about 7 MB"
      />

      {/* Exporting Progress Dialog */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#18181b] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center"
            >
              <div className="relative w-16 h-16 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
                <div 
                  className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" 
                  style={{ animationDuration: '1.2s' }}
                />
                <Download className="text-cyan-400" size={24} />
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-2">Compiling MP4 Video</h3>
              <p className="text-white/60 text-xs mb-6 max-w-xs leading-relaxed">
                Please keep this window active. We are rendering every timeline track, transition effect, and text layer frame-by-frame for maximum export quality.
              </p>
              
              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-2 mb-3 overflow-hidden relative border border-white/5">
                <motion.div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full"
                  animate={{ width: `${exportProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              
              <div className="flex justify-between w-full text-[10px] text-white/50 mb-1">
                <span>Rendering Progress</span>
                <span className="font-semibold text-cyan-400">{exportProgress}%</span>
              </div>
              
              <div className="text-xs font-medium text-white/80 h-6 overflow-hidden text-ellipsis w-full whitespace-nowrap mt-2 bg-white/5 py-1 px-3 rounded">
                {exportStatus}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace */}
      {/* Desktop View (md breakpoint and up) */}
      <div className="hidden md:flex flex-1 overflow-hidden relative">
        <AssetLibrary />
        
        <div className="flex-1 flex flex-col min-w-0">
          <Preview ref={previewRef} />
          <VideoPreview />
          
          {/* Resizer */}
          <div 
            className="h-2 bg-white/5 hover:bg-cyan-500 cursor-row-resize transition-colors z-50 relative flex items-center justify-center"
            onMouseDown={handleResizerMouseDown}
          >
            <div className="w-8 h-1 bg-white/20 rounded-full" />
            <div className="absolute inset-x-0 -top-2 -bottom-2" />
          </div>

          <div style={{ height: timelineHeight }} className="flex-shrink-0">
            <Timeline />
          </div>
        </div>
        
        <div 
          className={clsx(
            "transition-all duration-500 ease-in-out shrink-0 relative flex z-40",
            isPropertiesVisible ? "w-64 md:w-72" : "w-0"
          )}
          onMouseEnter={resetPropertiesTimeout}
        >
          {!isPropertiesVisible && (
            <div 
              className="absolute top-0 bottom-0 -left-6 w-6 z-[60] cursor-pointer"
              onMouseEnter={resetPropertiesTimeout}
            />
          )}

          <div 
            className={clsx(
              "absolute top-0 left-0 h-full flex transition-transform duration-500 ease-in-out",
              isPropertiesVisible ? "translate-x-0" : "translate-x-full"
            )}
          >
            {isPropertiesVisible && (
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-3 h-16 flex items-center justify-center cursor-pointer group hover:bg-black/20 rounded-l-xl z-[60] bg-[#1e1e1e] border-y border-l border-white/10"
                   onMouseEnter={resetPropertiesTimeout}>
                <div className="h-8 w-1 bg-white/20 group-hover:bg-white/50 rounded-full transition-colors" />
              </div>
            )}
            
            <div className="w-64 md:w-72 h-full shadow-2xl">
              <PropertiesPanel />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View (< md breakpoint) */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden relative">
        {/* Top Section: Canvas Preview */}
        <div className="h-[38vh] min-h-[200px] max-h-[360px] bg-[#0d0d0f] relative flex items-center justify-center border-b border-white/10 shrink-0 overflow-hidden">
          <Preview ref={previewRef} />
        </div>

        {/* Mobile Navigation / Tab Selector */}
        <div className="bg-[#18181b] border-b border-white/10 px-2 py-1.5 flex items-center justify-around shrink-0 z-20">
          <button
            onClick={() => setMobileTab('timeline')}
            className={clsx(
              "flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all",
              mobileTab === 'timeline'
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}
          >
            <Film size={15} />
            <span>Timeline</span>
          </button>

          <button
            onClick={() => setMobileTab('media')}
            className={clsx(
              "flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all",
              mobileTab === 'media'
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}
          >
            <FolderPlus size={15} />
            <span>Media & FX</span>
          </button>

          <button
            onClick={() => setMobileTab('inspector')}
            className={clsx(
              "flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all relative",
              mobileTab === 'inspector'
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}
          >
            <Sliders size={15} />
            <span>Inspector</span>
            {selectedItemId && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse absolute top-1.5 right-2" />
            )}
          </button>
        </div>

        {/* Bottom Section: Tab Content */}
        <div className="flex-1 min-h-0 bg-[#141416] overflow-y-auto relative">
          {mobileTab === 'timeline' && (
            <div className="h-full">
              <Timeline />
            </div>
          )}

          {mobileTab === 'media' && (
            <div className="h-full">
              <AssetLibrary />
            </div>
          )}

          {mobileTab === 'inspector' && (
            <div className="h-full">
              <PropertiesPanel />
            </div>
          )}
        </div>
      </div>
    </div>
      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal !== null && confirmModal.isOpen && (
          <motion.div
            key="confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-white mb-2">Confirm Action</h3>
              <p className="text-white/70 mb-6 text-sm">{confirmModal.message}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-sm font-medium transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
