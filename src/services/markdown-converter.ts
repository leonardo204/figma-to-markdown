import type { ExtractedFrame, ExtractedNode, ExtractedImageNode } from '../types/figma';
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

// 요청 간 딜레이 (ms) - Rate limit 회피용
const REQUEST_DELAY_MS = 3000;

// 이미지 데이터 구조
interface ImageData {
  id: string;
  name: string;
  base64Data: string;
}

// 단일 프레임에서 이미지 데이터 수집
function collectImagesFromFrame(frame: ExtractedFrame): ImageData[] {
  const images: ImageData[] = [];

  function collectImages(node: ExtractedNode) {
    if (node.type === 'image') {
      const imageNode = node as ExtractedImageNode;
      if (imageNode.base64Data) {
        images.push({
          id: imageNode.id,
          name: imageNode.name,
          base64Data: imageNode.base64Data,
        });
      }
    }

    if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach(collectImages);
    }
  }

  frame.children.forEach(collectImages);
  return images;
}

// 모든 프레임에서 이미지 데이터 수집
function collectAllImages(frames: ExtractedFrame[]): ImageData[] {
  const images: ImageData[] = [];
  frames.forEach((frame) => {
    images.push(...collectImagesFromFrame(frame));
  });
  return images;
}

// IMAGE_REF:nodeId를 실제 base64 데이터로 치환
function replaceImageReferences(markdown: string, images: ImageData[]): string {
  let result = markdown;

  // 1. ![설명](IMAGE_REF:nodeId) 패턴 매칭
  result = result.replace(
    /!\[([^\]]*)\]\(IMAGE_REF:([^)]+)\)/g,
    (match, description, nodeId) => {
      const image = images.find((img) => img.id === nodeId);
      if (image) {
        return `![${description}](${image.base64Data})`;
      }
      // base64 데이터가 없으면 텍스트로 대체
      return `**[이미지: ${description}]**`;
    }
  );

  // 2. **[이미지: 설명]** 패턴을 실제 이미지로 치환 (LLM이 잘못된 형식 출력 시 fallback)
  if (images.length > 0) {
    let imageIndex = 0;
    result = result.replace(
      /\*\*\[이미지:\s*([^\]]+)\]\*\*/g,
      (match, description) => {
        if (imageIndex < images.length) {
          const image = images[imageIndex];
          imageIndex++;
          return `![${description.trim()}](${image.base64Data})`;
        }
        return match;
      }
    );
  }

  return result;
}

// 닫히지 않은 Mermaid 코드 블록 수정
function fixUnclosedMermaidBlocks(markdown: string): string {
  // mermaid 코드 블록 찾기
  const mermaidPattern = /```mermaid\s*([\s\S]*?)(?:```|$)/g;
  let result = markdown;
  let lastIndex = 0;
  const parts: string[] = [];

  let match;
  while ((match = mermaidPattern.exec(markdown)) !== null) {
    // 이전 부분 추가
    parts.push(markdown.slice(lastIndex, match.index));

    const fullMatch = match[0];
    const content = match[1];

    // 닫는 ``` 가 없는 경우 추가
    if (!fullMatch.endsWith('```')) {
      parts.push('```mermaid\n' + content.trim() + '\n```');
    } else {
      parts.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  // 나머지 부분 추가
  parts.push(markdown.slice(lastIndex));

  return parts.join('');
}

// 딜레이 함수
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 노드 데이터 간소화 (position, size 제거, 텍스트와 구조만 유지)
function simplifyNode(node: ExtractedNode): Record<string, unknown> {
  const simplified: Record<string, unknown> = {
    type: node.type,
    name: node.name,
  };

  // 텍스트 노드: 텍스트 내용과 스타일 정보만 유지
  if (node.type === 'text') {
    const textNode = node as ExtractedNode & { characters?: string; fontSize?: number; fontWeight?: number };
    simplified.characters = textNode.characters;
    if (textNode.fontSize) simplified.fontSize = textNode.fontSize;
    if (textNode.fontWeight) simplified.fontWeight = textNode.fontWeight;
  }

  // 이미지 노드: id 유지 (후처리에서 base64 치환용)
  if (node.type === 'image') {
    simplified.id = node.id;
    simplified.hasBase64 = true; // base64 데이터가 있음을 표시
  }

  // 컨테이너 노드: 자식만 재귀적으로 간소화
  if ('children' in node && Array.isArray(node.children)) {
    simplified.children = node.children.map(simplifyNode);
  }

  // 레이아웃 모드 (구조 파악에 유용)
  if ('layoutMode' in node && node.layoutMode) {
    simplified.layoutMode = node.layoutMode;
  }

  // 도형 타입 (구조 파악에 유용)
  if (node.type === 'shape' && 'shapeType' in node) {
    simplified.shapeType = (node as ExtractedNode & { shapeType: string }).shapeType;
  }

  return simplified;
}

// 프레임 데이터 간소화
function simplifyFrameData(frame: ExtractedFrame): Record<string, unknown> {
  return {
    name: frame.name,
    children: frame.children.map(simplifyNode),
  };
}

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
// Rate limit 회피를 위해 항상 순차 처리
const SEQUENTIAL_THRESHOLD = 1;

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

  // 이미지 데이터 수집 (후처리용)
  const images = collectAllImages(frames);

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

  // 후처리: Mermaid 코드 블록 닫기 수정
  markdown = fixUnclosedMermaidBlocks(markdown);

  // 후처리: 이미지 참조를 실제 base64 데이터로 치환
  markdown = replaceImageReferences(markdown, images);

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

    // 이 프레임의 이미지 수집 (프레임별 이미지 치환용)
    const frameImages = collectImagesFromFrame(frame);

    // 진행률 콜백
    onFrameProgress?.({
      currentFrame: i + 1,
      totalFrames: frames.length,
      frameName: frame.name,
      phase: 'converting',
    });
    onProgress?.(`${i + 1}/${frames.length} 변환 중: ${frame.name}`);

    try {
      // 프레임 데이터 간소화 및 직렬화 (토큰 절약)
      const simplifiedFrame = simplifyFrameData(frame);
      const frameDataJson = JSON.stringify(simplifiedFrame, null, 2);

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
      let { markdown, summary } = parseSequentialResponse(response.content);

      // 프레임별 이미지 치환 (병합 전에 각 프레임의 이미지로 치환)
      markdown = replaceImageReferences(markdown, frameImages);

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

      // Rate limit 회피를 위한 딜레이 (마지막 프레임 제외)
      if (i < frames.length - 1) {
        await delay(REQUEST_DELAY_MS);
      }
    } catch (error) {
      // 개별 프레임 실패 시 기록하고 계속 진행
      failedFrames.push({
        frameName: frame.name,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      });

      // 실패한 프레임도 컨텍스트에 기록 (연속성 유지)
      summaries.push(`[변환 실패: ${frame.name}]`);

      // Rate limit 회피를 위한 딜레이 (마지막 프레임 제외)
      if (i < frames.length - 1) {
        await delay(REQUEST_DELAY_MS);
      }
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

  // 후처리: Mermaid 코드 블록 닫기 수정
  markdown = fixUnclosedMermaidBlocks(markdown);

  // 이미지는 이미 프레임별로 치환되었으므로 전역 치환 불필요

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
