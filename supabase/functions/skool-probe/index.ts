import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Diagnostic probe retired after Page 8 went live. Inert; does not read the cookie or call Skool.
Deno.serve(() => new Response(JSON.stringify({ disabled: true, note: 'diagnostic probe retired' }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }));
