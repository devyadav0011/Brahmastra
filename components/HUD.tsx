
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ConnectionStatus, Protocol, ScriptureResult, Message, ThemeType, Process, CommandShortcut } from '../types';
import { ChatModal } from './ChatModal';
import { GestureControl } from './GestureControl';
import { Hand3DExperience } from './Hand3DExperience';

interface HUDProps {
  status: ConnectionStatus;
  isListening: boolean;
  isMuted: boolean;
  theme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  onToggleMute: () => void;
  transcription: string;
  aiResponse: string;
  protocols: Protocol[];
  onAddProtocol: (p: Omit<Protocol, 'id'>) => void;
  onRemoveProtocol: (id: string) => void;
  onTogglePower: () => void;
  onSearchScriptures: (query: string) => void;
  scriptureResults: ScriptureResult | null;
  isSearchingScriptures: boolean;
  commandLogs: string[];
  systemStats: { power: number; memory: number; logic: number; cpu: number };
  memoryCount: number;
  history: Message[];
  onClearHistory: () => void;
  onDownloadHistory: () => void;
  processes: Process[];
  onKillProcess: (pid: number) => void;
  onImageUpload: (file: File) => void;
  isAnalyzingImage: boolean;
  commandShortcuts: CommandShortcut[];
  onAddShortcut: (s: Omit<CommandShortcut, 'id'>) => void;
  onUpdateShortcut: (s: CommandShortcut) => void;
  onDeleteShortcut: (id: string) => void;
  onToggleVision: () => void;
  isVisionActive: boolean;
  addLog: (msg: string) => void;
}

