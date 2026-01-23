import type { LLMConfig, LLMProvider } from '../types/llm';
import type { PluginMessage } from '../types/figma';

const STORAGE_KEY = 'llm-config';

// 메시지 리스너 등록 (한 번만)
let messageHandler: ((event: MessageEvent) => void) | null = null;
const pendingCallbacks: Map<string, (value: string | null) => void> = new Map();

function ensureMessageHandler() {
  if (messageHandler) return;

  messageHandler = (event: MessageEvent) => {
    const message = event.data.pluginMessage as PluginMessage;
    if (!message) return;

    if (message.type === 'storage-loaded') {
      const callback = pendingCallbacks.get(message.key);
      if (callback) {
        callback(message.value);
        pendingCallbacks.delete(message.key);
      }
    }
  };

  window.addEventListener('message', messageHandler);
}

// 저장된 설정 로드 (figma.clientStorage 사용)
export async function loadConfig(): Promise<LLMConfig | null> {
  ensureMessageHandler();

  return new Promise((resolve) => {
    // 콜백 등록
    pendingCallbacks.set(STORAGE_KEY, (value) => {
      if (value) {
        try {
          const config = JSON.parse(value) as LLMConfig;
          resolve(config);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    // 메시지 전송
    parent.postMessage(
      { pluginMessage: { type: 'load-storage', key: STORAGE_KEY } },
      '*'
    );

    // 타임아웃 (3초)
    setTimeout(() => {
      if (pendingCallbacks.has(STORAGE_KEY)) {
        pendingCallbacks.delete(STORAGE_KEY);
        resolve(null);
      }
    }, 3000);
  });
}

// 설정 저장 (figma.clientStorage 사용)
export async function saveConfig(config: LLMConfig): Promise<void> {
  parent.postMessage(
    {
      pluginMessage: {
        type: 'save-storage',
        key: STORAGE_KEY,
        value: JSON.stringify(config),
      },
    },
    '*'
  );
}

// 설정 삭제
export async function clearConfig(): Promise<void> {
  parent.postMessage(
    {
      pluginMessage: {
        type: 'save-storage',
        key: STORAGE_KEY,
        value: '',
      },
    },
    '*'
  );
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
