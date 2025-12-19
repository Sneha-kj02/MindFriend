export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
}

export interface AnalysisData {
  mood: string;
  symptoms: string[];
  solutions: string[];
  summary: string;
  disclaimer: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  SENDING = 'SENDING',
  ANALYZING = 'ANALYZING',
}
