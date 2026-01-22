// Figma 데이터 추출 유틸리티
// 참고: 실제 추출 로직은 code.ts에서 수행 (Figma API 접근 필요)
// 이 파일은 UI에서 사용하는 유틸리티 함수들

import type { ExtractedFrame, ExtractedNode, ExtractedTextNode } from '../types/figma';

// 프레임에서 모든 텍스트 노드 추출 (평탄화)
export function flattenTextNodes(frame: ExtractedFrame): ExtractedTextNode[] {
  const texts: ExtractedTextNode[] = [];

  function traverse(nodes: ExtractedNode[]) {
    for (const node of nodes) {
      if (node.type === 'text') {
        texts.push(node);
      } else if (node.type === 'frame' || node.type === 'group' || node.type === 'component' || node.type === 'instance') {
        traverse(node.children);
      }
    }
  }

  traverse(frame.children);
  return texts;
}

// 프레임 요약 정보 생성
export function summarizeFrame(frame: ExtractedFrame): {
  textCount: number;
  shapeCount: number;
  imageCount: number;
  frameCount: number;
} {
  let textCount = 0;
  let shapeCount = 0;
  let imageCount = 0;
  let frameCount = 0;

  function traverse(nodes: ExtractedNode[]) {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          textCount++;
          break;
        case 'shape':
          shapeCount++;
          break;
        case 'image':
          imageCount++;
          break;
        case 'frame':
        case 'group':
        case 'component':
        case 'instance':
          frameCount++;
          traverse(node.children);
          break;
      }
    }
  }

  traverse(frame.children);
  return { textCount, shapeCount, imageCount, frameCount };
}

// 프레임 데이터를 간략한 설명 문자열로 변환
export function describeFrame(frame: ExtractedFrame): string {
  const summary = summarizeFrame(frame);
  const parts: string[] = [];

  if (summary.textCount > 0) parts.push(`텍스트 ${summary.textCount}개`);
  if (summary.shapeCount > 0) parts.push(`도형 ${summary.shapeCount}개`);
  if (summary.imageCount > 0) parts.push(`이미지 ${summary.imageCount}개`);
  if (summary.frameCount > 0) parts.push(`프레임 ${summary.frameCount}개`);

  return parts.length > 0 ? parts.join(', ') : '빈 프레임';
}
