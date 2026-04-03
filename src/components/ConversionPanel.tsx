import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import type {
  LLMConfig,
  TranslationLanguage,
  SelectedFrameInfo,
  ExtractedFrame,
  ExtractedImageFile,
  PluginMessage,
  SequentialProgress,
  FrameConversionResult,
} from '../types';
import { LANGUAGE_LABELS } from '../types';
import { isConfigValid, loadCustomPrompt, saveCustomPrompt, clearCustomPrompt } from '../services/storage';
import { convertToMarkdown, SEQUENTIAL_SYSTEM_PROMPT } from '../services/markdown-converter';
import { MarkdownPreview } from './MarkdownPreview';

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
  const [copyFailed, setCopyFailed] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    reasoningTokens?: number;
    totalTokens: number;
  } | null>(null);
  const [frameProgress, setFrameProgress] = useState<SequentialProgress | null>(null);
  const [failedFrames, setFailedFrames] = useState<Array<{ frameName: string; error: string }>>([]);
  const [frameResults, setFrameResults] = useState<FrameConversionResult[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // 이미지 옵션
  const [includeImages, setIncludeImages] = useState(false);
  // 이미지 파일 데이터 (ZIP 다운로드용)
  const imageFilesRef = useRef<ExtractedImageFile[]>([]);

  // 프롬프트 편집 관련 상태
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isCustomPromptModified, setIsCustomPromptModified] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  // 커스텀 프롬프트 로드
  useEffect(() => {
    loadCustomPrompt().then((saved) => {
      if (saved) {
        setCustomPrompt(saved);
        setIsCustomPromptModified(true);
      } else {
        setCustomPrompt(SEQUENTIAL_SYSTEM_PROMPT);
      }
    });
  }, []);

  // Figma 메시지 핸들러
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage as PluginMessage;
      if (!message) return;

      switch (message.type) {
        case 'selection-changed':
          // 변환 중일 때는 선택 변경 무시 (초기화 방지)
          if (status === 'converting' || status === 'retrying') {
            return;
          }
          setSelectedFrames(message.frames);
          setError('');
          break;
        case 'no-selection':
          // 변환 중일 때는 선택 해제 무시
          if (status === 'converting' || status === 'retrying') {
            return;
          }
          setSelectedFrames([]);
          break;
        case 'extraction-started':
          setProgress('Figma 데이터 추출 중...');
          break;
        case 'frame-data':
          // 이미지 파일 저장 (ZIP 다운로드용)
          imageFilesRef.current = message.images || [];
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
  }, [config, translateTo, status]);

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
        includeImages,
        customPrompt: isCustomPromptModified ? customPrompt : undefined,
        onProgress: (msg) => {
          setProgress(msg);
          setStatus('converting');
        },
        onRetryWait: (remaining) => {
          setRetryCountdown(remaining);
          setStatus(remaining > 0 ? 'retrying' : 'converting');
        },
        onFrameProgress: (progress) => {
          setFrameProgress(progress);
          if (progress.phase === 'retrying' && progress.retryCountdown) {
            setRetryCountdown(progress.retryCountdown);
            setStatus('retrying');
          } else {
            setStatus('converting');
          }
        },
      });

      setResult(conversionResult.markdown);
      setTokenUsage(conversionResult.usage || null);
      setFailedFrames(conversionResult.failedFrames || []);
      setFrameResults(conversionResult.frameResults || []);
      setError('');
      setStatus('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : '변환 중 오류가 발생했습니다');
      setResult('');
      setTokenUsage(null);
      setFrameProgress(null);
      setStatus('error');
    }
  }, [config, translateTo, includeImages, customPrompt, isCustomPromptModified]);

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
    setCopyFailed(false);
    setTokenUsage(null);
    setRetryCountdown(0);
    setFrameProgress(null);
    setFailedFrames([]);
    setFrameResults([]);

    // 프레임 데이터 요청 (선택된 프레임 정보 전달 - 변환 중 선택 변경 방지)
    const frames = selectedFrames.map((f) => ({ id: f.id, layerName: f.layerName }));
    parent.postMessage({
      pluginMessage: {
        type: 'request-frame-data',
        frames,
        includeImages,
      },
    }, '*');
  };

  // 클립보드 복사 (fallback 방식)
  const handleCopy = async () => {
    if (!result) return;

    setCopyFailed(false);

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

    // 복사 실패
    setCopyFailed(true);
  };

  // Markdown 파일 다운로드 (이미지 포함 시 ZIP, 아니면 MD)
  const handleDownload = async () => {
    if (!result) return;

    try {
      const timestamp = Date.now();

      // 이미지 포함 시 ZIP 다운로드
      if (includeImages && imageFilesRef.current.length > 0) {
        const zip = new JSZip();

        // Markdown 파일 추가
        zip.file('document.md', result);

        // 이미지 폴더에 이미지 추가
        const imagesFolder = zip.folder('images');
        if (imagesFolder) {
          for (const img of imageFilesRef.current) {
            // fileName: "images/img-001.png" → "img-001.png"
            const fileName = img.fileName.replace('images/', '');
            imagesFolder.file(fileName, img.bytes);
          }
        }

        // ZIP 생성 및 다운로드
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `figma-export-${timestamp}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // 이미지 미포함: MD만 다운로드
        const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `figma-export-${timestamp}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError('다운로드에 실패했습니다.');
    }
  };

  const isConverting = status === 'converting' || status === 'retrying';
  const isConfigured = config && isConfigValid(config);

  // 프롬프트 저장
  const handleSavePrompt = async () => {
    await saveCustomPrompt(customPrompt);
    setIsCustomPromptModified(customPrompt !== SEQUENTIAL_SYSTEM_PROMPT);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  // 프롬프트 기본값으로 초기화
  const handleResetPrompt = async () => {
    setCustomPrompt(SEQUENTIAL_SYSTEM_PROMPT);
    setIsCustomPromptModified(false);
    await clearCustomPrompt();
  };

  // 프롬프트 변경 핸들러
  const handlePromptChange = (value: string) => {
    setCustomPrompt(value);
    // 기본값과 다르면 수정된 것으로 표시
    setIsCustomPromptModified(value !== SEQUENTIAL_SYSTEM_PROMPT);
  };

  // 미리보기 열기
  const handleOpenPreview = () => {
    setShowPreview(true);
    // UI 크기 확장
    parent.postMessage({ pluginMessage: { type: 'resize', width: 800, height: 700 } }, '*');
  };

  // 미리보기 닫기
  const handleClosePreview = () => {
    setShowPreview(false);
    // UI 크기 복원
    parent.postMessage({ pluginMessage: { type: 'resize', width: 400, height: 600 } }, '*');
  };

  // 미리보기 모드
  if (showPreview && result) {
    return (
      <div className="preview-mode">
        <div className="preview-toolbar">
          <div className="preview-title">📄 Markdown 미리보기</div>
          <div className="preview-actions">
            <button
              className={`btn btn-sm ${copied ? 'btn-success' : 'btn-secondary'}`}
              onClick={handleCopy}
            >
              {copied ? '✓ 복사됨' : '📋 복사'}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleDownload}
              title="Markdown 파일로 다운로드"
            >
              💾 저장
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleClosePreview}>
              ✕ 닫기
            </button>
          </div>
        </div>
        <div className="preview-content-wrapper">
          <MarkdownPreview markdown={result} />
        </div>
      </div>
    );
  }

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
            <div className="frame-list-items">
              {selectedFrames.map((frame) => (
                <div key={frame.id} className="frame-item">
                  <span className="frame-item-icon">▢</span>
                  {frame.layerName ? `${frame.layerName}-${frame.name}` : frame.name}
                </div>
              ))}
            </div>
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

        {/* 이미지 옵션 */}
        <div className="form-group">
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
              disabled={isConverting}
            />
            <span>이미지 포함</span>
          </label>
          <div className="hint-text">
            체크하면 이미지를 추출하여 저장 시 ZIP 파일로 제공합니다.
            (Markdown + images 폴더)
          </div>
        </div>

        {/* 고급 설정 (접이식) */}
        <div className="advanced-section">
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            type="button"
          >
            <span className="advanced-toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
            <span>고급 설정</span>
            {isCustomPromptModified && (
              <span className="custom-badge">커스텀</span>
            )}
          </button>

          {showAdvanced && (
            <div className="advanced-content">
              <div className="prompt-editor">
                <div className="prompt-header">
                  <label className="form-label">시스템 프롬프트</label>
                  <div className="prompt-actions">
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={handleResetPrompt}
                      title="기본값으로 초기화"
                      disabled={!isCustomPromptModified}
                    >
                      ↺ 초기화
                    </button>
                    <button
                      className={`btn btn-xs ${promptSaved ? 'btn-success' : 'btn-secondary'}`}
                      onClick={handleSavePrompt}
                      disabled={isConverting}
                    >
                      {promptSaved ? '✓ 저장됨' : '저장'}
                    </button>
                  </div>
                </div>
                <textarea
                  className="prompt-textarea"
                  value={customPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="LLM에 전달될 시스템 프롬프트를 입력하세요..."
                  disabled={isConverting}
                  spellCheck={false}
                />
                <div className="prompt-hint">
                  LLM이 Figma 데이터를 Markdown으로 변환할 때 사용하는 지침입니다.
                  수정 후 저장하면 다음 변환부터 적용됩니다.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LLM 설정 필요 경고 */}
        {!isConfigured && (
          <div className="status status-warning" style={{ marginBottom: 12 }}>
            <span className="status-icon">⚠️</span>
            <div>
              <div>LLM 설정 필요</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                <span
                  style={{ color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={onSwitchToSettings}
                >
                  설정 탭
                </span>
                에서 API를 먼저 설정해주세요.
              </div>
            </div>
          </div>
        )}

        {/* 변환 버튼 */}
        <button
          className="btn btn-primary"
          onClick={handleConvert}
          disabled={isConverting || selectedFrames.length === 0 || !isConfigured}
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
            <span className="progress-label">
              {frameProgress
                ? `${frameProgress.currentFrame}/${frameProgress.totalFrames} ${
                    frameProgress.phase === 'merging'
                      ? '결과 병합 중'
                      : frameProgress.phase === 'translating'
                      ? '번역 중'
                      : `변환 중: ${frameProgress.frameName}`
                  }`
                : progress}
            </span>
            {frameProgress && frameProgress.totalFrames > 1 && (
              <span className="progress-percent">
                {Math.round((frameProgress.currentFrame / frameProgress.totalFrames) * 100)}%
              </span>
            )}
          </div>
          <div className="progress-bar">
            {frameProgress && frameProgress.totalFrames > 1 ? (
              <div
                className="progress-fill"
                style={{
                  width: `${(frameProgress.currentFrame / frameProgress.totalFrames) * 100}%`,
                }}
              ></div>
            ) : (
              <div className="progress-fill indeterminate"></div>
            )}
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

      {/* 실패한 프레임 경고 */}
      {failedFrames.length > 0 && status === 'complete' && (
        <div className="status status-warning">
          <span className="status-icon">⚠️</span>
          <div>
            <div>{failedFrames.length}개 프레임 변환 실패</div>
            <div className="failed-frames-list">
              {failedFrames.map((f, i) => (
                <div key={i} className="failed-frame-item">
                  • {f.frameName}: {f.error}
                </div>
              ))}
            </div>
          </div>
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
              {tokenUsage.reasoningTokens != null && tokenUsage.reasoningTokens > 0 && (
                <div className="token-item">
                  <div className="token-label">추론</div>
                  <div className="token-value">{tokenUsage.reasoningTokens.toLocaleString()}</div>
                </div>
              )}
              <div className="token-item">
                <div className="token-label">총 토큰</div>
                <div className="token-value">{tokenUsage.totalTokens.toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* 프레임별 토큰 상세 (접이식) */}
          {frameResults.length > 1 && (
            <details className="token-details">
              <summary>프레임별 토큰 상세 ({frameResults.length}개 프레임)</summary>
              <div className="token-details-list">
                {frameResults.map((r, i) => (
                  <div key={i} className="token-details-item">
                    <span className="token-details-name">{r.frameName}</span>
                    <span className="token-details-value">
                      {r.usage?.totalTokens?.toLocaleString() || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </details>
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

          <div className="button-group" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={handleOpenPreview}
              style={{ flex: 1 }}
            >
              👁️ 미리보기
            </button>
            <button
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
              onClick={handleCopy}
              style={{ flex: 1 }}
            >
              {copied ? '✓ 복사됨' : '📋 복사'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDownload}
              style={{ flex: 1 }}
              title="Markdown 파일로 다운로드"
            >
              💾 저장
            </button>
          </div>

          {/* 복사 실패 안내 */}
          {copyFailed && (
            <div className="copy-failed-notice" style={{ marginTop: 12 }}>
              <div className="status status-warning" style={{ marginBottom: 8 }}>
                <span className="status-icon">⚠️</span>
                <div>
                  <div>클립보드 복사에 실패했습니다</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    텍스트가 너무 길거나 브라우저 제한으로 인해 복사되지 않았습니다.
                  </div>
                </div>
              </div>
              <div className="hint-text" style={{ marginBottom: 8 }}>
                아래 방법 중 하나를 사용해주세요:
              </div>
              <ul className="copy-alternatives" style={{ fontSize: 12, paddingLeft: 20, margin: 0 }}>
                <li>위 텍스트 영역을 클릭하여 전체 선택 후 Ctrl+C (Mac: Cmd+C)</li>
                <li>💾 저장 버튼으로 Markdown 파일 다운로드</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
