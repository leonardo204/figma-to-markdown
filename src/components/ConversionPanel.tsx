import React, { useState, useEffect, useCallback } from 'react';
import type { LLMConfig, TranslationLanguage, SelectedFrameInfo, ExtractedFrame, PluginMessage } from '../types';
import { LANGUAGE_LABELS } from '../types';
import { isConfigValid } from '../services/storage';
import { convertToMarkdown } from '../services/markdown-converter';

interface ConversionPanelProps {
  config: LLMConfig | null;
  onSwitchToSettings: () => void;
}

export function ConversionPanel({ config, onSwitchToSettings }: ConversionPanelProps) {
  const [selectedFrames, setSelectedFrames] = useState<SelectedFrameInfo[]>([]);
  const [translateTo, setTranslateTo] = useState<TranslationLanguage>('none');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Figma 메시지 핸들러
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage as PluginMessage;
      if (!message) return;

      switch (message.type) {
        case 'selection-changed':
          setSelectedFrames(message.frames);
          setError('');
          break;
        case 'no-selection':
          setSelectedFrames([]);
          break;
        case 'frame-data':
          handleFrameData(message.frames);
          break;
        case 'error':
          setError(message.message);
          setIsConverting(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [config, translateTo]);

  // 프레임 데이터 수신 후 변환 처리
  const handleFrameData = useCallback(async (frames: ExtractedFrame[]) => {
    if (!config || !isConfigValid(config)) {
      setError('LLM 설정이 필요합니다');
      setIsConverting(false);
      return;
    }

    try {
      const conversionResult = await convertToMarkdown({
        config,
        frames,
        translateTo,
        onProgress: setProgress,
      });

      setResult(conversionResult.markdown);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '변환 중 오류가 발생했습니다');
      setResult('');
    } finally {
      setIsConverting(false);
      setProgress('');
    }
  }, [config, translateTo]);

  // 변환 시작
  const handleConvert = () => {
    if (!config || !isConfigValid(config)) {
      setError('LLM 설정을 먼저 완료해주세요');
      return;
    }

    if (selectedFrames.length === 0) {
      setError('변환할 프레임을 선택해주세요');
      return;
    }

    setIsConverting(true);
    setResult('');
    setError('');
    setCopied(false);

    // 프레임 데이터 요청
    parent.postMessage({ pluginMessage: { type: 'request-frame-data' } }, '*');
  };

  // 클립보드 복사 (fallback 방식)
  const handleCopy = async () => {
    if (!result) return;

    // 방법 1: navigator.clipboard (대부분의 환경에서 차단됨)
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      parent.postMessage({ pluginMessage: { type: 'copy-complete' } }, '*');
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      // fallback으로 진행
    }

    // 방법 2: execCommand (구식이지만 일부 환경에서 동작)
    try {
      const textarea = document.createElement('textarea');
      textarea.value = result;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (success) {
        setCopied(true);
        parent.postMessage({ pluginMessage: { type: 'copy-complete' } }, '*');
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // fallback으로 진행
    }

    // 방법 3: 사용자에게 수동 복사 안내
    setError('자동 복사가 지원되지 않습니다. 아래 텍스트를 직접 선택하여 복사해주세요 (Cmd+C / Ctrl+C)');
  };

  // LLM 설정 필요 경고
  if (!config || !isConfigValid(config)) {
    return (
      <div className="conversion-panel">
        <div className="warning-box">
          <div className="warning-box-title">LLM 설정 필요</div>
          <div className="warning-box-text">
            Markdown 변환을 위해 LLM 설정을 먼저 완료해주세요.
          </div>
        </div>
        <button className="btn btn-primary" onClick={onSwitchToSettings}>
          설정으로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="conversion-panel">
      {/* 선택된 프레임 목록 */}
      <div className="frame-list">
        <div className="frame-list-title">
          선택된 프레임 ({selectedFrames.length}개)
        </div>
        {selectedFrames.length === 0 ? (
          <div className="frame-item" style={{ color: '#999' }}>
            Figma에서 프레임을 선택해주세요
          </div>
        ) : (
          selectedFrames.map((frame) => (
            <div key={frame.id} className="frame-item">
              {frame.name}
            </div>
          ))
        )}
      </div>

      {/* 번역 옵션 */}
      <div className="form-group">
        <label className="form-label">번역</label>
        <select
          className="form-select"
          value={translateTo}
          onChange={(e) => setTranslateTo(e.target.value as TranslationLanguage)}
          disabled={isConverting}
        >
          {(Object.keys(LANGUAGE_LABELS) as TranslationLanguage[]).map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang]}
            </option>
          ))}
        </select>
      </div>

      {/* 변환 버튼 */}
      <button
        className="btn btn-primary"
        onClick={handleConvert}
        disabled={isConverting || selectedFrames.length === 0}
        style={{ width: '100%', marginTop: '8px' }}
      >
        {isConverting ? progress || '변환 중...' : 'Markdown으로 변환'}
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div className="status status-error" style={{ marginTop: '12px' }}>
          {error}
        </div>
      )}

      {/* 결과 미리보기 */}
      {result && (
        <>
          <div style={{ marginTop: '16px', fontWeight: 600, marginBottom: '8px' }}>
            결과 (선택 후 Cmd+C / Ctrl+C로 복사 가능)
          </div>
          <textarea
            className="result-textarea"
            value={result}
            readOnly
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            style={{
              width: '100%',
              height: '250px',
              padding: '12px',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              fontFamily: "'SF Mono', Monaco, 'Courier New', monospace",
              fontSize: '11px',
              lineHeight: '1.5',
              resize: 'vertical',
              background: '#f9f9f9',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleCopy}
            style={{ width: '100%', marginTop: '12px' }}
          >
            {copied ? '✓ 복사됨!' : '클립보드에 복사'}
          </button>
        </>
      )}
    </div>
  );
}
