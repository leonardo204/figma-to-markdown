export * from './llm';
export * from './figma';

// 번역 언어 옵션
export type TranslationLanguage =
  | 'none'
  | 'en'
  | 'ko'
  | 'ja'
  | 'zh-CN'
  | 'zh-TW'
  | 'de'
  | 'fr'
  | 'es';

export const LANGUAGE_LABELS: Record<TranslationLanguage, string> = {
  none: '번역 없음',
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

// 앱 상태
export type AppTab = 'settings' | 'convert';

export interface AppState {
  currentTab: AppTab;
  isConfigured: boolean;
  isConverting: boolean;
  conversionResult: string | null;
  error: string | null;
}

// 토큰 사용량
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 프레임별 변환 결과
export interface FrameConversionResult {
  frameId: string;
  frameName: string;
  markdown: string;
  contextSummary: string;
  usage?: TokenUsage;
}

// 순차 처리 진행 상태
export type SequentialPhase = 'converting' | 'retrying' | 'merging' | 'translating';

export interface SequentialProgress {
  currentFrame: number;
  totalFrames: number;
  frameName: string;
  phase: SequentialPhase;
  retryCountdown?: number;
}

// 순차 변환 결과
export interface SequentialConversionResult {
  markdown: string;
  frameResults: FrameConversionResult[];
  totalUsage?: TokenUsage;
  failedFrames?: Array<{ frameName: string; error: string }>;
}
