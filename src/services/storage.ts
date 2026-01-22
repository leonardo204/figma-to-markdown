import type { LLMConfig, LLMProvider } from '../types/llm';

const STORAGE_KEY = 'llm-config';

// 저장된 설정 로드
export async function loadConfig(): Promise<LLMConfig | null> {
  return new Promise((resolve) => {
    parent.postMessage(
      { pluginMessage: { type: 'load-storage', key: STORAGE_KEY } },
      '*'
    );

    // 로컬 스토리지에서 직접 로드 (UI iframe 환경)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored) as LLMConfig;
        resolve(config);
        return;
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }

    resolve(null);
  });
}

// 설정 저장
export async function saveConfig(config: LLMConfig): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage 접근 실패 시 무시
    console.warn('localStorage 저장 실패');
  }
}

// 설정 삭제
export async function clearConfig(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage 접근 실패 시 무시
  }
}

// 기본 설정 생성
export function createDefaultConfig(provider: LLMProvider): LLMConfig {
  switch (provider) {
    case 'openai':
      return {
        provider: 'openai',
        apiKey: '',
        modelName: 'gpt-4o',
      };
    case 'claude':
      return {
        provider: 'claude',
        apiKey: '',
        modelName: 'claude-sonnet-4-20250514',
      };
    case 'azure-openai':
      return {
        provider: 'azure-openai',
        endpoint: '',
        apiKey: '',
        deploymentName: '',
        apiVersion: '2024-02-15-preview',
      };
    case 'gemini':
      return {
        provider: 'gemini',
        apiKey: '',
        modelName: 'gemini-2.0-flash',
      };
    case 'groq':
      return {
        provider: 'groq',
        apiKey: '',
        modelName: 'llama-3.3-70b-versatile',
      };
    case 'ollama':
      return {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        modelName: 'llama3',
      };
  }
}

// 설정 유효성 검사
export function isConfigValid(config: LLMConfig | null): boolean {
  if (!config) return false;

  switch (config.provider) {
    case 'openai':
      return !!(config.apiKey && config.modelName);
    case 'claude':
      return !!(config.apiKey && config.modelName);
    case 'azure-openai':
      return !!(
        config.endpoint &&
        config.apiKey &&
        config.deploymentName &&
        config.apiVersion
      );
    case 'gemini':
      return !!(config.apiKey && config.modelName);
    case 'groq':
      return !!(config.apiKey && config.modelName);
    case 'ollama':
      return !!(config.endpoint && config.modelName);
    default:
      return false;
  }
}
