// Plain-text sanitization for user-supplied strings. React escapes on render
// (we never use dangerouslySetInnerHTML), so this is defense-in-depth: it
// normalizes, strips control/invisible characters, and trims — keeping stored
// data clean regardless of how it's later consumed.
//
// Implemented by scanning code points (rather than a control-char regex) so the
// source stays free of literal control bytes.

const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;
const UNIT_SEP = 0x1f; // last C0 control char
const DELETE = 0x7f;

/** C0/C1 controls plus invisible format characters that can spoof or blank text. */
function isStrippable(code: number): boolean {
  if (code <= UNIT_SEP || code === DELETE) return true; // C0 + DEL
  if (code >= 0x80 && code <= 0x9f) return true; // C1 (incl. NEL — not matched by \s)
  if (code >= 0x200b && code <= 0x200f) return true; // zero-width chars + LRM/RLM
  if (code >= 0x202a && code <= 0x202e) return true; // bidi embedding/override
  if (code >= 0x2066 && code <= 0x2069) return true; // bidi isolates
  return code === 0x2060 || code === 0xfeff; // word joiner, BOM/ZWNBSP
}

export function sanitizeText(input: string, opts: { multiline?: boolean } = {}): string {
  const keepBreaks = opts.multiline === true;

  let out = "";
  for (const ch of input.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if (isStrippable(code)) {
      // In multiline fields keep tab / newline / carriage-return; drop the rest.
      if (keepBreaks && (code === TAB || code === LF || code === CR)) out += ch;
      continue;
    }
    out += ch;
  }

  // Single-line fields collapse any internal whitespace runs to one space.
  if (!keepBreaks) out = out.replace(/\s+/g, " ");

  return out.trim();
}
