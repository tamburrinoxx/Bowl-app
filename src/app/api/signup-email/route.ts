import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

type Bowler = { name: string; average: number; handicap: number };

type Receipt = {
  team_name: string;
  captain_email: string;
  waitlisted: boolean;
  tournament: string;
  squad: string | null;
  starts_at: string | null;
  bowlers: Bowler[] | null;
  scratch: boolean;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const signupId = body?.signupId as string | undefined;
  if (!signupId) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.SIGNUP_EMAIL_FROM;
  if (!key || !from) return NextResponse.json({ ok: false, skipped: true });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.rpc("signup_receipt", {
    p_signup: signupId,
  });
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const r = data as Receipt;
  const bowlers = r.bowlers ?? [];
  const total = bowlers.reduce((s, b) => s + Number(b.handicap), 0);
  const baker = Math.round(total / 3);
  const when = r.starts_at
    ? new Date(r.starts_at).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/New_York",
      })
    : "";

  const rows = bowlers
    .map(
      (b) =>
        `<tr><td style="padding:4px 16px 4px 0">${b.name}</td>` +
        `<td style="padding:4px 16px 4px 0;text-align:right">${b.average} avg</td>` +
        `<td style="padding:4px 0;text-align:right">${b.handicap} hdcp</td></tr>`
    )
    .join("");

  const headline = r.waitlisted
    ? "You're on the waiting list"
    : "Your team is entered";

  const note = r.waitlisted
    ? `${r.squad ?? "That squad"} is full. We'll email you if a spot opens. To take the other squad instead, sign up again with at least one different bowler.`
    : `See you at ${r.squad ?? "your squad"}${when ? ` — ${when}` : ""}.`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;color:#111">
      <h2 style="margin:0 0 4px">${headline}</h2>
      <p style="margin:0 0 16px;color:#555">${r.tournament}</p>
      <p style="margin:0 0 16px;font-size:18px;font-weight:600">${r.team_name}</p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">${rows}</table>
      <p style="margin:0 0 4px;font-size:14px">
        Team handicap: <b>${total}</b> pins each individual game
      </p>
      <p style="margin:0 0 16px;font-size:14px">
        Baker handicap: <b>${baker}</b> pins each game
      </p>
      ${r.scratch ? `<p style="margin:0 0 12px;font-size:14px">Scratch division: <b>entered</b> (+$60)</p>` : ""}
      <p style="margin:0;color:#555;font-size:14px">${note}</p>
      <p style="margin:16px 0 0;color:#888;font-size:12px">
        Averages are verified before squad day. Reply to this email with any corrections.
      </p>
    </div>`;

  const resend = new Resend(key);
  const { error: sendError } = await resend.emails.send({
    from,
    to: r.captain_email,
    subject: r.waitlisted
      ? `Waiting list — ${r.tournament}`
      : `You're in — ${r.tournament}`,
    html,
  });

  if (sendError) {
    return NextResponse.json({ ok: false, error: sendError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
