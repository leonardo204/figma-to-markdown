import type { ExtractedFrame } from '../types/figma';
import type {
  LLMConfig,
  TranslationLanguage,
  FrameConversionResult,
  SequentialProgress,
  SequentialConversionResult,
} from '../types';
import { callLLM } from './llm-client';
import {
  MARKDOWN_SYSTEM_PROMPT,
  createMarkdownUserPrompt,
  SEQUENTIAL_SYSTEM_PROMPT,
  createSequentialUserPrompt,
} from '../prompts/markdown-conversion';
import { TRANSLATION_SYSTEM_PROMPT, createTranslationPrompt } from '../prompts/translation';
import { mergeMarkdownResults, aggregateTokenUsage } from './markdown-merger';

export interface ConversionOptions {
  config: LLMConfig;
  frames: ExtractedFrame[];
  translateTo: TranslationLanguage;
  onProgress?: (status: string) => void;
  onRetryWait?: (remainingSeconds: number) => void;
  onFrameProgress?: (progress: SequentialProgress) => void;
}

export interface ConversionResult {
  markdown: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  frameResults?: FrameConversionResult[];
  failedFrames?: Array<{ frameName: string; error: string }>;
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

// 순차 처리 임계값 (이 수 이상이면 순차 처리)
const SEQUENTIAL_THRESHOLD = 4;

// Figma 프레임 데이터를 Markdown으로 변환 (자동 전환)
export async function convertToMarkdown(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { frames } = options;

  // 프레임 수에 따라 자동 전환
  if (frames.length >= SEQUENTIAL_THRESHOLD) {
    return convertToMarkdownSequential(options);
  }

  return convertToMarkdownBatch(options);
}

// 일괄 처리 (3개 이하 프레임)
async function convertToMarkdownBatch(
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

// 순차 처리 응답 파싱
function parseSequentialResponse(response: string): { markdown: string; summary: string } {
  const markdownMatch = response.match(/---MARKDOWN---\s*([\s\S]*?)\s*---SUMMARY---/);
  const summaryMatch = response.match(/---SUMMARY---\s*([\s\S]*)$/);

  if (markdownMatch && summaryMatch) {
    return {
      markdown: stripCodeBlockWrapper(markdownMatch[1].trim()),
      summary: summaryMatch[1].trim(),
    };
  }

  // 형식이 맞지 않으면 전체를 markdown으로 처리
  return {
    markdown: stripCodeBlockWrapper(response),
    summary: '(요약 없음)',
  };
}

// 순차 처리 (4개 이상 프레임)
async function convertToMarkdownSequential(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { config, frames, translateTo, onProgress, onRetryWait, onFrameProgress } = options;

  const results: FrameConversionResult[] = [];
  const failedFrames: Array<{ frameName: string; error: string }> = [];
  const summaries: string[] = [];

  // 각 프레임 순차 처리
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // 진행률 콜백
    onFrameProgress?.({
      currentFrame: i + 1,
      totalFrames: frames.length,
      frameName: frame.name,
      phase: 'converting',
    });
    onProgress?.(`${i + 1}/${frames.length} 변환 중: ${frame.name}`);

    try {
      // 프레임 데이터 직렬화
      const frameDataJson = JSON.stringify(frame, null, 2);

      // LLM 호출
      const response = await callLLM(config, {
        messages: [
          { role: 'system', content: SEQUENTIAL_SYSTEM_PROMPT },
          {
            role: 'user',
            content: createSequentialUserPrompt(
              frameDataJson,
              frame.name,
              i,
              frames.length,
              summaries
            ),
          },
        ],
        maxTokens: 4096,
        temperature: 0.3,
        onRetryWait: (seconds) => {
          onFrameProgress?.({
            currentFrame: i + 1,
            totalFrames: frames.length,
            frameName: frame.name,
            phase: 'retrying',
            retryCountdown: seconds,
          });
          onRetryWait?.(seconds);
        },
      });

      // 응답 파싱
      const { markdown, summary } = parseSequentialResponse(response.content);

      // 결과 저장
      results.push({
        frameId: frame.id,
        frameName: frame.name,
        markdown,
        contextSummary: summary,
        usage: response.usage,
      });

      // 다음 프레임을 위한 컨텍스트 저장
      summaries.push(summary);
    } catch (error) {
      // 개별 프레임 실패 시 기록하고 계속 진행
      failedFrames.push({
        frameName: frame.name,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      });

      // 실패한 프레임도 컨텍스트에 기록 (연속성 유지)
      summaries.push(`[변환 실패: ${frame.name}]`);
    }
  }

  // 결과 병합
  onFrameProgress?.({
    currentFrame: frames.length,
    totalFrames: frames.length,
    frameName: '결과 병합',
    phase: 'merging',
  });
  onProgress?.('결과 병합 중...');

  let markdown = mergeMarkdownResults({
    frameResults: results,
    addTableOfContents: results.length >= 4,
  });

  // 토큰 사용량 합산
  let totalUsage = aggregateTokenUsage(results);

  // 번역 (필요한 경우)
  if (translateTo !== 'none') {
    onFrameProgress?.({
      currentFrame: frames.length,
      totalFrames: frames.length,
      frameName: '번역',
      phase: 'translating',
    });
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
    frameResults: results,
    failedFrames: failedFrames.length > 0 ? failedFrames : undefined,
  };
}
