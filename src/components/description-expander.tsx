"use client";

import { useState } from "react";

export function DescriptionExpander({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full text-left">
      <p
        className="text-sm leading-relaxed text-[#FAFAFA]"
        style={{
          fontFamily: '"Open Sans", Arial, sans-serif',
          display: "-webkit-box",
          WebkitLineClamp: expanded ? "unset" : 3,
          WebkitBoxOrient: "vertical",
          overflow: expanded ? "visible" : "hidden",
        }}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        {expanded ? "less" : "more"}
      </button>
    </div>
  );
}
