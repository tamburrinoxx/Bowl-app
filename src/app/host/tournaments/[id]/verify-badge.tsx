"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VerificationStatus } from "@/types";

const STYLES: Record<VerificationStatus, string> = {
  verified: "bg-success/15 text-success",
  pending: "bg-black/5 text-ink-soft",
  flagged: "bg-warning/15 text-warning",
};

export default function VerifyBadge({
  entryId,
  status,
}: {
  entryId: string;
  status: VerificationStatus;
}) {
  const supabase = createClient();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);

  async function setStatus(next: VerificationStatus) {
    setBusy(true);
    const { error } = await supabase
      .from("entries")
      .update({ verification_status: next })
      .eq("id", entryId);
    setBusy(false);
    if (!error) setCurrent(next);
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-xs font-semibold uppercase px-3 py-1.5 rounded-full ${STYLES[current]}`}
      >
        {current}
      </span>
      {current !== "verified" && (
        <button
          disabled={busy}
          onClick={() => setStatus("verified")}
          className="text-xs text-success font-medium disabled:opacity-40"
        >
          Verify
        </button>
      )}
      {current !== "flagged" && (
        <button
          disabled={busy}
          onClick={() => setStatus("flagged")}
          className="text-xs text-warning font-medium disabled:opacity-40"
        >
          Flag
        </button>
      )}
    </div>
  );
}
