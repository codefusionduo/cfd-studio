import React, { useState, useEffect } from 'react';
import AssetLibrary from './AssetLibrary';
import Preview from './Preview';
import Timeline from './Timeline';
import PropertiesPanel from './PropertiesPanel';
import { Download, Settings, Scissors, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { motion, AnimatePresence } from 'motion/react';
import MobileLanding from '../MobileLanding';
import LandscapePrompt from '../LandscapePrompt';

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
    setCanvasSize
  } = useEditorStore();
  
  const [isExporting, setIsExporting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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

    const stream = canvas.captureStream(30); // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cfd-studio-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
      setCurrentTime(0);
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

  if (isMobile && !hasStarted) {
    return <MobileLanding onStart={() => setHasStarted(true)} />;
  }

  return (
    <>
      {isMobile && hasStarted && <LandscapePrompt />}
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      
      <div className="h-screen bg-[#121212] flex flex-col text-white overflow-hidden font-sans">
        {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#1e1e1e] z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">cfd studio</h1>
        </div>
        
        <div className="flex items-center gap-3">
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

          <button className="px-4 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors">
            Draft saved
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
          <Timeline />
        </div>
        
        <PropertiesPanel />
      </div>
    </div>
    </>
  );
}
