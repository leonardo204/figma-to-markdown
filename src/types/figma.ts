// Figma 노드 추출 데이터 타입

// 추출된 텍스트 노드
export interface ExtractedTextNode {
  type: 'text';
  id: string;
  name: string;
  characters: string;
  fontSize?: number;
  fontWeight?: number;
  textCase?: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
}

// 추출된 프레임/그룹 노드
export interface ExtractedFrameNode {
  type: 'frame' | 'group' | 'component' | 'instance' | 'section';
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  children: ExtractedNode[];
}

// 추출된 도형 노드 (화살표, 선 등)
export interface ExtractedShapeNode {
  type: 'shape';
  id: string;
  name: string;
  shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star' | 'vector';
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
}

// 추출된 이미지 노드
export interface ExtractedImageNode {
  type: 'image';
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
}

// 통합 노드 타입
export type ExtractedNode =
  | ExtractedTextNode
  | ExtractedFrameNode
  | ExtractedShapeNode
  | ExtractedImageNode;

// 추출된 프레임 데이터 (최상위)
export interface ExtractedFrame {
  id: string;
  name: string;
  size: {
    width: number;
    height: number;
  };
  children: ExtractedNode[];
}

// 선택된 프레임 정보 (간략)
export interface SelectedFrameInfo {
  id: string;
  name: string;
  childCount: number;
}

// 플러그인 ↔ UI 메시지 타입
export type PluginMessage =
  | { type: 'selection-changed'; frames: SelectedFrameInfo[] }
  | { type: 'frame-data'; frames: ExtractedFrame[] }
  | { type: 'no-selection' }
  | { type: 'error'; message: string }
  | { type: 'init'; command: string };

export type UIMessage =
  | { type: 'request-frame-data' }
  | { type: 'copy-complete' }
  | { type: 'close' }
  | { type: 'resize'; width: number; height: number };
