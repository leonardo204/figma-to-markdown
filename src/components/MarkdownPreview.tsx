import React, { useEffect, useRef } from 'react';
import { marked, Renderer } from 'marked';
import mermaid from 'mermaid';

interface MarkdownPreviewProps {
  markdown: string;
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Mermaid 초기화
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });

    // 커스텀 렌더러로 Mermaid 코드 블록 처리
    const renderer = new Renderer();

    renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid">${text}</div>`;
      }
      // 기본 코드 블록 렌더링
      const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code class="language-${lang || ''}">${escaped}</code></pre>`;
    };

    // marked 설정
    marked.setOptions({
      breaks: true,
      gfm: true,
      renderer,
    });

    // 마크다운 렌더링
    const html = marked.parse(markdown) as string;
    containerRef.current.innerHTML = html;

    // Mermaid 다이어그램 렌더링
    mermaid.run({
      nodes: containerRef.current.querySelectorAll('.mermaid'),
    });
  }, [markdown]);

  return <div ref={containerRef} className="markdown-preview-content" />;
}
