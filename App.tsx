
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION_BASE, MODEL_NAME, SYSTEM_COMMAND_TOOL, SEARCH_SCRIPTURES_TOOL } from './constants';
import { ConnectionStatus, Protocol, ScriptureResult, Message, ThemeType, Process, CommandShortcut } from './types';
import HUD from './components/HUD';

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
  
  const [commandLogs, setCommandLogs] = useState<string[]>(["Brahmastra OS initializing...", "Waiting for admin uplink..."]);
  const [systemStats, setSystemStats] = useState({ power: 92, memory: 38, logic: 99, cpu: 8 });
  const [processes, setProcesses] = useState<Process[]>([
    { pid: 1024, name: 'brahmastra_core.sys', cpu: 1.2, memory: 84, status: 'Running' },
    { pid: 2048, name: 'gesture_engine.py', cpu: 12.5, memory: 256, status: 'Running' },
  ]);
  
  const [theme, setTheme] = useState<ThemeType>(() => (localStorage.getItem('brahmastra_theme') as ThemeType) || 'Indigo');
  const [history, setHistory] = useState<Message[]>(() => JSON.parse(localStorage.getItem('brahmastra_history') || '[]'));
  const [protocols, setProtocols] = useState<Protocol[]>(() => JSON.parse(localStorage.getItem('brahmastra_protocols') || '[]'));
  const [commandShortcuts, setCommandShortcuts] = useState<CommandShortcut[]>(() => JSON.parse(localStorage.getItem('brahmastra_shortcuts') || '[]'));
  
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
                  const result = await searchScriptures(fc.args.query);
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

  useEffect(() => {
    localStorage.setItem('brahmastra_protocols', JSON.stringify(protocols));
    localStorage.setItem('brahmastra_history', JSON.stringify(history));
    localStorage.setItem('brahmastra_theme', theme);
    localStorage.setItem('brahmastra_shortcuts', JSON.stringify(commandShortcuts));
  }, [protocols, history, theme, commandShortcuts]);

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
        onAddProtocol={(p) => setProtocols(prev => [...prev, { ...p, id: Date.now().toString() }])}
        onRemoveProtocol={(id) => setProtocols(prev => prev.filter(p => p.id !== id))}
        onTogglePower={() => status === ConnectionStatus.CONNECTED ? disconnect() : connect()}
        onSearchScriptures={() => {}} 
        scriptureResults={scriptureResults}
        isSearchingScriptures={isSearchingScriptures}
        commandLogs={commandLogs}
        systemStats={systemStats}
        memoryCount={0}
        history={history}
        onClearHistory={() => setHistory([])}
        onDownloadHistory={() => {}}
        processes={processes}
        onKillProcess={(pid) => setProcesses(prev => prev.filter(p => p.pid !== pid))}
        onImageUpload={async (file) => {
           setIsAnalyzingImage(true);
           addLog(`SCAN: Analyzing data package: ${file.name}`);
           // Simple visual scan placeholder
           setTimeout(() => {
             setIsAnalyzingImage(false);
             addLog("SCAN: Analysis complete. No threats detected.");
           }, 2000);
        }}
        isAnalyzingImage={isAnalyzingImage}
        commandShortcuts={commandShortcuts}
        onAddShortcut={(s) => setCommandShortcuts(prev => [...prev, { ...s, id: Date.now().toString() }])}
        onUpdateShortcut={(s) => setCommandShortcuts(prev => prev.map(item => item.id === s.id ? s : item))}
        onDeleteShortcut={(id) => setCommandShortcuts(prev => prev.filter(s => s.id !== id))}
        onToggleVision={() => setIsVisionActive(!isVisionActive)}
        isVisionActive={isVisionActive}
      />
    </div>
  );
};

export default App;
