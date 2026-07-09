// i18n for insight.js — same model as the Streamline skin: a CSV where the KEY
// of each row is the English phrase and each column is a language. t(englishKey)
// returns the phrase in the active language (or the key itself when missing, so
// untranslated strings degrade to English). The CSV is the full de1app GUI
// translation sheet (1500+ phrases, 32 languages) — since Insight is a de1app
// skin, essentially all its phrases are already keyed there.
//
// Labels call t('English phrase') on every render; changing language dispatches
// 'insight-langchange' so the live PageHost re-renders and picks up the new
// strings.
import { logger } from './logger.js';

const CSV_URL = 'src/i18n/de1-translations.csv';
const translations = {};        // { langCode: { englishKey: translated } }
export let supportedLanguages = [];
let currentLanguage = 'en';

// Friendly names shown in the Settings › Language picker -> CSV column codes.
export const LANGUAGES = [
  { name: 'English', code: 'en' }, { name: 'français', code: 'fr' }, { name: 'Español', code: 'es' },
  { name: 'Deutsch', code: 'de' }, { name: 'Schwiizerdütsch', code: 'de-ch' }, { name: 'italiano', code: 'it' },
  { name: 'Català', code: 'ca' }, { name: '한국어', code: 'kr' }, { name: '中文（简体）', code: 'zh-hans' },
  { name: '中文（繁體）', code: 'zh-hant' }, { name: '日本語', code: 'jp' }, { name: 'Português', code: 'pt' },
  { name: 'Nederlands', code: 'nl' }, { name: 'Русский', code: 'ru' }, { name: 'العربية', code: 'ar' },
];
const NAME_TO_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.name, l.code]));
const CODE_TO_NAME = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.name]));

// CSV parser (handles quoted fields with embedded commas), mirroring Streamline.
function parseCSV(csvText) {
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.substring(1);
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  supportedLanguages = headers;
  headers.forEach((lang) => { translations[lang] = {}; });
  const splitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = line.split(splitRegex).map((val) => {
      let v = val.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1).replace(/""/g, '"');
      return v;
    });
    const key = values[0];
    if (!key) continue;
    headers.forEach((lang, index) => {
      if (values[index] !== undefined && values[index] !== '') translations[lang][key] = values[index];
    });
  }
}

export function t(key) {
  if (currentLanguage === 'en') return key;                 // English keys are the source of truth
  return translations[currentLanguage]?.[key] || key;
}
export function currentLangCode() { return currentLanguage; }
export function currentLangName() { return CODE_TO_NAME[currentLanguage] || 'English'; }

export function setLang(nameOrCode) {
  const code = NAME_TO_CODE[nameOrCode] || (supportedLanguages.includes(nameOrCode) ? nameOrCode : 'en');
  currentLanguage = code;
  localStorage.setItem('insight_lang_code', code);
  window.dispatchEvent(new Event('insight-langchange'));
}

export async function initI18n() {
  try {
    const r = await fetch(CSV_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    parseCSV(await r.text());
    logger.info(`i18n loaded: ${supportedLanguages.length} languages, ${Object.keys(translations.en || {}).length} phrases`);
  } catch (e) { logger.warn('i18n load', e); }
  // migrate the old friendly-name key if present
  const saved = localStorage.getItem('insight_lang_code') || NAME_TO_CODE[localStorage.getItem('insight_lang')] || 'en';
  currentLanguage = supportedLanguages.includes(saved) ? saved : 'en';
  window.dispatchEvent(new Event('insight-langchange'));
}
