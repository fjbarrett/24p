"use client";

import Image from "next/image";
import type { PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

type PressableLogoProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
};

const MAX_DEPTH = 10;
const BASE_DEPTH = 2;

export function PressableLogo({ src, alt, width, height, className }: PressableLogoProps) {
  const [pressDepth, setPressDepth] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const pressStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const computeDepth = () => {
    if (pressStartRef.current === null) return pressDepth;
    const elapsed = performance.now() - pressStartRef.current;
    return Math.min(MAX_DEPTH, BASE_DEPTH + elapsed / 90);
  };

  const stopRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pressStartRef.current = performance.now();
    setIsPressed(true);
    setPressDepth(BASE_DEPTH);
    stopRaf();
    rafRef.current = requestAnimationFrame(function tick() {
      setPressDepth(computeDepth());
      rafRef.current = requestAnimationFrame(tick);
    });
  };

  const handlePointerUp = () => {
    if (!isPressed) return;
    const depth = computeDepth();
    pressStartRef.current = null;
    stopRaf();
    setIsPressed(false);
    setPressDepth(depth);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => setPressDepth(0), 140);
  };

  const handlePointerCancel = () => {
    pressStartRef.current = null;
    stopRaf();
    setIsPressed(false);
    setPressDepth(0);
  };

  const scale = Math.max(0.94, 1 - pressDepth * 0.004);
  const shadowLift = Math.max(6, 18 - pressDepth * 1.4);

  return (
    <button
      type="button"
      aria-label="Pressable 24p logo"
      className={`mt-10 rounded-[12px] transition-[transform,box-shadow,filter] duration-150 ease-out active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${className ?? ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      style={{
        transform: `translateY(${pressDepth}px) scale(${scale})`,
        boxShadow: `0 ${shadowLift}px ${shadowLift * 1.6}px rgba(0, 0, 0, 0.35)`,
        filter: isPressed ? "brightness(0.96)" : "brightness(1)",
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority
        loading="eager"
        className="h-[192px] w-[219px] rounded-[10px] select-none"
        draggable={false}
      />
    </button>
  );
}