const HUD: React.FC<HUDProps> = ({ 
  status, isListening, isMuted, theme, transcription, aiResponse, 
  protocols, onRemoveProtocol, onTogglePower, scriptureResults, 
  commandLogs, processes, onKillProcess, onImageUpload, isAnalyzingImage,
  commandShortcuts, onAddShortcut, onUpdateShortcut, onDeleteShortcut,
  history, onToggleMute, onToggleVision, isVisionActive, addLog
}) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [activeModal, setActiveModal] = useState<'Protocols' | 'Scriptures' | 'History' | 'Telemetry' | 'Web' | 'Chat' | 'Sculpt' | null>(null);
  const [telemetryTab, setTelemetryTab] = useState<'Processes' | 'Matrix'>('Processes');
  const [newShortcut, setNewShortcut] = useState({ alias: '', command: '', description: '' });
  const [isAddingShortcut, setIsAddingShortcut] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fsHandler);
    return () => {
      clearInterval(timer);
      document.removeEventListener('fullscreenchange', fsHandler);
    };
  }, []);

  const themeColors = useMemo(() => {
    switch(theme) {
      case 'Saffron': return { primary: 'orange-500', text: 'text-orange-400', border: 'border-orange-500', glow: 'rgba(249, 115, 22, 0.4)', bg: 'bg-orange-500', gradient: 'from-orange-500 to-amber-600' };
      case 'Emerald': return { primary: 'emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', glow: 'rgba(16, 185, 129, 0.4)', bg: 'bg-emerald-500', gradient: 'from-emerald-500 to-teal-600' };
      default: return { primary: 'cyan-500', text: 'text-cyan-400', border: 'border-cyan-500', glow: 'rgba(6, 182, 212, 0.4)', bg: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-600' };
    }
  }, [theme]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden font-orbitron select-none relative h-full w-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.8)_0%,#020617_100%)] pointer-events-none"></div>

      {/* Background Holographic Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
         <div className="w-full h-full bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      <div 
        className={`relative w-full max-w-[440px] h-full max-h-[850px] bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[40px] flex flex-col overflow-hidden shadow-2xl transition-all duration-500`}
        style={{ boxShadow: `0 0 60px -10px ${themeColors.glow}` }}
      >
        {/* Header */}
        <div className="p-6 pb-2 flex flex-col gap-1 z-10">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className={`text-[8px] ${themeColors.text} opacity-70 tracking-[0.4em] uppercase font-bold`}>BRAHMASTRA CORE</span>
              <h1 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
                OS v5.0.0 
                <button onClick={toggleFullscreen} className="text-[10px] opacity-40 hover:opacity-100 transition-opacity">
                   {isFullscreen ? '⦿' : '⛶'}
                </button>
              </h1>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-2xl font-light text-white tracking-tight">{time.split(' ')[0]}</div>
              <div className="text-[7px] text-white/40 uppercase tracking-widest">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/40 rounded-full border border-white/5">
              <div className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className={`text-[7px] font-black tracking-widest ${status === ConnectionStatus.CONNECTED ? 'text-green-400' : 'text-red-400'}`}>{status}</span>
            </div>
            {isAnalyzingImage && <span className="text-[7px] text-yellow-500 animate-pulse font-black uppercase tracking-widest">Vision Sync Active</span>}
            {isVisionActive && <span className="text-[7px] text-cyan-400 animate-pulse font-black uppercase tracking-widest flex items-center gap-1"><span>👁️</span> Vision Control</span>}
          </div>
        </div>

        {/* Center UI */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-4">
           <div className={`relative z-10 w-40 h-40 rounded-full bg-gradient-to-br ${themeColors.gradient} flex items-center justify-center transition-all duration-700 ${isListening ? 'scale-110 shadow-[0_0_80px_rgba(6,182,212,0.5)]' : ''}`}>
              <div className="w-36 h-36 rounded-full bg-slate-950 flex items-center justify-center border border-white/10 overflow-hidden relative">
                  <div className={`absolute inset-0 border border-white/5 rounded-full animate-spin [animation-duration:8s]`}></div>
                  <div className="flex gap-1 items-end h-12 z-20">
                     {[...Array(12)].map((_, i) => (
                       <div key={i} className={`w-1.5 ${themeColors.bg} rounded-full transition-all duration-150 ${isListening ? 'animate-bounce' : 'h-1 opacity-20'}`} style={{ animationDelay: `${i * 0.05}s`, height: isListening ? `${Math.random() * 100}%` : '4px' }}></div>
                     ))}
                  </div>
              </div>
           </div>

           <div className="w-full mt-8 text-center px-4 min-h-[160px] flex flex-col justify-center gap-4">
              {transcription && (
                <div className="animate-fadeIn">
                   <span className={`text-[7px] ${themeColors.text} font-black uppercase tracking-[0.4em] mb-1 block`}>Vocal Uplink</span>
                   <p className="text-slate-400 text-xs italic">"{transcription}"</p>
                </div>
              )}
              {aiResponse && (
                <div className="animate-fadeIn">
                   <span className="text-[7px] text-yellow-500 font-black uppercase tracking-[0.4em] mb-1 block">Brahmastra</span>
                   <p className="text-white text-md font-bold leading-snug tracking-wide">{aiResponse}</p>
                </div>
              )}
           </div>
        </div>

        {/* System Logs */}
        <div className="px-6 space-y-3 mb-4">
           <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
              <div className="text-[7px] font-black text-white/30 tracking-widest uppercase mb-3 flex justify-between">
                <span>Administrative Logs</span>
                <span className={themeColors.text}>System Optimized</span>
              </div>
              <div className="h-20 overflow-hidden flex flex-col-reverse gap-1">
                 {commandLogs.slice(-5).map((log, i) => (
                   <div key={i} className="text-[9px] text-white/40 font-mono flex items-start gap-2">
                      <span className={themeColors.text}>&gt;</span>
                      <span className="truncate">{log}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Footer Navigation */}
        <div className="bg-black/50 backdrop-blur-3xl border-t border-white/10 p-6 pt-4 flex flex-col items-center gap-4">
           <div className="flex items-center justify-between w-full">
              {[
                { id: 'Protocols', icon: '⚡', label: 'Cmd' },
                { id: 'Telemetry', icon: '📊', label: 'Stats' },
                { id: 'Chat', icon: '💬', label: 'Chat' },
                { id: 'Sculpt', icon: '🧊', label: 'Sculpt' },
                { id: 'Web', icon: '🌐', label: 'Web' },
              ].map(item => (
                <button key={item.id} onClick={() => setActiveModal(item.id as any)} className="flex flex-col items-center gap-1 group">
                   <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-all">
                      <span className="text-lg">{item.icon}</span>
                   </div>
                   <span className="text-[7px] text-white/40 uppercase tracking-widest">{item.label}</span>
                </button>
              ))}

              <button onClick={onTogglePower} className="relative w-16 h-16 flex items-center justify-center -translate-y-4">
                 <div className={`absolute inset-0 rounded-full border-4 ${status === ConnectionStatus.CONNECTED ? themeColors.border : 'border-slate-800'} animate-pulse`}></div>
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center ${status === ConnectionStatus.CONNECTED ? themeColors.bg : 'bg-slate-800'}`}>
                    <svg className="w-6 h-6 text-slate-950" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                 </div>
              </button>

              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 group">
                 <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 ${isAnalyzingImage ? 'animate-pulse' : ''}`}>
                    <span className="text-lg">📷</span>
                 </div>
                 <span className="text-[7px] text-white/40 uppercase tracking-widest">Scan</span>
              </button>

              {[
                { id: 'Vision', icon: '🕶️', label: 'Vision', action: onToggleVision },
                { id: 'mute', icon: isMuted ? '🔇' : '🔊', label: 'Voice', action: onToggleMute },
              ].map(item => (
                <button key={item.id} onClick={item.action || (() => setActiveModal(item.id as any))} className="flex flex-col items-center gap-1 group">
                   <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-all ${item.id === 'Vision' && isVisionActive ? 'text-cyan-400' : ''}`}>
                      <span className="text-lg">{item.icon}</span>
                   </div>
                   <span className="text-[7px] text-white/40 uppercase tracking-widest">{item.label}</span>
                </button>
              ))}
              
              <GestureControl 
                themeColors={themeColors}
                onCommand={(cmd) => {
                  if (cmd === 'reload') window.location.reload();
                  else if (cmd.startsWith('search')) window.open(`https://google.com/search?q=${encodeURIComponent(cmd.replace('search ', ''))}`, '_blank');
                  addLog(`GESTURE: ${cmd}`);
                }}
              />
           </div>
           
           {/* Pulsating Om Symbol */}
           <div className={`text-2xl cursor-default animate-om ${themeColors.text}`}>
              ॐ
           </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onImageUpload(e.target.files[0])} />

      {/* Modals */}
      {activeModal && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setActiveModal(null)}></div>
           
           <div className={`relative bg-slate-900 border ${themeColors.border}/40 rounded-[32px] w-full flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${activeModal === 'Web' || activeModal === 'Sculpt' ? 'max-w-[95%] h-[90vh]' : 'max-w-[420px] max-h-[75vh]'}`}>
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                 <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeModal} Protocol</h2>
                 <button onClick={() => setActiveModal(null)} className="text-white/30 hover:text-white text-2xl">&times;</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 text-xs custom-scrollbar">
                 {activeModal === 'Sculpt' && (
                    <Hand3DExperience themeColors={themeColors} />
                 )}
                 {activeModal === 'Web' && (
                    <div className="h-full flex flex-col space-y-6">
                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2 space-y-6">
                             <div className="p-6 bg-black/40 border border-white/10 rounded-3xl">
                                <h3 className={`text-lg font-black ${themeColors.text} mb-4 uppercase tracking-tighter`}>Tactical Web Intelligence</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {scriptureResults?.urls?.map((url, i) => (
                                      <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-cyan-500/30 transition-all group">
                                         <div className="text-[7px] text-cyan-400 font-bold uppercase mb-1">Source Uplink #{i+1}</div>
                                         <div className="text-white font-black text-sm mb-2 line-clamp-1 group-hover:text-cyan-400 transition-colors">{url.web.title}</div>
                                         <a href={url.web.uri} target="_blank" rel="noreferrer" className="text-[9px] text-white/30 truncate block mb-3 hover:underline">{url.web.uri}</a>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 )}
                 {activeModal === 'Telemetry' && (
                    <div className="flex flex-col h-full space-y-6">
                       <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                          {(['Processes', 'Matrix'] as const).map(tab => (
                             <button
                                key={tab}
                                onClick={() => setTelemetryTab(tab)}
                                className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                   telemetryTab === tab ? `${themeColors.bg} text-slate-950` : 'text-white/40 hover:text-white/60'
                                }`}
                             >
                                {tab}
                             </button>
                          ))}
                       </div>

                       {telemetryTab === 'Processes' ? (
                          <div className="space-y-4">
                             <div className="text-[7px] font-black text-white/30 tracking-[0.3em] uppercase mb-2">Active Neural Threads</div>
                             {processes.map(p => (
                                <div key={p.pid} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/20 transition-all">
                                   <div className="truncate flex-1">
                                      <div className="font-bold text-white uppercase tracking-tight flex items-center gap-2">
                                         {p.name}
                                         <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'Running' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                      </div>
                                      <div className="text-[8px] text-white/40 font-mono">PID {p.pid} • {p.cpu.toFixed(1)}% CPU • {p.memory.toFixed(1)}MB RAM</div>
                                   </div>
                                   <button 
                                      onClick={() => onKillProcess(p.pid)} 
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500/50 hover:bg-red-500/20 hover:text-red-500 transition-all"
                                   >
                                      &times;
                                   </button>
                                </div>
                             ))}
                          </div>
                       ) : (
                          <div className="space-y-6">
                             {/* System Handlers */}
                             <section>
                                <div className="text-[7px] font-black text-white/30 tracking-[0.3em] uppercase mb-3">Hardcoded Logic Gates</div>
                                <div className="grid grid-cols-1 gap-2">
                                   {[
                                      { cmd: 'open [site]', desc: 'Bypass firewall to external domains' },
                                      { cmd: 'search [query]', desc: 'Scan global data arrays' },
                                      { cmd: 'play [song]', desc: 'Synchronize audio frequencies' },
                                      { cmd: 'reload', desc: 'Re-initialize core subsystems' },
                                      { cmd: 'scroll up/down', desc: 'Navigate visual buffer' }
                                   ].map((sys, idx) => (
                                      <div key={idx} className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                                         <div className="font-mono text-[9px] text-cyan-400 font-bold">{sys.cmd}</div>
                                         <div className="text-[8px] text-white/40">{sys.desc}</div>
                                      </div>
                                   ))}
                                </div>
                             </section>

                             {/* Custom Shortcut Matrix */}
                             <section className="space-y-4">
                                <div className="flex justify-between items-center">
                                   <div className="text-[7px] font-black text-white/30 tracking-[0.3em] uppercase">Shortcut Matrix</div>
                                   <button 
                                      onClick={() => setIsAddingShortcut(!isAddingShortcut)}
                                      className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded border transition-all ${isAddingShortcut ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-green-500/20 border-green-500/40 text-green-400'}`}
                                   >
                                      {isAddingShortcut ? 'Cancel' : '+ New Entry'}
                                   </button>
                                </div>

                                {isAddingShortcut && (
                                   <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 animate-fadeIn">
                                      <input 
                                         placeholder="ALIAS (e.g. 'yt')" 
                                         value={newShortcut.alias}
                                         onChange={e => setNewShortcut({...newShortcut, alias: e.target.value})}
                                         className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white focus:border-cyan-500 outline-none"
                                      />
                                      <input 
                                         placeholder="COMMAND (e.g. 'open youtube.com')" 
                                         value={newShortcut.command}
                                         onChange={e => setNewShortcut({...newShortcut, command: e.target.value})}
                                         className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white focus:border-cyan-500 outline-none"
                                      />
                                      <button 
                                         onClick={() => {
                                            if (newShortcut.alias && newShortcut.command) {
                                               onAddShortcut({ ...newShortcut, description: `Custom alias for ${newShortcut.command}` });
                                               setNewShortcut({ alias: '', command: '', description: '' });
                                               setIsAddingShortcut(false);
                                            }
                                         }}
                                         className="w-full py-2 bg-cyan-500 text-slate-950 rounded-lg text-[9px] font-black uppercase tracking-widest"
                                      >
                                         Authorize Link
                                      </button>
                                   </div>
                                )}

                                <div className="grid grid-cols-1 gap-2">
                                   {commandShortcuts.map(s => (
                                      <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/20 transition-all">
                                         <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                               <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[8px] font-bold font-mono">{s.alias}</span>
                                               <span className="text-[10px] text-white font-bold">{s.command}</span>
                                            </div>
                                         </div>
                                         <button 
                                            onClick={() => onDeleteShortcut(s.id)}
                                            className="text-red-500/30 hover:text-red-500 p-1 transition-colors"
                                         >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                         </button>
                                      </div>
                                   ))}
                                </div>
                             </section>
                          </div>
                       )}
                    </div>
                 )}
                 {activeModal === 'Protocols' && (
                    <div className="space-y-4">
                       {protocols.map(p => (
                         <div key={p.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-start">
                            <div className="flex-1">
                               <div className="text-[10px] font-bold text-cyan-400 mb-1">Trigger: "{p.phrase}"</div>
                               <div className="text-[9px] text-white/40 italic">Action: {p.action}</div>
                            </div>
                            <button onClick={() => onRemoveProtocol(p.id)} className="text-red-500/50 hover:text-red-500 p-1">Purge</button>
                         </div>
                       ))}
                    </div>
                 )}
                 {activeModal === 'Chat' && (
                    <ChatModal themeColors={themeColors} addLog={addLog} />
                 )}
                 {activeModal === 'History' && (
                   <div className="space-y-4">
                      {history.slice().reverse().map((msg, i) => (
                         <div key={i} className={`p-4 rounded-3xl border ${msg.role === 'user' ? 'bg-white/5 border-white/5' : 'bg-cyan-500/5 border-cyan-500/20'}`}>
                            <div className="text-[7px] font-black uppercase tracking-widest mb-1 opacity-40">{msg.role === 'user' ? 'Boss' : 'Brahmastra'}</div>
                            <p className="text-white text-xs leading-relaxed">{msg.content}</p>
                         </div>
                      ))}
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default HUD;
