
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { SYSTEM_INSTRUCTION_BASE, MODEL_NAME, SYSTEM_COMMAND_TOOL } from './constants';
import { ConnectionStatus, Protocol, ScriptureResult, Message } from './types';
import HUD from './components/HUD';

// Decoding/Encoding helpers
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

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
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
  
  const [commandLogs, setCommandLogs] = useState<string[]>(["Core systems initialized... awaiting boss command."]);
  const [systemStats, setSystemStats] = useState({ power: 88, memory: 45, logic: 95 });
  
  const [history, setHistory] = useState<Message[]>(() => {
    const saved = localStorage.getItem('brahmastra_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [memories, setMemories] = useState<string[]>(() => {
    const saved = localStorage.getItem('brahmastra_memories');
    return saved ? JSON.parse(saved) : ["Boss prefers Hinglish interaction.", "Admin access granted."];
  });

  const [protocols, setProtocols] = useState<Protocol[]>(() => {
    const saved = localStorage.getItem('brahmastra_protocols');
    return saved ? JSON.parse(saved) : [
      { id: '1', phrase: 'Initiate Red Protocol', action: 'Set all systems to maximum alert and scan local perimeter.' },
      { id: '2', phrase: 'Dharma Check', action: 'Quote a relevant shloka from Bhagavad Gita for the current situation.' }
    ];
  });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // Buffer for current turn to save to history
  const currentTurnUser = useRef<string>("");
  const currentTurnAssistant = useRef<string>("");

  useEffect(() => {
    localStorage.setItem('brahmastra_protocols', JSON.stringify(protocols));
    localStorage.setItem('brahmastra_memories', JSON.stringify(memories));
    localStorage.setItem('brahmastra_history', JSON.stringify(history));
  }, [protocols, memories, history]);

  // Update Gain Node when isMuted changes
  useEffect(() => {
    if (gainNodeRef.current && outputAudioContextRef.current) {
      const targetGain = isMuted ? 0 : 1;
      gainNodeRef.current.gain.setTargetAtTime(targetGain, outputAudioContextRef.current.currentTime, 0.05);
    }
  }, [isMuted]);

  const addLog = (msg: string) => {
    setCommandLogs(prev => [...prev.slice(-15), msg]);
  };

  const clearHistory = () => {
    setHistory([]);
    addLog("SYSTEM: Archives purged successfully.");
  };

  const handleSystemCommand = (args: any) => {
    const { command, target, value } = args;
    addLog(`EXEC: ${command} -> ${target} ${value ? `(${value})` : ''}`);
    
    if (command === 'ADJUST_SETTING' && target === 'POWER_LEVEL') {
      const p = parseInt(value) || 100;
      setSystemStats(prev => ({ ...prev, power: p }));
    } else if (command === 'SECURITY_LOCK') {
      addLog("ALERT: ALL SECTORS LOCKED");
      setSystemStats(prev => ({ ...prev, logic: 100 }));
    } else if (command === 'OPEN_APP') {
      addLog(`SYSTEM: Launching ${target} environment...`);
    }
    
    return "Command processed successfully, Sir. System under full control.";
  };

  const getFullSystemInstruction = () => {
    let instruction = SYSTEM_INSTRUCTION_BASE;
    if (memories.length > 0) {
      instruction += "\n\nPAST CONTEXT & MEMORIES:\n" + memories.map(m => `- ${m}`).join('\n');
    }
    if (protocols.length > 0) {
      instruction += "\n\nCUSTOM USER PROTOCOLS:\n" + protocols.map(p => `- If user says "${p.phrase}": ${p.action}`).join('\n');
    }
    return instruction;
  };

  const startSession = async () => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) return;

    setStatus(ConnectionStatus.CONNECTING);
    addLog("SYNC: INITIATING HANDSHAKE...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      // Initialize Gain Node
      if (!gainNodeRef.current) {
        gainNodeRef.current = outputAudioContextRef.current.createGain();
        gainNodeRef.current.connect(outputAudioContextRef.current.destination);
        gainNodeRef.current.gain.value = isMuted ? 0 : 1;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          systemInstruction: getFullSystemInstruction(),
          responseModalities: ['AUDIO'],
          tools: [{ functionDeclarations: [SYSTEM_COMMAND_TOOL] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            setIsListening(true);
            addLog("SYNC: BRAHMASTRA ONLINE [v4.2.5]");
            
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'execute_system_command') {
                  const result = handleSystemCommand(fc.args);
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
                    });
                  });
                }
              }
            }

            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setTranscription(prev => prev + text);
              currentTurnUser.current += text;
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              setAiResponse(prev => prev + text);
              currentTurnAssistant.current += text;
            }
            
            if (message.serverContent?.turnComplete) {
              if (currentTurnUser.current.trim() || currentTurnAssistant.current.trim()) {
                const newHistoryEntries: Message[] = [];
                if (currentTurnUser.current.trim()) {
                  newHistoryEntries.push({
                    role: 'user',
                    content: currentTurnUser.current.trim(),
                    timestamp: Date.now()
                  });
                }
                if (currentTurnAssistant.current.trim()) {
                  newHistoryEntries.push({
                    role: 'assistant',
                    content: currentTurnAssistant.current.trim(),
                    timestamp: Date.now()
                  });
                }
                setHistory(prev => [...prev, ...newHistoryEntries]);
              }

              currentTurnUser.current = "";
              currentTurnAssistant.current = "";
              setTranscription("");
              setTimeout(() => setAiResponse(""), 4000);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && gainNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              // Connect to gain node instead of destination
              source.connect(gainNodeRef.current);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error("Live Error", e);
            setStatus(ConnectionStatus.ERROR);
            addLog("ERR: LINK TERMINATED. NETWORK INSTABILITY.");
          },
          onclose: (e: any) => {
            console.log("Session closed", e);
            setStatus(ConnectionStatus.DISCONNECTED);
            setIsListening(false);
            addLog("SYNC: SESSION TERMINATED. CORE STANDBY.");
            nextStartTimeRef.current = 0;
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setStatus(ConnectionStatus.ERROR);
      addLog("ERR: AUTHENTICATION FAILURE. RETRY HANDSHAKE.");
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsListening(false);
  };

  const addProtocol = (p: Omit<Protocol, 'id'>) => {
    setProtocols([...protocols, { ...p, id: Date.now().toString() }]);
    addLog(`PROTOCOL: ${p.phrase} UPLOADED.`);
  };

  const removeProtocol = (id: string) => {
    setProtocols(protocols.filter(p => p.id !== id));
  };

  const searchScriptures = async (query: string) => {
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
    } catch (error) {
      console.error(error);
      addLog("SCAN: ARCHIVE ACCESS DENIED.");
    } finally {
      setIsSearchingScriptures(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-cyan-50 selection:bg-cyan-500/30">
      <HUD 
        status={status} 
        isListening={isListening} 
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        transcription={transcription}
        aiResponse={aiResponse}
        protocols={protocols}
        onAddProtocol={addProtocol}
        onRemoveProtocol={removeProtocol}
        onTogglePower={status === ConnectionStatus.CONNECTED ? stopSession : startSession}
        onSearchScriptures={searchScriptures}
        scriptureResults={scriptureResults}
        isSearchingScriptures={isSearchingScriptures}
        commandLogs={commandLogs}
        systemStats={systemStats}
        memoryCount={memories.length}
        history={history}
        onClearHistory={clearHistory}
      />
    </div>
  );
};

export default App;
