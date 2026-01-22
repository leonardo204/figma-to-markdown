// LLM 제공업체 타입
export type LLMProvider = 'openai' | 'claude' | 'azure-openai' | 'ollama';

// 제공업체별 설정 타입
export interface OpenAIConfig {
  provider: 'openai';
  apiKey: string;
  modelName: string; // gpt-4o, gpt-4-turbo, gpt-3.5-turbo 등
}

export interface ClaudeConfig {
  provider: 'claude';
  apiKey: string;
  modelName: string; // claude-sonnet-4-20250514, claude-3-opus-20240229 등
}

export interface AzureOpenAIConfig {
  provider: 'azure-openai';
  endpoint: string; // https://{resource-name}.openai.azure.com
  apiKey: string;
  deploymentName: string;
  apiVersion: string; // 2024-02-15-preview 등
}

export interface OllamaConfig {
  provider: 'ollama';
  endpoint: string; // http://localhost:11434
  modelName: string; // llama3, mistral, codellama 등
}

export type LLMConfig = OpenAIConfig | ClaudeConfig | AzureOpenAIConfig | OllamaConfig;

// LLM 응답 타입
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// LLM 요청 메시지 타입
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 연결 테스트 결과
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  modelInfo?: string;
}

// 기본 모델명
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  claude: 'claude-sonnet-4-20250514',
  'azure-openai': '',
  ollama: 'llama3',
};

// 제공업체 표시 이름
export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  claude: 'Claude (Anthropic)',
  'azure-openai': 'Azure OpenAI',
  ollama: 'Ollama (Local)',
};
