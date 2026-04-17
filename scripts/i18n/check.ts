import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { diffKeySets, flattenKeys } from "./compareKeys";

const MESSAGES_DIR = path.resolve(process.cwd(), "messages");
const REFERENCE_LOCALE = "en";

function loadLocale(file: string): Set<string> {
  const raw = readFileSync(path.join(MESSAGES_DIR, file), "utf8");
  const parsed = JSON.parse(raw);
  return flattenKeys(parsed);
}

function main(): void {
  const files = readdirSync(MESSAGES_DIR).filter((name) => name.endsWith(".json"));
  const referenceFile = `${REFERENCE_LOCALE}.json`;
  if (!files.includes(referenceFile)) {
    console.error(`[i18n:check] Missing reference locale ${referenceFile}`);
    process.exit(1);
  }

  const referenceKeys = loadLocale(referenceFile);
  let hasDrift = false;

  for (const file of files) {
    if (file === referenceFile) continue;
    const candidateKeys = loadLocale(file);
    const diff = diffKeySets(referenceKeys, candidateKeys);
    if (diff.missing.length === 0 && diff.extra.length === 0) {
      console.log(`[i18n:check] ${file} OK`);
      continue;
    }
    hasDrift = true;
    console.error(`[i18n:check] ${file} DRIFT`);
    for (const key of diff.missing) {
      console.error(`  missing: ${key}`);
    }
    for (const key of diff.extra) {
      console.error(`  extra:   ${key}`);
    }
  }

  if (hasDrift) {
    console.error(`[i18n:check] Locale drift detected against ${referenceFile}`);
    process.exit(1);
  }
  console.log(`[i18n:check] all locales aligned with ${referenceFile}`);
}

main();
