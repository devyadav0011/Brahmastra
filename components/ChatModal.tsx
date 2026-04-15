import React, { useState, useRef } from 'react';
import { GoogleGenAI, ThinkingLevel, Modality } from '@google/genai';
import { ThemeType } from '../types';

interface ChatModalProps {
  themeColors: any;
  addLog: (msg: string) => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({ themeColors, addLog }) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'Fast' | 'Think' | 'Maps' | 'Search'>('Fast');
  const [response, setResponse] = useState('');
  const [groundingUrls, setGroundingUrls] = useState<{title: string, uri: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSpeak = async () => {
    if (!response) return;
    setIsPlayingTTS(true);
    addLog('TTS: Generating speech...');
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text: response }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
          }
        });
        
        const base64Audio = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play();
            audioRef.current.onended = () => setIsPlayingTTS(false);
          } else {
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            audio.play();
            audio.onended = () => setIsPlayingTTS(false);
          }
        } else {
          setIsPlayingTTS(false);
        }
      } catch (e) {
        console.error(e);
        addLog('TTS: Error generating speech.');
        setIsPlayingTTS(false);
      }
    };

    const toggleRecording = async () => {
      if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64Audio = (reader.result as string).split(',')[1];
              addLog('TRANSCRIPTION: Processing audio...');
              try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
                const res = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: [
                    { inlineData: { data: base64Audio, mimeType: 'audio/webm' } },
                    'Transcribe this audio accurately. If it is a command like "open youtube" or "search for something", just return the command text.'
                  ]
                });
                if (res.text) {
                  const transcribedText = res.text.trim();
                  setQuery(transcribedText);
                  addLog('TRANSCRIPTION: Complete.');
                  // Auto-submit if it looks like a command or if user just stopped speaking
                  setTimeout(() => {
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleSubmit(fakeEvent, transcribedText);
                  }, 500);
                }
              } catch (e) {
                console.error(e);
                addLog('TRANSCRIPTION: Error.');
              }
            };
          };

          mediaRecorder.start();
          setIsRecording(true);
          addLog('TRANSCRIPTION: Recording started...');
        } catch (e) {
          console.error(e);
          addLog('TRANSCRIPTION: Microphone access denied.');
        }
      }
    };

    const handleSubmit = async (e: React.FormEvent, overrideQuery?: string) => {
      e.preventDefault();
      const currentQuery = overrideQuery || query;
      if (!currentQuery.trim()) return;
      
      setIsLoading(true);
      setResponse('');
      setGroundingUrls([]);
      addLog(`CHAT [${mode}]: ${currentQuery}`);

      const lowerQuery = currentQuery.toLowerCase().trim();
      
      // Voice Command Interception
      const openMatch = lowerQuery.match(/^open\s+(.+)$/);
      if (openMatch) {
        let target = openMatch[1].replace(/[^a-z0-9.-]/g, '').replace(/\.$/, '');
        if (target === 'youtube') target = 'youtube.com';
        else if (target === 'google') target = 'google.com';
        else if (target === 'github') target = 'github.com';
        else if (target === 'gmail') target = 'mail.google.com';
        else if (!target.includes('.')) target = `${target}.com`;
        
        window.open(`https://${target}`, '_blank');
        setResponse(`Executing command: Opening ${target}...`);
        addLog(`SYSTEM: Executed command 'open ${target}'`);
        setIsLoading(false);
        return;
      }

      const playMatch = lowerQuery.match(/^play\s+(.+)$/);
      if (playMatch) {
        const song = encodeURIComponent(playMatch[1].replace(/\.$/, ''));
        window.open(`https://music.youtube.com/search?q=${song}`, '_blank');
        setResponse(`Executing command: Playing ${playMatch[1].replace(/\.$/, '')} on YouTube Music...`);
        addLog(`SYSTEM: Executed command 'play ${playMatch[1]}'`);
        setIsLoading(false);
        return;
      }

      const searchMatch = lowerQuery.match(/^search\s+(.+)$/);
      if (searchMatch) {
        const q = encodeURIComponent(searchMatch[1].replace(/\.$/, ''));
        window.open(`https://google.com/search?q=${q}`, '_blank');
        setResponse(`Executing command: Searching for ${searchMatch[1].replace(/\.$/, '')}...`);
        addLog(`SYSTEM: Executed command 'search ${searchMatch[1]}'`);
        setIsLoading(false);
        return;
      }

      if (lowerQuery.includes('scroll down')) {
        window.scrollBy({ top: 500, behavior: 'smooth' });
        setResponse('Scrolling down...');
        setIsLoading(false);
        return;
      }

      if (lowerQuery.includes('scroll up')) {
        window.scrollBy({ top: -500, behavior: 'smooth' });
        setResponse('Scrolling up...');
        setIsLoading(false);
        return;
      }

      if (lowerQuery === 'reload' || lowerQuery === 'reload.') {
        setResponse(`Executing command: Reloading system...`);
        addLog(`SYSTEM: Executed command 'reload'`);
        setTimeout(() => window.location.reload(), 1000);
        return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        let res;

        if (mode === 'Fast') {
          res = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: currentQuery,
          });
        } else if (mode === 'Think') {
          res = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: currentQuery,
            config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
          });
        } else if (mode === 'Maps') {
          res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: currentQuery,
            config: { tools: [{ googleMaps: {} }] }
          });
        } else if (mode === 'Search') {
          res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: currentQuery,
            config: { tools: [{ googleSearch: {} }] }
          });
        }

      setResponse(res?.text || 'No response generated.');
      
      const chunks = res?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const urls: {title: string, uri: string}[] = [];
      chunks.forEach((c: any) => {
        if (c.web?.uri) {
          urls.push({ title: c.web.title || 'Source', uri: c.web.uri });
        } else if (c.maps?.uri) {
          urls.push({ title: c.maps.title || 'Map Location', uri: c.maps.uri });
        }
      });
      setGroundingUrls(urls);

      addLog(`CHAT: Response received.`);
    } catch (error) {
      console.error(error);
      setResponse('Error generating response.');
      addLog('CHAT: Error generating response.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex gap-2 justify-between items-center">
        <div className="flex gap-2">
          {['Fast', 'Think', 'Maps', 'Search'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m as any)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${mode === m ? `bg-white/10 border ${themeColors.border} ${themeColors.text}` : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'}`}
            >
              {m}
            </button>
          ))}
        </div>
        {response && (
          <button
            onClick={handleSpeak}
            disabled={isPlayingTTS}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${isPlayingTTS ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 animate-pulse' : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'}`}
          >
            {isPlayingTTS ? 'Speaking...' : 'Speak'}
          </button>
        )}
      </div>
      
      <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-4 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${themeColors.border}`}></div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
              {response || "System ready. Select a mode and enter your query."}
            </div>
            {groundingUrls.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-2">Sources</div>
                <div className="flex flex-col gap-2">
                  {groundingUrls.map((url, i) => (
                    <a key={i} href={url.uri} target="_blank" rel="noreferrer" className="text-xs text-white/60 hover:text-white hover:underline truncate">
                      {url.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <button
          type="button"
          onClick={toggleRecording}
          className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500/20 text-red-500 border border-red-500/50 animate-pulse' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
        >
          🎤
        </button>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter query..."
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className={`px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${isLoading || !query.trim() ? 'bg-white/5 text-white/30 cursor-not-allowed' : `bg-white/10 border ${themeColors.border} ${themeColors.text} hover:bg-white/20`}`}
        >
          Send
        </button>
      </form>
    </div>
  );
};
