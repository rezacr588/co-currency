---
name: add-translation
description: Add a new i18n key to all four CoAI translation files (en, fa, ar, tr) at once, preserving shape and avoiding the common "added to English only" bug. Use when the user asks to add a translation key, wants to fix a missing label, or says "add this string to i18n".
---

# /add-translation

The four CoAI translation files must stay in lockstep — TypeScript will only catch missing keys if the English file is the source of truth type. A key added to only `en.ts` silently shows the raw key name in other languages at runtime.

## Files

- `/Users/rezazeraat/dev/co-currency/app/src/i18n/en.ts` — English (source of truth for typing)
- `/Users/rezazeraat/dev/co-currency/app/src/i18n/fa.ts` — Persian (RTL)
- `/Users/rezazeraat/dev/co-currency/app/src/i18n/ar.ts` — Arabic (RTL)
- `/Users/rezazeraat/dev/co-currency/app/src/i18n/tr.ts` — Turkish

## Workflow

1. Ask the user for the key name and English value. Accept `key = "value"` inline too.
2. Grep all four files for the key; if it already exists in any, stop and surface which ones — might be a duplicate or partial add that needs fixing instead.
3. Ask for Farsi, Arabic, Turkish values. If the user says "just use English" or "skip", write the English value as the placeholder in all three and note clearly in your final message that they need translation later.
4. Edit each file — preserve the surrounding style (trailing commas, grouping by feature, alphabetical order if that's the local pattern).
5. Run `cd /Users/rezazeraat/dev/co-currency/app && npx tsc --noEmit` to confirm all four files still satisfy the shared type. If TypeScript complains about a missing key in a non-English file, you missed a file.
6. If the user tells you what component will use the key, verify the call site: `const { t } = useLanguage()` then `t('yourKey') || 'English fallback'`.

## Don't

- Don't add keys in just `en.ts` and promise to "add the others later" — the whole point of this skill is atomicity.
- Don't guess translations in languages you can't verify — prefer English placeholders with a flag to the user over bad translations.
- Don't rename existing keys silently; call it out explicitly and ask whether call sites need updating.
