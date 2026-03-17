import React, { useEffect, useRef, useState, useMemo } from 'react';

interface WaveformVisualizerProps {
  assetSrc: string;
  duration: number;
  width: number;
  height: number;
  color?: string;
  offset?: number;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  assetSrc,
  duration,
  width,
  height,
  color = '#4ade80', // green-400
  offset = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Cache for peaks to avoid re-decoding
  const peaksCache = useRef<Record<string, number[]>>({});

  useEffect(() => {
    const loadAudio = async () => {
      if (peaksCache.current[assetSrc]) {
        setPeaks(peaksCache.current[assetSrc]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(assetSrc);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer);
        
        const rawData = decodedData.getChannelData(0);
        const samplesPerPixel = Math.floor(rawData.length / 1000); // Generate 1000 peaks for high resolution
        const generatedPeaks: number[] = [];

        for (let i = 0; i < 1000; i++) {
          let max = 0;
          for (let j = 0; j < samplesPerPixel; j++) {
            const val = Math.abs(rawData[i * samplesPerPixel + j]);
            if (val > max) max = val;
          }
          generatedPeaks.push(max);
        }

        peaksCache.current[assetSrc] = generatedPeaks;
        setPeaks(generatedPeaks);
        audioCtx.close();
      } catch (error) {
        console.error('Error loading audio for waveform:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (assetSrc) {
      loadAudio();
    }
  }, [assetSrc]);

  useEffect(() => {
    if (peaks.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;

    const barWidth = 2;
    const gap = 1;
    const totalBars = Math.floor(width / (barWidth + gap));
    
    // Calculate which portion of the peaks to show based on offset and duration
    // This is a simplified version, assuming peaks represent the full asset duration
    const startIdx = Math.floor((offset / duration) * peaks.length);
    const visiblePeaksCount = peaks.length; // We use all peaks but scale them to the width

    for (let i = 0; i < totalBars; i++) {
      const peakIdx = Math.floor((i / totalBars) * peaks.length);
      const peak = peaks[peakIdx] || 0;
      const barHeight = Math.max(2, peak * height * 0.8);
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;
      
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [peaks, width, height, color, offset, duration]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 opacity-40 pointer-events-none"
    />
  );
};

export default WaveformVisualizer;
