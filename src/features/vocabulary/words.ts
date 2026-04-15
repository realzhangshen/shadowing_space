const EDGE_PUNCTUATION =
  /^[\s"'`“”‘’.,!?;:()[\]{}<>/\\|~@#$%^&*_+=\-，。！？：；、（）【】《》「」『』]+|[\s"'`“”‘’.,!?;:()[\]{}<>/\\|~@#$%^&*_+=\-，。！？：；、（）【】《》「」『』]+$/g;

export function cleanVocabularyText(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(EDGE_PUNCTUATION, "");
}

export function normalizeVocabularyKey(value: string): string {
  return cleanVocabularyText(value).normalize("NFKC").toLocaleLowerCase();
}
