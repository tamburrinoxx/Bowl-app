"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VerificationStatus } from "@/types";

const STYLES: Record<VerificationStatus, string> = {
  verified: "bg-verified-green/20 text-verified-green border-verified-green/40",
  pending: "bg-chalk/10 text-chalk/60 border-chalk/20",
  flagged: "bg-flag-orange/20 text-flag-orange border-flag-orange/40",
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
    <div className="flex items-center gap-2">
      <span
        className={`font-score text-xs uppercase px-2 py-1 rounded border ${STYLES[current]}`}
      >
        {current}
      </span>
      {current !== "verified" && (
        <button
          disabled={busy}
          onClick={() => setStatus("verified")}
          className="font-score text-xs text-verified-green hover:underline disabled:opacity-40"
        >
          Verify
        </button>
      )}
      {current !== "flagged" && (
        <button
          disabled={busy}
          onClick={() => setStatus("flagged")}
          className="font-score text-xs text-flag-orange hover:underline disabled:opacity-40"
        >
          Flag
        </button>
      )}
    </div>
  );
}
