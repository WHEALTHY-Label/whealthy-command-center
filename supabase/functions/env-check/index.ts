// disabled diagnostic. one-time env presence check, now inert.
Deno.serve(()=> new Response(JSON.stringify({status:"disabled"}),{status:410,headers:{"Content-Type":"application/json"}}));
