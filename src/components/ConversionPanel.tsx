import React, { useState, useEffect, useCallback } from 'react';
import type { LLMConfig, TranslationLanguage, SelectedFrameInfo, ExtractedFrame, PluginMessage } from '../types';
import { LANGUAGE_LABELS } from '../types';
import { isConfigValid } from '../services/storage';
import { convertToMarkdown } from '../services/markdown-converter';

interface ConversionPanelProps {
  config: LLMConfig | null;
  onSwitchToSettings: () => void;
}

type ConversionStatus = 'idle' | 'converting' | 'retrying' | 'complete' | 'error';

export function ConversionPanel({ config, onSwitchToSettings }: ConversionPanelProps) {
  const [selectedFrames, setSelectedFrames] = useState<SelectedFrameInfo[]>([]);
  const [translateTo, setTranslateTo] = useState<TranslationLanguage>('none');
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(null);

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
          setStatus('error');
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
      setStatus('error');
      return;
    }

    try {
      const conversionResult = await convertToMarkdown({
        config,
        frames,
        translateTo,
        onProgress: (msg) => {
          setProgress(msg);
          setStatus('converting');
        },
        onRetryWait: (remaining) => {
          setRetryCountdown(remaining);
          setStatus(remaining > 0 ? 'retrying' : 'converting');
        },
      });

      setResult(conversionResult.markdown);
      setTokenUsage(conversionResult.usage || null);
      setError('');
      setStatus('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : '변환 중 오류가 발생했습니다');
      setResult('');
      setTokenUsage(null);
      setStatus('error');
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

    setStatus('converting');
    setResult('');
    setError('');
    setCopied(false);
    setTokenUsage(null);
    setRetryCountdown(0);

    // 프레임 데이터 요청
    parent.postMessage({ pluginMessage: { type: 'request-frame-data' } }, '*');
  };

  // 클립보드 복사 (fallback 방식)
  const handleCopy = async () => {
    if (!result) return;

    // 방법 1: navigator.clipboard
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      parent.postMessage({ pluginMessage: { type: 'copy-complete' } }, '*');
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      // fallback
    }

    // 방법 2: execCommand
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
      // fallback
    }

    setError('자동 복사가 지원되지 않습니다. 텍스트를 선택하여 복사해주세요.');
  };

  // LLM 설정 필요 경고
  if (!config || !isConfigValid(config)) {
    return (
      <div className="conversion-panel">
        <div className="warning-box">
          <div className="warning-box-icon">⚠️</div>
          <div className="warning-box-title">LLM 설정 필요</div>
          <div className="warning-box-text">
            Markdown 변환을 위해 LLM 설정을 먼저 완료해주세요.
          </div>
        </div>
        <button className="btn btn-primary" onClick={onSwitchToSettings} style={{ width: '100%' }}>
          설정으로 이동
        </button>
      </div>
    );
  }

  const isConverting = status === 'converting' || status === 'retrying';

  return (
    <div className="conversion-panel">
      {/* 선택된 프레임 카드 */}
      <div className="card">
        <div className="frame-list">
          <div className="frame-list-title">
            <span>📐</span>
            선택된 프레임
            <span className="card-badge">{selectedFrames.length}개</span>
          </div>
          {selectedFrames.length === 0 ? (
            <div className="frame-list-empty">
              Figma에서 프레임을 선택해주세요
            </div>
          ) : (
            selectedFrames.map((frame) => (
              <div key={frame.id} className="frame-item">
                <span className="frame-item-icon">▢</span>
                {frame.name}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 옵션 카드 */}
      <div className="card">
        <div className="form-group">
          <label className="form-label">번역 언어</label>
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
          <div className="hint-text">LLM을 통해 변환된 문서를 번역합니다</div>
        </div>

        {/* 변환 버튼 */}
        <button
          className="btn btn-primary"
          onClick={handleConvert}
          disabled={isConverting || selectedFrames.length === 0}
          style={{ width: '100%' }}
        >
          {isConverting ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
              {progress || '변환 중...'}
            </>
          ) : (
            <>✨ Markdown으로 변환</>
          )}
        </button>
      </div>

      {/* Rate Limit 대기 상태 */}
      {status === 'retrying' && retryCountdown > 0 && (
        <div className="retry-container">
          <div className="retry-icon">⏳</div>
          <div className="retry-title">API 요청 제한 대기 중</div>
          <div className="retry-countdown">{retryCountdown}초</div>
          <div className="retry-text">Rate limit에 도달했습니다. 자동으로 재시도합니다.</div>
        </div>
      )}

      {/* Progress Bar (변환 중) */}
      {status === 'converting' && (
        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">{progress}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill indeterminate"></div>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="status status-error">
          <span className="status-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* 결과 */}
      {result && status === 'complete' && (
        <div className="card">
          {/* 토큰 사용량 */}
          {tokenUsage && (
            <div className="token-usage">
              <div className="token-item">
                <div className="token-label">입력</div>
                <div className="token-value">{tokenUsage.promptTokens.toLocaleString()}</div>
              </div>
              <div className="token-item">
                <div className="token-label">출력</div>
                <div className="token-value">{tokenUsage.completionTokens.toLocaleString()}</div>
              </div>
              <div className="token-item">
                <div className="token-label">총 토큰</div>
                <div className="token-value">{tokenUsage.totalTokens.toLocaleString()}</div>
              </div>
            </div>
          )}

          <div className="section-title">
            <span>📄</span>
            변환 결과
          </div>
          <div className="hint-text" style={{ marginBottom: 10 }}>
            클릭하면 전체 선택됩니다
          </div>

          <textarea
            className="result-textarea"
            value={result}
            readOnly
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />

          <button
            className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
            onClick={handleCopy}
            style={{ width: '100%', marginTop: 12 }}
          >
            {copied ? '✓ 복사 완료!' : '📋 클립보드에 복사'}
          </button>
        </div>
      )}
    </div>
  );
}
