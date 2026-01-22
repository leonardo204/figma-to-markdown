import React, { useState, useEffect } from 'react';
import type { LLMConfig, LLMProvider } from '../types/llm';
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../types/llm';
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
            </div>
            <div className="form-group">
              <label className="form-label">Model Name</label>
              <select
                className="form-select"
                value={localConfig.modelName}
                onChange={(e) => handleFieldChange('modelName', e.target.value)}
              >
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
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
            </div>
            <div className="form-group">
              <label className="form-label">Model Name</label>
              <select
                className="form-select"
                value={localConfig.modelName}
                onChange={(e) => handleFieldChange('modelName', e.target.value)}
              >
                <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022</option>
                <option value="claude-3-opus-20240229">claude-3-opus-20240229</option>
                <option value="claude-3-haiku-20240307">claude-3-haiku-20240307</option>
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
                placeholder="gpt-4"
                value={localConfig.deploymentName}
                onChange={(e) => handleFieldChange('deploymentName', e.target.value)}
              />
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
            </div>
          </>
        );
    }
  };

  return (
    <div className="settings-panel">
      <div className="form-group">
        <label className="form-label">LLM Provider</label>
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
          {testResult.success ? '✅' : '❌'} {testResult.message}
          {testResult.modelInfo && <div style={{ marginTop: '4px' }}>{testResult.modelInfo}</div>}
        </div>
      )}

      <div className="btn-group">
        <button
          className="btn btn-secondary"
          onClick={handleTestConnection}
          disabled={isTesting || !isConfigValid(localConfig)}
        >
          {isTesting ? '테스트 중...' : '연결 테스트'}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!isConfigValid(localConfig)}
        >
          저장
        </button>
      </div>
    </div>
  );
}
