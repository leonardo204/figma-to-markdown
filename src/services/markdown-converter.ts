import type { ExtractedFrame } from '../types/figma';
import type { LLMConfig, TranslationLanguage } from '../types';
import { callLLM } from './llm-client';
import {
  MARKDOWN_SYSTEM_PROMPT,
  createMarkdownUserPrompt,
} from '../prompts/markdown-conversion';
import { TRANSLATION_SYSTEM_PROMPT, createTranslationPrompt } from '../prompts/translation';

export interface ConversionOptions {
  config: LLMConfig;
  frames: ExtractedFrame[];
  translateTo: TranslationLanguage;
  onProgress?: (status: string) => void;
  onRetryWait?: (remainingSeconds: number) => void;
}

export interface ConversionResult {
  markdown: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// LLM 응답에서 코드 블록 래퍼 제거
function stripCodeBlockWrapper(text: string): string {
  let result = text.trim();

  // ```markdown 또는 ```md로 시작하는 경우 제거
  const startPattern = /^```(?:markdown|md)?\s*\n?/i;
  if (startPattern.test(result)) {
    result = result.replace(startPattern, '');
  }

  // 마지막 ```제거
  const endPattern = /\n?```\s*$/;
  if (endPattern.test(result)) {
    result = result.replace(endPattern, '');
  }

  return result.trim();
}

// Figma 프레임 데이터를 Markdown으로 변환
export async function convertToMarkdown(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { config, frames, translateTo, onProgress, onRetryWait } = options;

  // 1단계: 프레임 데이터를 JSON으로 직렬화
  onProgress?.('프레임 데이터 분석 중...');
  const frameDataJson = JSON.stringify(frames, null, 2);

  // 2단계: LLM에 Markdown 변환 요청
  onProgress?.('Markdown 변환 중...');
  const markdownResponse = await callLLM(config, {
    messages: [
      { role: 'system', content: MARKDOWN_SYSTEM_PROMPT },
      { role: 'user', content: createMarkdownUserPrompt(frameDataJson) },
    ],
    maxTokens: 8192,
    temperature: 0.3,
    onRetryWait,
  });

  let markdown = stripCodeBlockWrapper(markdownResponse.content);
  let totalUsage = markdownResponse.usage;

  // 3단계: 번역 (필요한 경우)
  if (translateTo !== 'none') {
    onProgress?.(`${translateTo}로 번역 중...`);
    const translationResponse = await callLLM(config, {
      messages: [
        { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
        { role: 'user', content: createTranslationPrompt(markdown, translateTo) },
      ],
      maxTokens: 8192,
      temperature: 0.3,
      onRetryWait,
    });

    markdown = stripCodeBlockWrapper(translationResponse.content);

    // 토큰 사용량 합산
    if (totalUsage && translationResponse.usage) {
      totalUsage = {
        promptTokens: totalUsage.promptTokens + translationResponse.usage.promptTokens,
        completionTokens:
          totalUsage.completionTokens + translationResponse.usage.completionTokens,
        totalTokens: totalUsage.totalTokens + translationResponse.usage.totalTokens,
      };
    }
  }

  onProgress?.('완료!');

  return {
    markdown,
    usage: totalUsage,
  };
}
