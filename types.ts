
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

export interface SystemStatus {
  core: 'stable' | 'warning' | 'critical';
  memory: string;
  knowledgeBase: string;
  accessLevel: 'Admin' | 'User';
}

export interface Protocol {
  id: string;
  phrase: string;
  action: string;
}

export interface ScriptureResult {
  shloka?: string;
  translation?: string;
  explanation: string;
  source: string;
  urls: { web: { uri: string; title: string } }[];
}
