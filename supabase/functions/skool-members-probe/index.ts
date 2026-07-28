import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Retired diagnostic. Its job (confirming the Skool members roster is pullable) is done;
// the real work lives in skool-members-sync + skool-member-search. Inert.
Deno.serve(() => new Response(JSON.stringify({ retired: true }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
