/**
 * Configuration and storage for User-Provided Gemini API Key (BYOK)
 * Stored strictly in browser storage (localStorage / sessionStorage) under 'insighthub_ai_settings',
 * completely separate from ProjectState, .insight exports, bookmarks, or logs.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const AI_SETTINGS_STORAGE_KEY = 'insighthub_ai_settings';
export const STORAGE_KEY = AI_SETTINGS_STORAGE_KEY;

export type StorageType = 'local' | 'session';

export interface AiSettings {
  apiKey: string;
  selectedModel: string;
  model?: string; // alias
  storageType: StorageType;
  privacyConsentAccepted: boolean;
  privacyConsentNeverAskAgain: boolean;
}

const DEFAULT_SETTINGS: AiSettings = {
  apiKey: '',
  selectedModel: DEFAULT_GEMINI_MODEL,
  model: DEFAULT_GEMINI_MODEL,
  storageType: 'local',
  privacyConsentAccepted: false,
  privacyConsentNeverAskAgain: false,
};

let memorySettings: AiSettings = { ...DEFAULT_SETTINGS };

export function getAiSettings(): AiSettings {
  try {
    if (typeof window !== 'undefined') {
      const sessionData = window.sessionStorage?.getItem(AI_SETTINGS_STORAGE_KEY);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        const selModel = parsed.selectedModel || parsed.model || DEFAULT_GEMINI_MODEL;
        memorySettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          selectedModel: selModel,
          model: selModel,
          storageType: 'session',
        };
        return memorySettings;
      }

      const localData = window.localStorage?.getItem(AI_SETTINGS_STORAGE_KEY);
      if (localData) {
        const parsed = JSON.parse(localData);
        const selModel = parsed.selectedModel || parsed.model || DEFAULT_GEMINI_MODEL;
        memorySettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          selectedModel: selModel,
          model: selModel,
          storageType: 'local',
        };
        return memorySettings;
      }
    }
  } catch (err) {
    // In case storage access is restricted or corrupted
  }

  return { ...memorySettings };
}

export function saveAiSettings(partial: Partial<AiSettings>): void {
  const current = getAiSettings();
  const targetStorageType = partial.storageType || current.storageType;
  const targetModel =
    partial.selectedModel?.trim() || partial.model?.trim() || current.selectedModel || DEFAULT_GEMINI_MODEL;

  const updated: AiSettings = {
    ...current,
    ...partial,
    storageType: targetStorageType,
    selectedModel: targetModel,
    model: targetModel,
  };

  memorySettings = { ...updated };

  try {
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(updated);
      if (targetStorageType === 'session') {
        window.sessionStorage?.setItem(AI_SETTINGS_STORAGE_KEY, serialized);
        window.localStorage?.removeItem(AI_SETTINGS_STORAGE_KEY);
      } else {
        window.localStorage?.setItem(AI_SETTINGS_STORAGE_KEY, serialized);
        window.sessionStorage?.removeItem(AI_SETTINGS_STORAGE_KEY);
      }
    }
  } catch (err) {
    console.error('Falha ao salvar configurações de IA no armazenamento local');
  }
}

export function clearAiSettings(): void {
  memorySettings = { ...DEFAULT_SETTINGS };
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(AI_SETTINGS_STORAGE_KEY);
      window.localStorage?.removeItem(AI_SETTINGS_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export const clearAiApiKey = clearAiSettings;

export function hasAiApiKey(): boolean {
  const settings = getAiSettings();
  return Boolean(settings.apiKey && settings.apiKey.trim().length > 0);
}

export const hasConfiguredApiKey = hasAiApiKey;

export function getAiApiKey(): string {
  return getAiSettings().apiKey.trim();
}

export function getSelectedModel(): string {
  const model = getAiSettings().selectedModel?.trim();
  return model || DEFAULT_GEMINI_MODEL;
}

export function getPrivacyConsent(): { accepted: boolean; neverAskAgain: boolean } {
  const settings = getAiSettings();
  return {
    accepted: settings.privacyConsentAccepted,
    neverAskAgain: settings.privacyConsentNeverAskAgain,
  };
}

export function setPrivacyConsent(accepted: boolean, neverAskAgain: boolean): void {
  saveAiSettings({
    privacyConsentAccepted: accepted,
    privacyConsentNeverAskAgain: neverAskAgain,
  });
}

export const recordPrivacyConsent = setPrivacyConsent;

export function shouldPromptPrivacyConsent(): boolean {
  const settings = getAiSettings();
  if (settings.privacyConsentNeverAskAgain) return false;
  return !settings.privacyConsentAccepted;
}
