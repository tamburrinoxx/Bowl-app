"use client";

import { useEffect, useRef, useState } from "react";

export default function FitName({
  children,
  className = "",
  max = 20,
  min = 11,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  min?: number;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(max);

  useEffect(() => {
    const b = box.current;
    const t = text.current;
    if (!b || !t) return;
    const fit = () => {
      let s = max;
      t.style.fontSize = `${s}px`;
      while (s > min && t.scrollWidth > b.clientWidth) {
        s -= 1;
        t.style.fontSize = `${s}px`;
      }
      setSize(s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    return () => ro.disconnect();
  }, [children, max, min]);

  return (
    <span ref={box} className="block w-full overflow-hidden">
      <span ref={text} className={`whitespace-nowrap ${className}`} style={{ fontSize: size }}>
        {children}
      </span>
    </span>
  );
}
