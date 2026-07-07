"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { transliterate, isDevanagari } from "@/lib/transliterate";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}

// Text input with a live transliteration preview. Type in English and it
// suggests the Nepali (Devanagari) spelling; type in Nepali and it suggests
// the romanized spelling. Tap the suggestion to swap it into the field.
export default function TransliterateInput({ value, onChange, placeholder, className, type }: Props) {
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const text = value.trim();
    if (!text) { setSuggestion(""); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { result } = await transliterate(text);
        if (!cancelled) setSuggestion(result && result !== text ? result : "");
      } catch {
        if (!cancelled) setSuggestion("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450); // debounce typing

    return () => { cancelled = true; clearTimeout(timer); };
  }, [value]);

  const suggestionIsNepali = !isDevanagari(value);

  return (
    <div>
      <input
        className={className}
        placeholder={placeholder}
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
      {(loading || suggestion) && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          <Languages size={12} className="text-purple-400 shrink-0" />
          {loading && !suggestion ? (
            <span className="text-slate-600">converting…</span>
          ) : suggestion ? (
            <button
              type="button"
              onClick={() => onChange(suggestion)}
              className="text-purple-300 hover:text-purple-200 transition-colors text-left"
            >
              {suggestion}
              <span className="text-slate-600 ml-1">
                · tap to use {suggestionIsNepali ? "नेपाली" : "English"}
              </span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
