
import React, { useState, useEffect, useMemo } from 'react';
import { ConnectionStatus, Protocol, ScriptureResult, Message } from '../types';

interface HUDProps {
  status: ConnectionStatus;
  isListening: boolean;
  isMuted: boolean;
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
  systemStats: { power: number; memory: number; logic: number };
  memoryCount: number;
  history: Message[];
  onClearHistory: () => void;
}

const HUD: React.FC<HUDProps> = ({ 
  status, 
  isListening, 
  isMuted,
  onToggleMute,
  transcription, 
  aiResponse, 
  protocols,
  onAddProtocol,
  onRemoveProtocol,
  onTogglePower,
  onSearchScriptures,
  scriptureResults,
  isSearchingScriptures,
  commandLogs,
  systemStats,
  memoryCount,
  history,
  onClearHistory
}) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [showProtocols, setShowProtocols] = useState(false);
  const [showScriptures, setShowScriptures] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const [scriptureQuery, setScriptureQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  
  const [newPhrase, setNewPhrase] = useState('');
  const [newAction, setNewAction] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPhrase && newAction) {
      onAddProtocol({ phrase: newPhrase, action: newAction });
      setNewPhrase('');
      setNewAction('');
    }
  };

  const handleScriptureSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (scriptureQuery) {
      onSearchScriptures(scriptureQuery);
    }
  };

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const lowerSearch = historySearch.toLowerCase();
    return history.filter(msg => msg.content.toLowerCase().includes(lowerSearch));
  }, [history, historySearch]);

  return (
    <div className="relative flex-1 p-8 overflow-hidden font-orbitron">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
      
      {/* Corner UI Elements */}
      <div className="absolute top-8 left-8 flex flex-col gap-2">
        <div className="text-xs text-cyan-400 opacity-70 tracking-widest uppercase font-bold">Neural Core Status</div>
        <div className="text-2xl font-bold text-cyan-100">BRAHMASTRA <span className="text-xs font-normal bg-cyan-900/50 px-2 py-0.5 rounded border border-cyan-500/30">v4.2.5</span></div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'}`}></div>
            <span className="text-[10px] text-cyan-300 uppercase tracking-tighter">{status}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
            <span className="text-[10px] text-gold-400 uppercase tracking-tighter">Memory: {memoryCount} Blocks</span>
          </div>
        </div>
      </div>

      <div className="absolute top-8 right-8 text-right">
        <div className="text-4xl font-light text-cyan-100 tabular-nums">{time}</div>
        <div className="text-xs text-cyan-400 uppercase tracking-widest mt-1">Universal Time Sync</div>
        <div className="mt-4 flex flex-col items-end gap-1">
          <div className="text-[10px] text-cyan-500/80">LAT: 28.6139° N</div>
          <div className="text-[10px] text-cyan-500/80">LONG: 77.2090° E</div>
        </div>
      </div>

      {/* Main Center UI - BRAHMASTRA Core */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-80 h-80 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-dashed border-cyan-500/20 rounded-full animate-orbit"></div>
          <div className="absolute inset-4 border-2 border-cyan-400/10 rounded-full animate-[orbit_15s_linear_infinite_reverse]"></div>
          <div className="absolute inset-10 border border-gold-500/30 rounded-full animate-pulse"></div>
          
          <div className={`relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.5)] transition-transform duration-500 ${isListening ? 'scale-110 shadow-[0_0_80px_rgba(6,182,212,0.8)]' : 'scale-100'}`}>
            <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
               <div className="flex gap-1 items-end h-8">
                 {[...Array(8)].map((_, i) => (
                   <div 
                    key={i} 
                    className={`w-1 bg-cyan-400 rounded-full transition-all duration-75 ${isListening ? 'animate-bounce' : 'h-1'}`}
                    style={{ animationDelay: `${i * 0.1}s`, height: isListening ? `${20 + Math.random() * 80}%` : '4px' }}
                   ></div>
                 ))}
               </div>
            </div>
          </div>

          <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-cyan-400 text-[10px] tracking-[0.2em] uppercase">Neural Link Established</div>
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-gold-400 text-[10px] tracking-[0.2em] uppercase">Dharma Logic Grounded</div>
        </div>
      </div>

      {/* Dynamic Conversation Display */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-2xl text-center flex flex-col gap-6 px-4 pointer-events-none">
        {transcription && (
          <div className="flex flex-col items-center gap-2 transition-all duration-300">
             <span className="text-[10px] text-cyan-500 uppercase tracking-widest bg-cyan-950/40 px-3 py-1 rounded border border-cyan-500/20">Listening</span>
             <div className="text-cyan-300/80 text-lg font-medium italic drop-shadow-md max-w-lg">
              "{transcription}"
            </div>
          </div>
        )}
        {aiResponse && (
          <div className="flex flex-col items-center gap-2 animate-fadeIn">
            <span className="text-[10px] text-gold-500 uppercase tracking-widest bg-gold-950/40 px-3 py-1 rounded border border-gold-500/20">BRAHMASTRA Response</span>
            <div className="text-cyan-50 text-2xl font-semibold tracking-wide drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] leading-relaxed">
              {aiResponse}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 pointer-events-auto">
        <button 
          onClick={() => setShowProtocols(true)}
          className="flex flex-col items-center group opacity-50 hover:opacity-100 transition-opacity"
        >
          <div className="w-10 h-10 rounded-lg border border-cyan-500/30 flex items-center justify-center mb-1 group-hover:bg-cyan-500/10 transition-colors">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-[10px] uppercase text-cyan-500 tracking-tighter">Protocols</span>
        </button>

        <button 
          onClick={() => setShowHistory(true)}
          className="flex flex-col items-center group opacity-50 hover:opacity-100 transition-opacity"
        >
          <div className="w-10 h-10 rounded-lg border border-cyan-500/30 flex items-center justify-center mb-1 group-hover:bg-cyan-500/10 transition-colors">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] uppercase text-cyan-500 tracking-tighter">History</span>
        </button>

        <button 
          onClick={onTogglePower}
          className={`group flex flex-col items-center transition-all ${status === ConnectionStatus.CONNECTING ? 'opacity-50 cursor-wait' : 'opacity-100'}`}
        >
          <div className={`w-16 h-16 rounded-full border-4 ${status === ConnectionStatus.CONNECTED ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'border-slate-700 bg-slate-800 hover:border-cyan-500'} flex items-center justify-center mb-2 transition-all`}>
            <svg className={`w-8 h-8 ${status === ConnectionStatus.CONNECTED ? 'text-cyan-200' : 'text-slate-500 group-hover:text-cyan-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            {status === ConnectionStatus.CONNECTED ? 'Shutdown' : 'Initialize'}
          </span>
        </button>

        <button 
          onClick={onToggleMute}
          className="flex flex-col items-center group opacity-50 hover:opacity-100 transition-opacity"
        >
          <div className={`w-10 h-10 rounded-lg border ${isMuted ? 'border-red-500 bg-red-500/10' : 'border-cyan-500/30'} flex items-center justify-center mb-1 group-hover:bg-cyan-500/10 transition-colors`}>
            {isMuted ? (
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </div>
          <span className={`text-[10px] uppercase tracking-tighter ${isMuted ? 'text-red-500' : 'text-cyan-500'}`}>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button 
          onClick={() => setShowScriptures(true)}
          className="flex flex-col items-center group opacity-50 hover:opacity-100 transition-opacity"
        >
          <div className="w-10 h-10 rounded-lg border border-gold-500/30 flex items-center justify-center mb-1 group-hover:bg-gold-500/10 transition-colors">
            <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.232.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="text-[10px] uppercase text-gold-500 tracking-tighter">Scriptures</span>
        </button>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.2)]">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-slate-950">
              <h3 className="text-lg font-bold text-cyan-100 uppercase tracking-widest flex items-center gap-3">
                <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Conversation Archives
              </h3>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={onClearHistory}
                  className="text-[10px] uppercase font-bold text-red-500/50 hover:text-red-500 transition-colors"
                >
                  Purge Data
                </button>
                <button onClick={() => setShowHistory(false)} className="text-cyan-500 hover:text-cyan-100 transition-colors text-xl font-bold">&times;</button>
              </div>
            </div>
            
            <div className="p-6 bg-slate-950/40 border-b border-cyan-500/10">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search interactions by keyword..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-slate-900 border border-cyan-500/20 rounded-lg p-4 pl-12 text-sm text-cyan-100 placeholder:text-cyan-900/50 focus:outline-none focus:border-cyan-400 transition-all"
                />
                <svg className="w-5 h-5 text-cyan-900 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {filteredHistory.length > 0 ? (
                filteredHistory.slice().reverse().map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-1 p-4 rounded border transition-all ${msg.role === 'user' ? 'bg-slate-950/30 border-cyan-500/10 ml-8' : 'bg-cyan-500/5 border-cyan-500/20 mr-8'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${msg.role === 'user' ? 'text-cyan-700' : 'text-gold-500'}`}>
                        {msg.role === 'user' ? 'Boss Directive' : 'Brahmastra Sync'}
                      </span>
                      <span className="text-[8px] text-cyan-900 font-mono">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-cyan-100 text-sm leading-relaxed font-sans">
                      {msg.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-cyan-900 text-center py-20 opacity-30">
                  <svg className="w-20 h-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-xs uppercase tracking-[0.2em]">No logs found in neural cache</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Protocols Modal */}
      {showProtocols && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.2)]">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-slate-950">
              <h3 className="text-lg font-bold text-cyan-100 uppercase tracking-widest">Administrative Protocols</h3>
              <button onClick={() => setShowProtocols(false)} className="text-cyan-500 hover:text-cyan-100 transition-colors text-xl font-bold">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {protocols.map(p => (
                <div key={p.id} className="group flex justify-between items-center bg-slate-950/50 p-4 rounded border border-cyan-500/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
                  <div className="flex-1">
                    <div className="text-cyan-400 text-[10px] font-bold uppercase mb-1 tracking-wider">Trigger</div>
                    <div className="text-cyan-100 font-semibold mb-2">"{p.phrase}"</div>
                    <div className="text-cyan-500/70 text-[11px] leading-relaxed italic border-t border-cyan-500/10 pt-2">{p.action}</div>
                  </div>
                  <button onClick={() => onRemoveProtocol(p.id)} className="ml-4 p-2 text-red-500/40 hover:text-red-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              <form onSubmit={handleAdd} className="mt-8 bg-cyan-950/20 p-5 rounded-lg border border-cyan-500/20 space-y-4">
                <div className="text-xs text-gold-500 uppercase font-bold tracking-widest">New System Directive</div>
                <input 
                  type="text" placeholder="Phrase (e.g. Activate Silent Mode)" value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  className="w-full bg-slate-950 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400 transition-all"
                />
                <textarea 
                  placeholder="BRAHMASTRA Action Sequence..." value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full bg-slate-950 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400 min-h-[100px]"
                />
                <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black py-3 rounded text-xs uppercase tracking-[0.2em] transition-all">Deploy Directive</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Scripture Search Modal */}
      {showScriptures && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-gold-500/40 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.1)]">
            <div className="p-6 border-b border-gold-500/20 flex justify-between items-center bg-gradient-to-r from-slate-950 to-slate-900">
              <h3 className="text-lg font-bold text-gold-100 uppercase tracking-[0.3em]">Scriptural Knowledge Vault</h3>
              <button onClick={() => setShowScriptures(false)} className="text-gold-500 hover:text-gold-100 text-xl font-bold">&times;</button>
            </div>
            <div className="p-6 bg-slate-950/40">
              <form onSubmit={handleScriptureSearch} className="flex gap-3">
                <input 
                  type="text" placeholder="Inquire about Dharma, Karma, or specific Vedic verses..."
                  value={scriptureQuery} onChange={(e) => setScriptureQuery(e.target.value)}
                  className="flex-1 bg-slate-900 border border-gold-500/20 rounded-lg p-4 text-sm text-gold-50 placeholder:text-gold-900/40 focus:outline-none focus:border-gold-500/60 transition-all"
                />
                <button type="submit" disabled={isSearchingScriptures} className="bg-gold-600 hover:bg-gold-500 disabled:opacity-50 text-slate-950 font-black px-8 rounded-lg text-xs uppercase transition-all">
                  {isSearchingScriptures ? 'Scanning...' : 'Decode'}
                </button>
              </form>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {scriptureResults ? (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-l-4 border-gold-500/50 pl-6 py-2 bg-gold-500/5 rounded-r-lg">
                    <div className="text-[10px] text-gold-500 uppercase font-black mb-3 tracking-widest">Brahma Analysis Output</div>
                    <div className="text-gold-50 text-base leading-relaxed whitespace-pre-wrap font-sans">
                      {scriptureResults.explanation}
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-5 border border-gold-500/10">
                    <div className="text-[10px] text-gold-500 uppercase font-bold mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-pulse"></div>
                      Authentication Sources
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {scriptureResults.urls.map((u, i) => (
                        <a key={i} href={u.web.uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] text-cyan-400 hover:text-gold-400 transition-colors bg-slate-900 p-2 rounded border border-cyan-500/5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          <span className="truncate">{u.web.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : isSearchingScriptures ? (
                <div className="space-y-4 animate-pulse py-10">
                  <div className="h-6 bg-gold-500/10 rounded w-3/4"></div>
                  <div className="h-4 bg-gold-500/5 rounded w-full"></div>
                  <div className="h-4 bg-gold-500/5 rounded w-5/6"></div>
                  <div className="h-32 bg-gold-500/5 rounded w-full mt-10"></div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gold-500/20 text-center py-20">
                  <svg className="w-24 h-24 mb-6 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.232.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <p className="text-xs uppercase tracking-[0.4em]">Vault offline... initialize scriptural search sequence.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - System Logs */}
      <div className="absolute left-8 bottom-8 w-64 h-48 bg-cyan-950/20 border border-cyan-500/10 rounded p-4 backdrop-blur-md pointer-events-none">
        <div className="text-[10px] text-cyan-400 mb-2 border-b border-cyan-500/30 pb-1 flex justify-between font-bold">
          <span>REAL-TIME OPS LOG</span>
          <span className="text-[8px]">PRIORITY: ADMIN</span>
        </div>
        <div className="text-[9px] font-mono text-cyan-500/80 space-y-1.5 overflow-hidden h-[120px] custom-scrollbar scroll-smooth">
          {commandLogs.map((log, i) => (
            <div key={i} className={`flex gap-2 ${i === commandLogs.length - 1 ? "animate-pulse text-cyan-200" : "opacity-80"}`}>
              <span className="opacity-40">[{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
              <span className="truncate">{log}</span>
            </div>
          ))}
          <div className="text-gold-500/40 leading-tight mt-3 italic">&gt; Listening for system override...</div>
        </div>
      </div>

      {/* Sidebar - Stats */}
      <div className="absolute right-8 bottom-8 w-64 h-48 bg-cyan-950/20 border border-cyan-500/10 rounded p-4 backdrop-blur-md pointer-events-none">
        <div className="text-[10px] text-cyan-400 mb-2 border-b border-cyan-500/30 pb-1 font-bold">OS CORE VITALITY</div>
        <div className="space-y-4 mt-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[9px] text-cyan-500 uppercase font-bold">
              <span>Power Allocation</span>
              <span>{systemStats.power}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/10">
              <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000" style={{ width: `${systemStats.power}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[9px] text-cyan-500 uppercase font-bold">
              <span>Memory Integrity</span>
              <span>{systemStats.memory}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/10">
              <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 animate-pulse transition-all duration-1000" style={{ width: `${systemStats.memory}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[9px] text-gold-500 uppercase font-bold">
              <span>Dharma Processor</span>
              <span>{systemStats.logic}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-gold-500/10">
              <div className="h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-1000" style={{ width: `${systemStats.logic}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(6, 182, 212, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(234, 179, 8, 0.3); border-radius: 10px; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
      `}</style>
    </div>
  );
};

export default HUD;
