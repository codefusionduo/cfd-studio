import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { removeBackground } from '@imgly/background-removal';
import { v4 as uuidv4 } from 'uuid';

export default function AIEditPanel() {
  const { selectedItemId, tracks, assets, updateTrackItem, addAsset } = useEditorStore();
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedItem = tracks.find((t) => t.id === selectedItemId);

  if (!selectedItem) {
    return null;
  }

  const handleAIEdit = async () => {
    if (!prompt.trim()) return;

    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an AI video editor assistant. The user wants to edit the currently selected track item.
Current item properties:
${JSON.stringify(selectedItem, null, 2)}

User request: "${prompt}"

Return a JSON object containing ONLY the properties to update on the track item. Use the exact property names from the current item properties. For example, if the user says "make it black and white", return {"effect": "grayscale"}. If the user says "move it to the top left", return {"x": 0, "y": 0}. If the user says "remove background", return {"removeBackground": true}.
Do not return any other text or markdown formatting, just the raw JSON object.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
              rotation: { type: Type.NUMBER },
              scaleX: { type: Type.NUMBER },
              scaleY: { type: Type.NUMBER },
              text: { type: Type.STRING },
              fontSize: { type: Type.NUMBER },
              fontFill: { type: Type.STRING },
              textAnimation: { type: Type.STRING, enum: ['none', 'fade', 'slide', 'typewriter'] },
              fadeIn: { type: Type.NUMBER },
              fadeOut: { type: Type.NUMBER },
              transitionInType: { type: Type.STRING, enum: ['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out', 'spin-in', 'flip-x', 'flip-y'] },
              transitionOutType: { type: Type.STRING, enum: ['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out', 'spin-out', 'flip-x', 'flip-y'] },
              playbackRate: { type: Type.NUMBER },
              brightness: { type: Type.NUMBER },
              contrast: { type: Type.NUMBER },
              saturation: { type: Type.NUMBER },
              effect: { type: Type.STRING, enum: ['none', 'grayscale', 'sepia', 'blur', 'invert', 'hue-rotate'] },
              removeBackground: { type: Type.BOOLEAN },
            },
          },
        },
      });

      const text = response.text;
      if (text) {
        const updates = JSON.parse(text);
        
        if (updates.removeBackground && selectedItem.type === 'image') {
          const asset = assets.find(a => a.id === selectedItem.assetId);
          if (asset) {
            const blob = await removeBackground(asset.src);
            const url = URL.createObjectURL(blob);
            
            const newAsset = {
              ...asset,
              id: uuidv4(),
              src: url,
              name: `${asset.name} (No BG)`
            };
            
            addAsset(newAsset);
            updates.assetId = newAsset.id;
          }
        }
        delete updates.removeBackground;

        updateTrackItem(selectedItem.id, updates);
        setPrompt('');
      }
    } catch (error) {
      console.error('AI Edit failed:', error);
      alert('Failed to apply AI edit. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 border-b border-white/10 bg-blue-500/5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-blue-400" />
        <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wider">AI Edit</h3>
      </div>
      <div className="flex flex-col gap-2">
        <textarea
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Make it black and white, add a 2s fade in, move to top right..."
          className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none resize-none h-16"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAIEdit();
            }
          }}
        />
        <button
          onClick={handleAIEdit}
          disabled={isProcessing || !prompt.trim()}
          className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Processing...
            </>
          ) : (
            'Apply Edit'
          )}
        </button>
      </div>
    </div>
  );
}
