
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';
import { SYSTEM_INSTRUCTION_BASE, MODEL_NAME, SYSTEM_COMMAND_TOOL, SEARCH_SCRIPTURES_TOOL } from './constants';
import { ConnectionStatus, Protocol, ScriptureResult, Message, ThemeType, Process, CommandShortcut } from './types';
import HUD from './components/HUD';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, deleteDoc } from 'firebase/firestore';

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
 
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, 0, Math.floor(data.byteLength / 2));
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [transcription, setTranscription] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSearchingScriptures, setIsSearchingScriptures] = useState(false);
  const [scriptureResults, setScriptureResults] = useState<ScriptureResult | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [protocolAlert, setProtocolAlert] = useState<string | null>(null);
  
  // Vision state (Now controlled externally by Python)
  const [isVisionActive, setIsVisionActive] = useState(true); 
  
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const [commandLogs, setCommandLogs] = useState<string[]>(["Brahmastra OS initializing...", "Waiting for admin uplink..."]);
  const [systemStats, setSystemStats] = useState({ power: 92, memory: 38, logic: 99, cpu: 8 });
  const [processes, setProcesses] = useState<Process[]>([
    { pid: 1024, name: 'brahmastra_core.sys', cpu: 1.2, memory: 84, status: 'Running' },
    { pid: 2048, name: 'gesture_engine.py', cpu: 12.5, memory: 256, status: 'Running' },
  ]);
  
  const [theme, setTheme] = useState<ThemeType>('Indigo');
  const [history, setHistory] = useState<Message[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [commandShortcuts, setCommandShortcuts] = useState<CommandShortcut[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.theme) setTheme(data.theme);
        if (data.power) setSystemStats(prev => ({ ...prev, power: data.power }));
      }
    });
    const unsubHistory = onSnapshot(collection(db, `users/${user.uid}/history`), (snap) => {
      setHistory(snap.docs.map(d => d.data() as Message).sort((a, b) => a.timestamp - b.timestamp));
    });
    const unsubProtocols = onSnapshot(collection(db, `users/${user.uid}/protocols`), (snap) => {
      setProtocols(snap.docs.map(d => ({ ...d.data(), id: d.id } as Protocol)));
    });
    const unsubShortcuts = onSnapshot(collection(db, `users/${user.uid}/shortcuts`), (snap) => {
      setCommandShortcuts(snap.docs.map(d => ({ ...d.data(), id: d.id } as CommandShortcut)));
    });
    return () => { unsubUser(); unsubHistory(); unsubProtocols(); unsubShortcuts(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setDoc(doc(db, 'users', user.uid), { theme, power: systemStats.power }, { merge: true });
  }, [theme, systemStats.power, user]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const addLog = useCallback((msg: string) => {
    setCommandLogs(prev => [...prev.slice(-14), msg]);
  }, []);

  const stopAudio = useCallback(() => {
    for (const source of sourcesRef.current.values()) {
      try { source.stop(); } catch (e) {}
      sourcesRef.current.delete(source);
    }
    nextStartTimeRef.current = 0;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newState = !prev;
      addLog(`SYSTEM: ${newState ? "Voice uplink suspended." : "Voice uplink restored."}`);
      if (newState) stopAudio();
      return newState;
    });
  }, [addLog, stopAudio]);

  // UPLINK: Exposing functionality to Python backend
  useEffect(() => {
    (window as any).brahmastra_uplink = {
      toggleMute: toggleMute,
      addLog: (msg: string) => addLog(`PYTHON: ${msg}`),
      setVisionState: (active: boolean) => setIsVisionActive(active)
    };
    addLog("SYSTEM: External command bridge verified.");
  }, [toggleMute, addLog]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      if (typeof sessionRef.current.close === 'function') {
        sessionRef.current.close();
      }
    }
    stopAudio();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsListening(false);
    sessionRef.current = null;
    addLog("SYSTEM: Neural link terminated.");
  }, [stopAudio, addLog]);

  const handleSystemCommand = useCallback((args: any) => {
    const { command, target, value } = args;
    addLog(`EXEC: ${command} -> ${target} ${value ? `(${value})` : ''}`);
    
    let resultMessage = "Command processed successfully, Sir.";

    switch (command) {
      case 'ADJUST_SETTING':
        if (target === 'POWER_LEVEL') {
          const p = parseInt(value) || 100;
          setSystemStats(prev => ({ ...prev, power: p }));
        }
        break;
      case 'SECURITY_LOCK':
        addLog("ALERT: ALL SECTORS LOCKED");
        setSystemStats(prev => ({ ...prev, logic: 100 }));
        resultMessage = "Global lockdown sequence complete. Perimeter secure.";
        break;
      case 'OPEN_APP':
        addLog(`SYSTEM: Launching ${target} environment...`);
        resultMessage = `${target} has been initialized in your primary workspace, Boss.`;
        break;
      case 'LIST_PROCESSES':
        addLog(`SCAN: Reading background tasks...`);
        addLog(`SCAN: Found [Chrome, Slack, VSCode, Spotify, System-Kernel]`);
        resultMessage = "Sir, I've listed the primary active processes in the log console.";
        break;
      case 'KILL_PROCESS':
        addLog(`EXEC: Terminating ${target}...`);
        addLog(`EXEC: ${target} session ended.`);
        resultMessage = `Bilkul Sir, ${target} has been successfully neutralized.`;
        break;
      case 'MONITOR_RESOURCES':
        const cpu = Math.floor(20 + Math.random() * 40);
        const ram = Math.floor(40 + Math.random() * 30);
        addLog(`TELEMETRY: CPU: ${cpu}% | RAM: ${ram}% | Logic: ${systemStats.logic.toFixed(1)}%`);
        setSystemStats(prev => ({ ...prev, memory: ram }));
        resultMessage = `Current diagnostics show CPU at ${cpu}% and memory usage at ${ram}%, Sir. Everything is stable.`;
        break;
      default:
        addLog(`WARN: Unknown administrative protocol ${command}.`);
    }
    
    return resultMessage;
  }, [addLog, systemStats.logic]);

  const searchScriptures = useCallback(async (query: string) => {
    setIsSearchingScriptures(true);
    setScriptureResults(null);
    addLog(`SCAN: ACCESSING VEDIC DATABANKS -> ${query}`);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Reference Hindu scriptures (Mahabharat, Ramayana, Geeta, Puranas, or Vedas) for: "${query}". Provide Shloka and Hinglish explanation as BRAHMASTRA.`,
        config: { tools: [{ googleSearch: {} }] }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const urls = chunks.map((c: any) => ({
        web: { uri: c.web?.uri || '', title: c.web?.title || 'Source' }
      }));

      setScriptureResults({
        explanation: response.text || "Scanning yielded no significant matches.",
        source: "Deep Scriptural Index",
        urls: urls
      });
      addLog("SCAN: ANALYSIS COMPLETE.");
      return "Scripture search completed and displayed to the user.";
    } catch (error) {
      console.error(error);
      addLog("SCAN: ARCHIVE ACCESS DENIED.");
      return "Error accessing scriptural archives.";
    } finally {
      setIsSearchingScriptures(false);
    }
  }, [addLog]);

  const connect = useCallback(async () => {
    if (sessionRef.current) return;
    setStatus(ConnectionStatus.CONNECTING);
    addLog("SYSTEM: Initiating secure handshake with Akasha...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      gainNodeRef.current = outputAudioContextRef.current.createGain();
      gainNodeRef.current.connect(outputAudioContextRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          tools: [{ functionDeclarations: [SYSTEM_COMMAND_TOOL, SEARCH_SCRIPTURES_TOOL] }],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            setIsListening(true);
            addLog("SYSTEM: Live voice channel OPEN.");
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(session => session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(gainNodeRef.current!);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.inputTranscription?.text) {
              setTranscription(message.serverContent.inputTranscription.text);
            }
            if (message.serverContent?.outputTranscription?.text) {
              setAiResponse(message.serverContent.outputTranscription.text);
            }
            if (message.serverContent?.interrupted) stopAudio();
            
            // Handle Tool Calls (Simulated PC Commands & Scripture Search)
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'execute_system_command') {
                  const result = handleSystemCommand(fc.args);
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
                    });
                  });
                } else if (fc.name === 'search_scriptures') {
                  const result = await searchScriptures(fc.args.query as string);
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
                    });
                  });
                }
              }
            }
          },
          onerror: (e) => {
            console.error(e);
            setStatus(ConnectionStatus.ERROR);
            addLog("CRITICAL: Voice link sync failure.");
          },
          onclose: () => {
            setStatus(ConnectionStatus.DISCONNECTED);
            setIsListening(false);
            sessionRef.current = null;
            addLog("SYSTEM: Voice link closed.");
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setStatus(ConnectionStatus.ERROR);
      addLog("CRITICAL: Handshake rejected. Check API credentials.");
    }
  }, [addLog, isMuted, stopAudio]);

  // Removed localStorage syncing

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Sign in failed:", error);
      if (error?.code === 'auth/cancelled-popup-request' || error?.message?.includes('cancelled-popup-request')) {
        setSignInError("Sign-in popup was closed before completing. Please try again.");
      } else {
        setSignInError(error?.message || "An error occurred during sign in.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (!isAuthReady) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-white font-orbitron">INITIALIZING...</div>;
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-white font-orbitron relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.8)_0%,#020617_100%)] pointer-events-none"></div>
        <div className="z-10 flex flex-col items-center gap-8 bg-slate-900/60 p-12 rounded-[40px] border border-white/10 shadow-[0_0_60px_-10px_rgba(6,182,212,0.4)] backdrop-blur-3xl">
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl text-cyan-400 animate-om">ॐ</span>
            <h1 className="text-3xl font-black tracking-tighter mt-4">BRAHMASTRA OS</h1>
            <p className="text-xs text-cyan-400/60 tracking-widest uppercase">Awaiting Admin Uplink</p>
          </div>
          <button 
            onClick={handleSignIn}
            disabled={isSigningIn}
            className={`px-8 py-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-2xl text-cyan-400 font-bold tracking-widest uppercase transition-all ${isSigningIn ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          >
            {isSigningIn ? 'Initiating...' : 'Initiate Handshake'}
          </button>
          {signInError && (
            <p className="text-red-400 text-xs text-center max-w-xs">{signInError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 overflow-hidden relative">
      <HUD 
        status={status}
        isListening={isListening}
        isMuted={isMuted}
        theme={theme}
        onThemeChange={setTheme}
        onToggleMute={toggleMute}
        transcription={transcription}
        aiResponse={aiResponse}
        protocols={protocols}
        onAddProtocol={(p) => {
          const id = Date.now().toString();
          setDoc(doc(db, `users/${user.uid}/protocols`, id), p);
        }}
        onRemoveProtocol={(id) => deleteDoc(doc(db, `users/${user.uid}/protocols`, id))}
        onTogglePower={() => status === ConnectionStatus.CONNECTED ? disconnect() : connect()}
        onSearchScriptures={() => {}} 
        scriptureResults={scriptureResults}
        isSearchingScriptures={isSearchingScriptures}
        commandLogs={commandLogs}
        systemStats={systemStats}
        memoryCount={0}
        history={history}
        onClearHistory={() => {
          history.forEach(h => deleteDoc(doc(db, `users/${user.uid}/history`, h.timestamp.toString())));
        }}
        onDownloadHistory={() => {}}
        processes={processes}
        onKillProcess={(pid) => setProcesses(prev => prev.filter(p => p.pid !== pid))}
        onImageUpload={async (file) => {
           setIsAnalyzingImage(true);
           addLog(`SCAN: Analyzing data package: ${file.name}`);
           try {
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
             const reader = new FileReader();
             reader.onloadend = async () => {
               const base64Data = (reader.result as string).split(',')[1];
               const response = await ai.models.generateContent({
                 model: 'gemini-3.1-pro-preview',
                 contents: {
                   parts: [
                     { inlineData: { data: base64Data, mimeType: file.type } },
                     { text: 'Analyze this image in detail as an AI concierge.' }
                   ]
                 }
               });
               addLog(`SCAN RESULT: ${response.text?.substring(0, 100)}...`);
             };
             reader.readAsDataURL(file);
           } catch (e) {
             addLog("SCAN: Analysis failed.");
           } finally {
             setIsAnalyzingImage(false);
           }
        }}
        isAnalyzingImage={isAnalyzingImage}
        commandShortcuts={commandShortcuts}
        onAddShortcut={(s) => {
          const id = Date.now().toString();
          setDoc(doc(db, `users/${user.uid}/shortcuts`, id), s);
        }}
        onUpdateShortcut={(s) => setDoc(doc(db, `users/${user.uid}/shortcuts`, s.id), { alias: s.alias, command: s.command, description: s.description })}
        onDeleteShortcut={(id) => deleteDoc(doc(db, `users/${user.uid}/shortcuts`, id))}
        onToggleVision={() => setIsVisionActive(!isVisionActive)}
        isVisionActive={isVisionActive}
        addLog={addLog}
      />
    </div>
  );
};

export default App;
