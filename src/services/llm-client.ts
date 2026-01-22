import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  ConnectionTestResult,
} from '../types/llm';

// 공통 요청 인터페이스
interface RequestOptions {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  onRetryWait?: (remainingSeconds: number) => void;
}

// Rate Limit 에러 감지
interface RateLimitError extends Error {
  isRateLimit: true;
  retryAfter: number;
}

function isRateLimitError(error: unknown): error is RateLimitError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429') ||
      message.includes('quota') ||
      message.includes('exceeded')
    );
  }
  return false;
}

function parseRetryAfter(errorMessage: string): number {
  // "retry after X seconds" 패턴에서 숫자 추출
  const match = errorMessage.match(/retry\s*after\s*(\d+)\s*seconds?/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  // 기본 60초
  return 60;
}

// 대기 함수 (카운트다운 콜백 지원)
async function waitWithCountdown(
  seconds: number,
  onTick?: (remaining: number) => void
): Promise<void> {
  for (let remaining = seconds; remaining > 0; remaining--) {
    onTick?.(remaining);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  onTick?.(0);
}

// OpenAI API 호출
async function callOpenAI(
  config: Extract<LLMConfig, { provider: 'openai' }>,
  options: RequestOptions
): Promise<LLMResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: options.messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `OpenAI API 오류: ${response.status}`
    );
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

// Claude API 호출
async function callClaude(
  config: Extract<LLMConfig, { provider: 'claude' }>,
  options: RequestOptions
): Promise<LLMResponse> {
  // system 메시지 분리
  const systemMessage = options.messages.find((m) => m.role === 'system');
  const otherMessages = options.messages.filter((m) => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.modelName,
      max_tokens: options.maxTokens || 4096,
      system: systemMessage?.content,
      messages: otherMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Claude API 오류: ${response.status}`
    );
  }

  const data = await response.json();
  return {
    content: data.content[0]?.text || '',
    usage: data.usage
      ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  };
}

// Azure OpenAI API 호출
async function callAzureOpenAI(
  config: Extract<LLMConfig, { provider: 'azure-openai' }>,
  options: RequestOptions
): Promise<LLMResponse> {
  const url = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      messages: options.messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Azure OpenAI API 오류: ${response.status}`
    );
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

// Ollama API 호출
async function callOllama(
  config: Extract<LLMConfig, { provider: 'ollama' }>,
  options: RequestOptions
): Promise<LLMResponse> {
  const url = `${config.endpoint}/api/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: options.messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Ollama API 오류: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.message?.content || '',
    usage: data.eval_count
      ? {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count || 0) + data.eval_count,
        }
      : undefined,
  };
}

// 내부 LLM 호출 (재시도 없음)
async function callLLMInternal(
  config: LLMConfig,
  options: RequestOptions
): Promise<LLMResponse> {
  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, options);
    case 'claude':
      return callClaude(config, options);
    case 'azure-openai':
      return callAzureOpenAI(config, options);
    case 'ollama':
      return callOllama(config, options);
    default:
      throw new Error('지원하지 않는 LLM 제공업체입니다');
  }
}

// 통합 LLM 호출 함수 (자동 재시도 포함)
export async function callLLM(
  config: LLMConfig,
  options: RequestOptions,
  maxRetries: number = 3
): Promise<LLMResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callLLMInternal(config, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Rate limit 에러인 경우 대기 후 재시도
      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const retryAfter = parseRetryAfter(lastError.message);
        await waitWithCountdown(retryAfter, options.onRetryWait);
        continue;
      }

      // 다른 에러는 즉시 throw
      throw lastError;
    }
  }

  throw lastError || new Error('알 수 없는 오류가 발생했습니다');
}

// 연결 테스트
export async function testConnection(
  config: LLMConfig
): Promise<ConnectionTestResult> {
  try {
    await callLLM(config, {
      messages: [
        {
          role: 'user',
          content: 'Hello, please respond with "Connection successful!"',
        },
      ],
      maxTokens: 50,
    }, 1); // 테스트는 재시도 없이

    return {
      success: true,
      message: '연결 성공!',
      modelInfo: `모델: ${config.provider === 'azure-openai' ? config.deploymentName : config.provider === 'openai' || config.provider === 'claude' || config.provider === 'ollama' ? config.modelName : 'Unknown'}`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : '연결 테스트 중 오류가 발생했습니다',
    };
  }
}
