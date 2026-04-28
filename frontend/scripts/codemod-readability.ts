import { Transform } from "jscodeshift";

const OPACITY_TO_TOKEN: Record<string, string> = {
  "10": "text-text-tertiary",
  "20": "text-text-tertiary",
  "30": "text-text-tertiary",
  "40": "text-text-muted",
  "50": "text-text-muted",
  "55": "text-text-muted",
  "60": "text-text-secondary",
  "65": "text-text-secondary",
  "70": "text-text-secondary",
  "75": "text-text-secondary",
  "80": "text-text-primary",
  "85": "text-text-primary",
  "90": "text-text-primary",
  "95": "text-text-primary",
};

// Match text-white/<digits> as a standalone token (word boundary or hover:/focus: prefix).
// Captures group 1 = optional Tailwind variant prefix (hover:, focus:, dark:, sm:, md:, etc.),
// group 2 = the opacity digits.
const PATTERN = /(?:^|(?<=\s))((?:[a-z]+:)*)text-white\/(\d+)(?=\s|$)/g;

function transformClassName(value: string): string {
  return value.replace(PATTERN, (match, variantPrefix, opacity) => {
    const token = OPACITY_TO_TOKEN[opacity];
    if (!token) return match; // unknown opacity (e.g. text-white/5) → leave alone
    return `${variantPrefix}${token}`;
  });
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let modified = false;

  root.find(j.JSXAttribute, { name: { name: "className" } }).forEach((path) => {
    const value = path.value.value;
    if (!value) return;

    if (value.type === "StringLiteral" || value.type === "Literal") {
      const oldValue = String(value.value);
      const newValue = transformClassName(oldValue);
      if (newValue !== oldValue) {
        value.value = newValue;
        modified = true;
      }
    }
    // Note: template literals (className={`...`}) are NOT touched — left for manual review
  });

  return modified ? root.toSource({ quote: "double" }) : null;
};

export default transform;
export const parser = "tsx";
