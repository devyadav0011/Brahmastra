
export type ThemeType = 'Indigo' | 'Saffron' | 'Emerald';

export interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: 'Running' | 'Suspended' | 'Critical';
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface Protocol {
  id: string;
  phrase: string;
  action: string;
}

export interface CommandShortcut {
  id: string;
  alias: string;
  command: string;
  description: string;
}

export interface ScriptureResult {
  shloka?: string;
  translation?: string;
  explanation: string;
  source: string;
  urls: { web: { uri: string; title: string } }[];
}
