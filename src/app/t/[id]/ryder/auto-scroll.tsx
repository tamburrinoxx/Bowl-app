"use client";

import { useEffect, useRef } from "react";

export default function AutoScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dir = 1;
    const id = setInterval(() => {
      if (el.scrollHeight <= el.clientHeight) return;
      el.scrollTop += dir;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) dir = -1;
      if (el.scrollTop <= 0) dir = 1;
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={ref} className="mx-auto w-full max-w-4xl flex-1 space-y-1.5 overflow-y-auto">
      {children}
    </div>
  );
}
