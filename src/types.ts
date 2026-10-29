export type TargetModel = 'gpt' | 'gemini' | 'mistral';

export type TargetLanguage = 'ru' | 'en' | 'es' | 'de' | 'fr' | 'zh';

export interface LanguageOption {
  code: TargetLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export interface ModelOption {
  id: TargetModel;
  name: string;
  vendor: string;
  version: string;
  description: string;
  color: string;
  badgeBg: string;
}

export interface StructuredPromptResult {
  systemPrompt: {
    roleAndContext: string;
    task: string;
    persistentMaterials: string;
    rules: string;
    fewShot: {
      bad: string;
      good: string;
    };
    responseFormat: string;
  };
  userPrompt: {
    inputData: string;
    action: string;
  };
  formattedText: string;
  metaPromptUsed: {
    systemPrompt: string;
    userPrompt: string;
    fullText: string;
  };
  metadata: {
    model: TargetModel;
    language: TargetLanguage;
    createdAt: string;
    originalWordCount: number;
    optimizedWordCount: number;
  };
}

export interface RewriteRequest {
  rawPrompt: string;
  targetModel: TargetModel;
  targetLanguage: TargetLanguage;
  additionalInstructions?: string;
  apiKeys?: {
    gemini?: string;
    openai?: string;
    mistral?: string;
  };
}

export interface PresetPrompt {
  id: string;
  title: string;
  category: string;
  description: string;
  rawPrompt: string;
  targetModel: TargetModel;
  targetLanguage: TargetLanguage;
}
