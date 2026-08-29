"use client";
import { useState } from "react";

export default function CollapseSection({ title, id, children }: {
  title: string; id?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="glass-panel p-8 mb-6">
      <button onClick={() => setOpen(!open)}
        className="mb-4 flex w-full items-center justify-between">
        <h2 id={id} className="font-display text-xl text-ink">{title}</h2>
        <span className="text-accent text-sm">{open ? "\u25b2" : "\u25bc"}</span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
