import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Retired Jul 20, 2026: the At a Glance (leaderboard) page was removed from The Steward's Rhythm (commit af52fa1). Inert stub.
Deno.serve(() => new Response(JSON.stringify({ retired: true }), { status: 410, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }));
