"use client";

import { useState, useRef, useEffect } from "react";

export function DescriptionExpander({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setIsClamped(el.scrollHeight > el.clientHeight);
  }, [text]);

  return (
    <div className="w-full text-left">
      <p
        ref={ref}
        className="text-sm leading-relaxed text-[#FAFAFA]"
        style={{
          fontFamily: '"Open Sans", Arial, sans-serif',
          display: "-webkit-box",
          WebkitLineClamp: expanded ? "unset" : 5,
          WebkitBoxOrient: "vertical",
          overflow: expanded ? "visible" : "hidden",
        }}
      >
        {text}
      </p>
      {(isClamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-white/40 transition-colors hover:text-white/70"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}
