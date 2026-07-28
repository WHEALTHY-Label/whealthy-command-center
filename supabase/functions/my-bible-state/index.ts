// WHEALTHY — my-bible-state: save/restore a steward's reading spot in My Bible.
// Email-in-body auth to match the prayers/governor ecosystem this sits beside.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function memberId(email: string): Promise<number | null> {
  const { data } = await SB.from("approved_members").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { email, action, book, chapter, verse, mode } = await req.json();
    const cleanEmail = (email || "").toLowerCase().trim();
    if (!cleanEmail) return json({ error: "email_required" }, 400);
    const mid = await memberId(cleanEmail);
    if (!mid) return json({ error: "not_authorized" }, 401);

    if (action === "get") {
      const { data } = await SB.from("my_bible_state").select("book,chapter,verse,mode,updated_at").eq("member_id", mid).maybeSingle();
      return json({ ok: true, state: data ?? null });
    }

    if (action === "set") {
      const b = (book || "").toString().slice(0, 40);
      const c = Number.isFinite(+chapter) ? Math.max(1, Math.min(200, parseInt(chapter))) : null;
      const v = Number.isFinite(+verse) ? Math.max(1, Math.min(200, parseInt(verse))) : null;
      const m = mode === "bible_365" ? "bible_365" : "my_bible";
      if (!b || c === null) return json({ error: "book_and_chapter_required" }, 400);
      const { data, error } = await SB.from("my_bible_state")
        .upsert({ member_id: mid, book: b, chapter: c, verse: v, mode: m, updated_at: new Date().toISOString() }, { onConflict: "member_id" })
        .select("book,chapter,verse,mode,updated_at").single();
      if (error) return json({ error: "save_failed" }, 500);
      return json({ ok: true, state: data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
