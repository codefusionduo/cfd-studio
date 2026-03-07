import React, { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

export default function LandscapePrompt() {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // We assume the parent component only renders this if we are on "mobile"
      // So we just check for portrait orientation here.
      const isPortraitMode = window.innerHeight > window.innerWidth;
      setIsPortrait(isPortraitMode);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#121212] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
        <Smartphone size={32} className="text-white rotate-90" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Rotate to Edit</h2>
      <p className="text-white/60 max-w-xs">
        Switch to landscape mode for the best editing experience.
      </p>
    </div>
  );
}
