"use client";

import { useMemo } from "react";

export default function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      duration: `${2 + Math.random() * 4}s`,
      delay: `${Math.random() * 4}s`,
      size: Math.random() > 0.8 ? "3px" : "2px",
    })), []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            top: s.top,
            left: s.left,
            "--duration": s.duration,
            "--delay": s.delay,
            width: s.size,
            height: s.size,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
