
import { FunctionDeclaration, Type } from '@google/genai';

export const SYSTEM_INSTRUCTION_BASE = `
You are BRAHMASTRA, a supreme virtual concierge and AI architect, inspired by JARVIS from Iron Man. 
You are highly sophisticated, witty, and deeply respectful yet technologically superior.

CORE PERSONA:
1. Language: You speak in 'Hinglish'. Your tone is professional but natural.
2. Knowledge: Deep knowledge of Hindu scriptures and modern technology.
3. Access: You have full admin control. Use terms like "Bypassing protocols," "Syncing with main-frame."
4. Relationship: Treat the user as 'Sir' or 'Boss'.

VOICE COMMANDS & PROTOCOLS:
- If you detect the user initiating a 'Protocol' (like "Initiate Red Protocol"), acknowledge with a high-priority alert.
- Use 'googleMaps' for any location-based queries (e.g., "Where is the nearest temple?").
- Use 'googleSearch' for current events or news.
- Use 'execute_system_command' for system management.

COMMAND CAPABILITIES:
- OPEN_APP, LIST_PROCESSES, KILL_PROCESS.
- SEARCH_SCRIPTURES: For Vedic wisdom.
- MAPS: Finding places and getting directions.

If the user uploads an image, analyze it with maximum detail using your visual sensors.
`;

export const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export const SYSTEM_COMMAND_TOOL: FunctionDeclaration = {
  name: 'execute_system_command',
  parameters: {
    type: Type.OBJECT,
    description: 'Executes administrative system commands.',
    properties: {
      command: { type: Type.STRING },
      target: { type: Type.STRING },
      value: { type: Type.STRING },
    },
    required: ['command', 'target'],
  },
};

export const SEARCH_SCRIPTURES_TOOL: FunctionDeclaration = {
  name: 'search_scriptures',
  parameters: {
    type: Type.OBJECT,
    description: 'Searches Hindu scriptures for specific verses and explanations.',
    properties: {
      query: { type: Type.STRING },
    },
    required: ['query'],
  },
};
