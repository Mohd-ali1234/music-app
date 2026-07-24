import { api } from "@/src/lib/api";

/** Typed transport for the app settings endpoints (currently: Gemini API key). */

export type AISettings = {
  provider: string;
  gemini_key_configured: boolean;
  gemini_key_suffix: string | null;
};

export const settingsClient = {
  getAISettings: () => api.get<AISettings>("/settings/ai"),

  saveGeminiKey: (geminiApiKey: string) =>
    api.put<AISettings>("/settings/ai", { gemini_api_key: geminiApiKey }),
};
