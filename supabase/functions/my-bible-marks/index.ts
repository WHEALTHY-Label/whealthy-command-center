// WHEALTHY — my-bible-marks: highlights + private notes on verses in My Bible.
// Email-in-body auth to match the prayers/governor ecosystem. Marks are private to the member.
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
    const { email, action, id, book, chapter, verse, kind, body } = await req.json();
    const cleanEmail = (email || "").toLowerCase().trim();
    if (!cleanEmail) return json({ error: "email_required" }, 400);
    const mid = await memberId(cleanEmail);
    if (!mid) return json({ error: "not_authorized" }, 401);

    if (action === "list") {
      let q = SB.from("my_bible_marks").select("id,book,chapter,verse,kind,body,created_at").eq("member_id", mid);
      if (book) q = q.eq("book", String(book).slice(0, 40));
      if (Number.isFinite(+chapter)) q = q.eq("chapter", parseInt(chapter));
      const { data, error } = await q.order("created_at", { ascending: false }).limit(2000);
      if (error) return json({ error: "list_failed" }, 500);
      return json({ ok: true, marks: data });
    }

    if (action === "add") {
      const b = (book || "").toString().slice(0, 40);
      const c = parseInt(chapter), v = parseInt(verse);
      if (!b || !Number.isFinite(c) || !Number.isFinite(v)) return json({ error: "book_chapter_verse_required" }, 400);
      if (kind !== "highlight" && kind !== "note") return json({ error: "invalid_kind" }, 400);
      const note = kind === "note" ? String(body || "").slice(0, 2000) : null;
      if (kind === "note" && !note) return json({ error: "note_body_required" }, 400);
      // highlight is idempotent per verse (unique index); note appends.
      if (kind === "highlight") {
        const { data, error } = await SB.from("my_bible_marks")
          .upsert({ member_id: mid, book: b, chapter: c, verse: v, kind: "highlight", body: null }, { onConflict: "member_id,book,chapter,verse", ignoreDuplicates: false })
          .select().maybeSingle();
        if (error) {
          // unique partial index may not match onConflict target; fall back to existence check
          const { data: ex } = await SB.from("my_bible_marks").select("id").eq("member_id", mid).eq("book", b).eq("chapter", c).eq("verse", v).eq("kind", "highlight").maybeSingle();
          if (ex) return json({ ok: true, mark: ex, deduped: true });
          const ins = await SB.from("my_bible_marks").insert({ member_id: mid, book: b, chapter: c, verse: v, kind: "highlight" }).select().single();
          if (ins.error) return json({ error: "add_failed" }, 500);
          return json({ ok: true, mark: ins.data });
        }
        return json({ ok: true, mark: data });
      }
      const { data, error } = await SB.from("my_bible_marks").insert({ member_id: mid, book: b, chapter: c, verse: v, kind: "note", body: note }).select().single();
      if (error) return json({ error: "add_failed" }, 500);
      return json({ ok: true, mark: data });
    }

    if (action === "remove") {
      if (!id) return json({ error: "id_required" }, 400);
      const { error } = await SB.from("my_bible_marks").delete().eq("id", id).eq("member_id", mid);
      if (error) return json({ error: "remove_failed" }, 500);
      return json({ ok: true, removed: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
