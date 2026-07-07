// Two-way transliteration between romanized English and Nepali (Devanagari).
//
//  • Latin  → Devanagari : Google Input Tools (phonetic, accurate) via /api/transliterate
//  • Devanagari → Latin  : local syllable-based converter (deterministic, best-effort)

const DEVANAGARI = /[ऀ-ॿ]/;

export function isDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

// ── Devanagari → Roman ──────────────────────────────────────────────
const CONS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "w",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
};

const MATRA: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

const VOWEL: Record<string, string> = {
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ॐ": "om",
};

const HALANT = "्";
const ANUSVARA = "ं";
const VISARGA = "ः";
const CHANDRABINDU = "ँ";

function devanagariToRoman(text: string): string {
  let out = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONS[c]) {
      out += CONS[c];
      const next = chars[i + 1];
      if (next && MATRA[next]) { out += MATRA[next]; i++; }
      else if (next === HALANT) { i++; } // conjunct — suppress inherent vowel
      else { out += "a"; }               // inherent vowel
    } else if (VOWEL[c]) {
      out += VOWEL[c];
    } else if (c === ANUSVARA || c === CHANDRABINDU) {
      out += "n";
    } else if (c === VISARGA) {
      out += "h";
    } else if (c === "।") {
      out += ".";
    } else {
      out += c; // spaces, latin, digits, punctuation pass through
    }
  }
  return out;
}

// ── Public API ──────────────────────────────────────────────────────
// Returns the converted text plus the script of that result
// ("ne" = Nepali/Devanagari output, "en" = romanized output).
export async function transliterate(
  text: string,
): Promise<{ script: "ne" | "en"; result: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { script: "ne", result: "" };

  if (isDevanagari(trimmed)) {
    return { script: "en", result: devanagariToRoman(trimmed) };
  }

  try {
    const res = await fetch(`/api/transliterate?text=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    return { script: "ne", result: data.result || "" };
  } catch {
    return { script: "ne", result: "" };
  }
}
