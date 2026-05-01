"use client";

import type { Lang } from "@/app/page";

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export default function LanguageToggle({ lang, setLang }: Props) {
  return (
    <div className="flex items-center gap-1 bg-[#0d0f1f] border border-[#1e2140] rounded-xl p-1">
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
          lang === "en"
            ? "bg-purple-600 text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("ne")}
        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
          lang === "ne"
            ? "bg-purple-600 text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        नेपाली
      </button>
    </div>
  );
}
