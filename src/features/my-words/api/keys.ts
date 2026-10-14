export const myWordsKeys = {
  all: ['my-words'] as const,
  list: (translationLanguage: string) => ['my-words', 'list', translationLanguage] as const,
  lookup: (targetLanguage: string, translationLanguage: string, form: string) =>
    ['my-words', 'lookup', targetLanguage, translationLanguage, form] as const,
};
