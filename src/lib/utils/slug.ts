// Characters that don't decompose via NFD (ø, ð, æ, þ, ß, etc.)
const LATIN_EXTRA: Record<string, string> = {
  ø: 'o', æ: 'ae', ð: 'd', þ: 'th', ß: 'ss', đ: 'd', ł: 'l',
};

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', є: 'ie',
  ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterate(str: string): string {
  return Array.from(str)
    .map((ch) => LATIN_EXTRA[ch] ?? CYRILLIC[ch] ?? ch)
    .join('');
}

export function generateSlug(name: string, fallbackId?: string): string {
  const slug = transliterate(name.toLowerCase())
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || fallbackId || '';
}
