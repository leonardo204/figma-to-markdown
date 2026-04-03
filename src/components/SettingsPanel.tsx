import React, { useState, useEffect } from 'react';
import type { LLMConfig, LLMProvider } from '../types/llm';
import { PROVIDER_LABELS } from '../types/llm';
import { createDefaultConfig, saveConfig, isConfigValid } from '../services/storage';
import { testConnection, type ConnectionTestResult } from '../services/llm-client';

interface SettingsPanelProps {
  config: LLMConfig | null;
  onConfigChange: (config: LLMConfig) => void;
}

export function SettingsPanel({ config, onConfigChange }: SettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState<LLMConfig>(
    config || createDefaultConfig('openai')
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleProviderChange = (provider: LLMProvider) => {
    const newConfig = createDefaultConfig(provider);
    setLocalConfig(newConfig);
    setTestResult(null);
  };

  const handleFieldChange = (field: string, value: string) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }) as LLMConfig);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!isConfigValid(localConfig)) {
      setTestResult({ success: false, message: '모든 필수 필드를 입력해주세요' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(localConfig);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '연결 테스트 실패',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!isConfigValid(localConfig)) {
      setTestResult({ success: false, message: '모든 필수 필드를 입력해주세요' });
      return;
    }

    await saveConfig(localConfig);
    onConfigChange(localConfig);
    setTestResult({ success: true, message: '설정이 저장되었습니다!' });
  };

  const renderProviderFields = () => {
    switch (localConfig.provider) {
      case 'openai':
        return (
          <>
            <div className="form-group">
              <label className="form-label">API Key *</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk-..."
                value={localConfig.apiKey}
                onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              />
              <div className="hint-text">OpenAI Platform에서 발급받은 API Key</div>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <select
                className="form-select"
                value={localConfig.modelName}
                onChange={(e) => handleFieldChange('modelName', e.target.value)}
              >
                <option value="gpt-4o">gpt-4o (추천)</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-5">gpt-5 (Reasoning)</option>
                <option value="gpt-5-mini">gpt-5-mini (Reasoning)</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
            </div>
          </>
        );

      case 'claude':
        return (
          <>
            <div className="form-group">
              <label className="form-label">API Key *</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk-ant-..."
                value={localConfig.apiKey}
                onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              />
              <div className="hint-text">Anthropic Console에서 발급받은 API Key</div>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <select
                className="form-select"
                value={localConfig.modelName}
                onChange={(e) => handleFieldChange('modelName', e.target.value)}
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (추천)</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              </select>
            </div>
          </>
        );

      case 'azure-openai':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Endpoint *</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://your-resource.openai.azure.com"
                value={localConfig.endpoint}
                onChange={(e) => handleFieldChange('endpoint', e.target.value)}
              />
              <div className="hint-text">Azure OpenAI 리소스 엔드포인트</div>
            </div>
            <div className="form-group">
              <label className="form-label">API Key *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Azure API Key"
                value={localConfig.apiKey}
                onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deployment Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="gpt-4o"
                value={localConfig.deploymentName}
                onChange={(e) => handleFieldChange('deploymentName', e.target.value)}
              />
              <div className="hint-text">배포된 모델의 이름</div>
            </div>
            <div className="form-group">
              <label className="form-label">API Version</label>
              <input
                type="text"
                className="form-input"
                placeholder="2024-02-15-preview"
                value={localConfig.apiVersion}
                onChange={(e) => handleFieldChange('apiVersion', e.target.value)}
              />
            </div>
          </>
        );

      case 'gemini':
        return (
          <>
            <div className="form-group">
              <label className="form-label">API Key *</label>
              <input
                type="password"
                className="form-input"
                placeholder="AI..."
                value={localConfig.apiKey}
                onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              />
              <div className="hint-text">Google AI Studio에서 발급받은 API Key</div>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <select
                className="form-select"
                value={localConfig.modelName}
                onChange={(e) => handleFieldChange('modelName', e.target.value)}
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (추천)</option>
                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>
          </>
        );

      case 'groq':
        return (
          <>
            <div className="form-group">
              <label className="form-label">API Key *</label>
              <input
                type="password"
                className="form-input"
                placeholder="gsk_..."
                value={localConfig.apiKey}
                onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              />
              <div className="hint-text">Groq Console에서 발급받은 API Key</div>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <select
                className="form-select"
                value={localConfig.modelName}
                onChange={(e) => handleFieldChange('modelName', e.target.value)}
              >
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (추천)</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                <option value="gemma2-9b-it">Gemma 2 9B</option>
              </select>
            </div>
          </>
        );

      case 'ollama':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Endpoint</label>
              <input
                type="text"
                className="form-input"
                placeholder="http://localhost:11434"
                value={localConfig.endpoint}
                onChange={(e) => handleFieldChange('endpoint', e.target.value)}
              />
              <div className="hint-text">로컬 Ollama 서버 주소</div>
            </div>
            <div className="form-group">
              <label className="form-label">Model Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="llama3, mistral, codellama..."
                value={localConfig.modelName}
                onChange={(e) => handleFieldChange('modelName', e.target.value)}
              />
              <div className="hint-text">ollama list로 설치된 모델 확인</div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="settings-panel">
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>🤖</span>
            LLM 설정
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">제공업체</label>
          <select
            className="form-select"
            value={localConfig.provider}
            onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
          >
            {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABELS[provider]}
              </option>
            ))}
          </select>
        </div>

        {renderProviderFields()}

        {testResult && (
          <div className={`status ${testResult.success ? 'status-success' : 'status-error'}`}>
            <span className="status-icon">{testResult.success ? '✅' : '❌'}</span>
            <div>
              <div>{testResult.message}</div>
              {testResult.modelInfo && (
                <div style={{ marginTop: 4, opacity: 0.8, fontSize: 11 }}>
                  {testResult.modelInfo}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="btn-group">
          <button
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={isTesting || !isConfigValid(localConfig)}
            style={{ flex: 1 }}
          >
            {isTesting ? (
              <>
                <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }}></span>
                테스트 중...
              </>
            ) : (
              <>🔗 연결 테스트</>
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isConfigValid(localConfig)}
            style={{ flex: 1 }}
          >
            💾 저장
          </button>
        </div>
      </div>
    </div>
  );
}
