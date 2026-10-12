'use strict';

// Loads matching English/Amharic locale files. SRS FR-5.1, FR-5.2, FR-5.6. TODO: verify Amharic translations with a human reviewer.
export async function loadLocale(languageCode) {
  const locale = languageCode === 'am' ? 'am' : 'en';
  const response = await fetch(new URL(`../../locales/${locale}.json`, import.meta.url));
  if (!response.ok) throw new Error('Locale could not be loaded.');
  return response.json();
}