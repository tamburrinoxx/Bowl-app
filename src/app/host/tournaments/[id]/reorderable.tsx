"use client";

import { Children, isValidElement, useEffect, useMemo, useState } from "react";

export default function Reorderable({
  storageKey,
  children,
}: {
  storageKey: string;
  children: React.ReactNode;
}) {
  const items = useMemo(
    () =>
      Children.toArray(children)
        .filter(isValidElement)
        .map((el, i) => ({
          key: String(el.key ?? i).replace(/^\.\$/, ""),
          node: el,
        })),
    [children]
  );

  const [order, setOrder] = useState<string[]>([]);
  const [drag, setDrag] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setOrder(JSON.parse(raw) as string[]);
    } catch {}
  }, [storageKey]);

  const sorted = useMemo(() => {
    const pos = new Map(order.map((k, i) => [k, i]));
    return [...items].sort(
      (a, b) => (pos.get(a.key) ?? 999) - (pos.get(b.key) ?? 999)
    );
  }, [items, order]);

  function save(next: string[]) {
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  function onDrop(targetKey: string) {
    if (!drag || drag === targetKey) return;
    const keys = sorted.map((s) => s.key);
    const from = keys.indexOf(drag);
    const to = keys.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    save(keys);
    setDrag(null);
  }

  return (
    <div>
      {sorted.map((s) => (
        <div
          key={s.key}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(s.key)}
          className={`group relative ${drag === s.key ? "opacity-40" : ""}`}
        >
          <span
            draggable
            onDragStart={() => setDrag(s.key)}
            onDragEnd={() => setDrag(null)}
            title="Drag to reorder"
            className="absolute right-12 top-5 z-10 hidden cursor-grab select-none text-lg text-white/25 opacity-0 transition hover:text-white group-hover:opacity-100 lg:block"
          >
            ⠿
          </span>
          {s.node}
        </div>
      ))}
      {order.length > 0 && (
        <button
          type="button"
          onClick={() => save([])}
          className="mb-6 hidden text-xs text-white/40 underline lg:block"
        >
          Reset section order
        </button>
      )}
    </div>
  );
}