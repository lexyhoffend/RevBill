"use client";

import { useEffect, useState } from "react";

const COLORS = ["#1D9E75", "#D85A30", "#7F77DD", "#D4537E", "#378ADD", "#EF9F27"];

type Piece = { id: number; tx: number; ty: number; tr: number; color: string; delay: number };

/** Small hand-rolled confetti burst (no library) -- absolutely positioned over
 * whatever container it's placed in (which must be `position: relative`).
 * Re-fires any time `burstKey` changes to a new non-zero value. */
export default function Confetti({ burstKey, count = 14 }: { burstKey: number; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!burstKey) return;
    const next = Array.from({ length: count }, (_, i) => ({
      id: burstKey * 1000 + i,
      tx: (Math.random() - 0.5) * 100,
      ty: -(30 + Math.random() * 50),
      tr: Math.random() * 360,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 100,
    }));
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 800);
    return () => clearTimeout(t);
  }, [burstKey, count]);

  if (pieces.length === 0) return null;

  return (
    <span className="absolute inset-0 pointer-events-none overflow-visible z-10" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-sm"
          style={
            {
              backgroundColor: p.color,
              animationDelay: `${p.delay}ms`,
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              "--tr": `${p.tr}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
