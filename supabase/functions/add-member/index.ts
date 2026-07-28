import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; firstHit: number }>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || (now - entry.firstHit) > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(email, { count: 1, firstHit: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function clean(val: unknown, maxLen = 200): string | null {
  if (val == null) return null;
  const s = String(val).trim().replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen);
  return s.length > 0 ? s : null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// Legacy quiz keys + Quiz Spec v2 pattern keys (v2 live 2026-07)
const VALID_ARCHETYPES = new Set(['owned-by-caffeine','wired-but-scattered','sharp-until-2pm','running-on-fumes','skeptical-steward','morning-dependency','energy-without-aim','low-floor','holding-it-together']);
const VALID_PATHWAYS = new Set(['customer','steward']);
const VALID_BUNDLES = new Set(['genius-joe','boss','genius-guice','charge']);
const VALID_ANCHORS = new Set(['family','work','faith','all']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50000) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // --- REQUIRED ---
    const email = clean(body.email, 254)?.toLowerCase();
    if (!email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const name = clean(body.first_name || body.name, 100);
    if (!name) {
      return new Response(JSON.stringify({ error: 'First name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isRateLimited(email)) {
      return new Response(JSON.stringify({ error: 'Too many submissions. Try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- OPTIONAL (sanitized) ---
    const last_name = clean(body.last_name, 100);
    const rawPhone = clean(body.phone, 20);
    const phone = (rawPhone && isValidPhone(rawPhone)) ? rawPhone : null;
    const rawArchetype = clean(body.archetype, 50);
    const archetype = (rawArchetype && VALID_ARCHETYPES.has(rawArchetype)) ? rawArchetype : null;
    const archetype_name = clean(body.archetype_name, 100);
    const rawAnchor = clean(body.identity_anchor, 20);
    const identity_anchor = (rawAnchor && VALID_ANCHORS.has(rawAnchor)) ? rawAnchor : null;
    // v2 quiz fields
    const rawPathway = clean(body.pathway, 20);
    const pathway = (rawPathway && VALID_PATHWAYS.has(rawPathway)) ? rawPathway : null;
    const peak_block = clean(body.peak_block, 30);
    const skeptical_flag = body.skeptical_flag === true || body.skeptical_flag === 'true';
    const rawBundleKey = clean(body.bundle_key, 50);
    const bundle_key = (rawBundleKey && VALID_BUNDLES.has(rawBundleKey)) ? rawBundleKey : null;
    const bundle_name = clean(body.bundle_name, 100);
    const rawPrice = clean(body.price, 10);
    const price = (rawPrice && (/^\d+(\.\d{1,2})?$/.test(rawPrice) || rawPrice === 'free')) ? rawPrice : null;
    const rawInterval = clean(body.price_interval, 20);
    const price_interval = (rawInterval && ['monthly','one-time','community'].includes(rawInterval)) ? rawInterval : null;
    const rawSource = clean(body.source, 50);
    const source = rawSource ? rawSource.trim().toLowerCase() : 'quiz';

    // New flat Part 1 fields
    const sex = clean(body.sex, 50) || '';
    const age_band = clean(body.age_band, 50) || '';
    const relationship = clean(body.relationship, 50) || '';
    const kids_count = typeof body.kids_count === 'number' ? Math.round(body.kids_count) : (body.kids_count === '' || body.kids_count === null || body.kids_count === undefined) ? null : parseInt(body.kids_count) || null;
    const job_type = clean(body.job_type, 50) || '';
    const hours_band = clean(body.hours_band, 50) || '';
    const consumption = clean(body.consumption, 250) || '';
    const identity_profile = clean(body.identity_profile, 50) || '';
    const load_score = typeof body.load_score === 'number' ? body.load_score : (body.load_score === '' || body.load_score === null || body.load_score === undefined) ? null : parseFloat(body.load_score) || null;
    const load_season = clean(body.load_season, 50) || '';

    // --- REFERRAL CODE (if present) ---
    const referred_by = clean(body.referred_by, 50); // Increased max length to 50 for custom affiliate links

    // --- SCORES ---
    let scores: Record<string, number> | null = null;
    if (body.scores && typeof body.scores === 'object' && !Array.isArray(body.scores)) {
      const cleaned: Record<string, number> = {};
      for (const [key, val] of Object.entries(body.scores)) {
        if (VALID_ARCHETYPES.has(key) && typeof val === 'number' && val >= 0 && val <= 50) {
          cleaned[key] = Math.round(val);
        }
      }
      if (Object.keys(cleaned).length > 0) scores = cleaned;
    }

    // --- ANSWERS ---
    let answers: Record<string, string> | null = null;
    if (body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)) {
      const cleaned: Record<string, string> = {};
      const allowedKeys = ['q1_morning','q2_cups','q3_after_lunch','q4_cut_back','q5_matters_most'];
      for (const [key, val] of Object.entries(body.answers)) {
        if (allowedKeys.includes(key)) {
          const s = clean(val, 200);
          if (s) cleaned[key] = s;
        }
      }
      if (Object.keys(cleaned).length > 0) answers = cleaned;
    }

    // --- WRITE TO DB ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch existing member row to preserve quiz/demographic data and prevent data loss
    const { data: existingMember, error: fetchErr } = await supabase
      .from('approved_members')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Error fetching existing member:', fetchErr.message);
    }

    const isQuizSource = source.includes('quiz');

    // Determine member status
    let member_status = 'lead'; // Default for new rows
    if (existingMember) {
      member_status = existingMember.member_status || 'lead';
    }
    if (!isQuizSource) {
      // Non-quiz source (e.g. Skool join webhook via Zapier) sets to member
      member_status = 'member';
    }

    // Merge incoming values with existing DB values to prevent null/empty overwrites
    const memberData: Record<string, unknown> = {
      email,
      name: name || (existingMember ? existingMember.name : null),
      last_name: last_name || (existingMember ? existingMember.last_name : null),
      phone: phone || (existingMember ? existingMember.phone : null),
      archetype: archetype || (existingMember ? existingMember.archetype : null),
      archetype_name: archetype_name || (existingMember ? existingMember.archetype_name : null),
      identity_anchor: identity_anchor || (existingMember ? existingMember.identity_anchor : null),
      bundle_key: bundle_key || (existingMember ? existingMember.bundle_key : null),
      bundle_name: bundle_name || (existingMember ? existingMember.bundle_name : null),
      price: price || (existingMember ? existingMember.price : null),
      price_interval: price_interval || (existingMember ? existingMember.price_interval : null),
      scores: scores || (existingMember ? existingMember.scores : null),
      answers: answers || (existingMember ? existingMember.answers : null),
      source: isQuizSource ? source : (existingMember ? existingMember.source : source),
      sex: sex || (existingMember ? existingMember.sex : ''),
      age_band: age_band || (existingMember ? existingMember.age_band : ''),
      relationship: relationship || (existingMember ? existingMember.relationship : ''),
      kids_count: kids_count !== null ? kids_count : (existingMember ? existingMember.kids_count : null),
      job_type: job_type || (existingMember ? existingMember.job_type : ''),
      hours_band: hours_band || (existingMember ? existingMember.hours_band : ''),
      consumption: consumption || (existingMember ? existingMember.consumption : ''),
      identity_profile: identity_profile || (existingMember ? existingMember.identity_profile : ''),
      load_score: load_score !== null ? load_score : (existingMember ? existingMember.load_score : null),
      load_season: load_season || (existingMember ? existingMember.load_season : ''),
      pathway: pathway || (existingMember ? existingMember.pathway : null),
      peak_block: peak_block || (existingMember ? existingMember.peak_block : null),
      skeptical_flag: skeptical_flag ? true : (existingMember ? existingMember.skeptical_flag === true : false),
      member_status,
    };

    // Always log referred_by if it exists (from Skool affiliates or ambassadors)
    let referral_id: number | null = null;
    if (referred_by) {
      memberData.referred_by = referred_by;

      // Also check the old ambassadors table for legacy logic
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id, referral_code, commission_rate, total_conversions, total_earned')
        .eq('referral_code', referred_by)
        .eq('status', 'active')
        .maybeSingle();

      if (ambassador) {
        // Find the most recent 'clicked' referral for this code and upgrade it
        const { data: existingRef } = await supabase
          .from('referrals')
          .select('id')
          .eq('referral_code', referred_by)
          .eq('status', 'clicked')
          .is('referred_email', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingRef) {
          // Upgrade the existing click to quiz_completed (commission-free in freemium model)
          const { data: updatedRef } = await supabase
            .from('referrals')
            .update({
              referred_email: email,
              referred_name: [name, last_name].filter(Boolean).join(' '),
              status: 'quiz_completed',
              archetype: archetype,
              bundle_key: bundle_key,
              commission_amount: null, // Commission-free for products
            })
            .eq('id', existingRef.id)
            .select('id')
            .single();

          if (updatedRef) referral_id = updatedRef.id;
        } else {
          // No click found, create a new referral record (direct link share)
          const { data: newRef } = await supabase
            .from('referrals')
            .insert({
              ambassador_id: ambassador.id,
              referral_code: referred_by,
              referred_email: email,
              referred_name: [name, last_name].filter(Boolean).join(' '),
              status: 'quiz_completed',
              archetype: archetype,
              bundle_key: bundle_key,
              commission_amount: null, // Commission-free for products
            })
            .select('id')
            .single();

          if (newRef) referral_id = newRef.id;
        }

        if (referral_id) {
          memberData.referral_id = referral_id;
        }

        // Update ambassador conversion count (no total_earned accrual on products)
        try {
          await supabase
            .from('ambassadors')
            .update({
              total_conversions: ambassador.total_conversions + 1,
              // total_earned remains unchanged
            })
            .eq('id', ambassador.id);
        } catch (ambErr) {
          console.warn('Error updating ambassador conversion count:', ambErr);
        }
      }
    }

    const { data, error } = await supabase
      .from('approved_members')
      .upsert(memberData, { onConflict: 'email' })
      .select();

    if (error) {
      console.error('DB error:', error);
      return new Response(JSON.stringify({ success: false, error: 'Database error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- AUTO-INVITE TO SKOOL (policy per Ignacio 2026-07-20: EVERYONE who completes the quiz) ---
    // Fires a Zapier Catch Hook whose zap runs Skool "Invite Member". Fully gated:
    // needs INVITE_ZAP_HOOK set, AUTO_INVITE_ENABLED=true, quiz source, not already
    // a member, never invited before. Awaited (not fire-and-forget) so the response
    // can truthfully tell the frontend the invite went out.
    let invited = false;
    try {
      const inviteHook = Deno.env.get('INVITE_ZAP_HOOK');
      const invitesOn = (Deno.env.get('AUTO_INVITE_ENABLED') || '').toLowerCase() === 'true';
      const alreadyMember = member_status === 'member';
      const alreadyInvited = !!(existingMember && existingMember.invited_at);
      if (isQuizSource && inviteHook && invitesOn && !alreadyMember && !alreadyInvited) {
        const hookRes = await fetch(inviteHook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, first_name: name }),
        });
        if (hookRes.ok) {
          invited = true;
          await supabase.from('approved_members').update({ invited_at: new Date().toISOString() }).ilike('email', email);
          console.log(`Skool invite hook fired for ${email}`);
        } else {
          console.warn(`Invite hook non-OK: ${hookRes.status}`);
        }
      }
    } catch (invErr) { console.warn('Invite hook error:', invErr); }

    // --- BAKND CRM INTEGRATION (Baknd.io / Website API) ---
    // Docs: POST /api/site/contacts — upserts by email automatically.
    // Fields: name, email, phone, tags[], properties[], note, subscribed
    try {
      const crmApiKey = Deno.env.get("BAKND_API_KEY");
      if (!crmApiKey) {
        throw new Error("BAKND_API_KEY environment variable is not defined");
      }
      const crmUrl = Deno.env.get("BAKND_API_URL") || "https://whealthylabel.com/api/site/contacts";

      // =============================================
      // TAGS — for CRM segmentation & email filters
      // =============================================
      const crmTags: string[] = isQuizSource ? ["Quiz Completed"] : ["Community Member"];

      // 1. Archetype tag (which pattern they fall into)
      if (archetype_name) {
        crmTags.push(archetype_name);
      }

      // 2. Bundle suggestion tag (which bundle was recommended)
      if (bundle_name) {
        crmTags.push(`Suggestion: ${bundle_name}`);
      }

      // 3. Individual product tags (the actual products inside their bundle)
      const PRODUCT_MAP: Record<string, string[]> = {
        "genius-joe":  ["Product: Genius Joe", "Product: Hydration Powder"],
        "boss":        ["Product: Boss Capsules", "Product: Hydration Powder"],
        "genius-guice":["Product: Genius Guice", "Product: Hydration Powder"],
        "charge":      ["Product: Charge Powder", "Product: Hydration Powder"],
      };
      if (bundle_key && PRODUCT_MAP[bundle_key]) {
        for (const pt of PRODUCT_MAP[bundle_key]) {
          if (!crmTags.includes(pt)) crmTags.push(pt);
        }
      }

      // 4. Format preference tag (capsules vs drink mix)
      const FORMAT_MAP: Record<string, string> = {
        "genius-joe":  "Format: Drink Mix",
        "boss":        "Format: Capsules",
        "genius-guice":"Format: Drink Mix",
        "charge":      "Format: Drink Mix",
      };
      if (bundle_key && FORMAT_MAP[bundle_key]) {
        crmTags.push(FORMAT_MAP[bundle_key]);
      }

      // 5. Identity anchor tag (what matters most to them)
      if (identity_anchor) {
        const anchorLabels: Record<string, string> = {
          family: "Anchor: Family",
          work: "Anchor: Work",
          faith: "Anchor: Faith",
          all: "Anchor: All",
        };
        crmTags.push(anchorLabels[identity_anchor] || `Anchor: ${identity_anchor}`);
      }

      // 6. Quiz answer tags (short segmentation labels per question)
      if (answers) {
        // Q1: Morning routine
        const q1Map: Record<string, string> = {
          "Straight to coffee": "Morning: Coffee First",
          "Quick check-in, then coffee": "Morning: Check-in Then Coffee",
          "I have a routine but caffeine runs it": "Morning: Caffeine-Led Routine",
          "I skip breakfast and just push through": "Morning: Skip and Push",
        };
        if (answers.q1_morning && q1Map[answers.q1_morning]) {
          crmTags.push(q1Map[answers.q1_morning]);
        }

        // Q2: Cups per day
        const q2Map: Record<string, string> = {
          "1-2 cups, I keep it light": "Caffeine: Light (1-2)",
          "3-4 cups, it's part of my rhythm": "Caffeine: Moderate (3-4)",
          "5+, I've lost count honestly": "Caffeine: Heavy (5+)",
          "I don't do coffee but I'm always reaching for something": "Caffeine: Non-Coffee Dependent",
        };
        if (answers.q2_cups && q2Map[answers.q2_cups]) {
          crmTags.push(q2Map[answers.q2_cups]);
        }

        // Q3: After lunch
        const q3Map: Record<string, string> = {
          "I hit a wall and reach for more caffeine": "Afternoon: Wall + More Caffeine",
          "I'm foggy but push through": "Afternoon: Foggy Push-Through",
          "I'm still sharp — for now": "Afternoon: Still Sharp",
          "I crash hard. Every. Single. Day.": "Afternoon: Daily Crash",
        };
        if (answers.q3_after_lunch && q3Map[answers.q3_after_lunch]) {
          crmTags.push(q3Map[answers.q3_after_lunch]);
        }

        // Q4: Tried cutting back
        const q4Map: Record<string, string> = {
          "Yes, and I felt worse so I went back": "History: Tried and Reverted",
          "I've thought about it but haven't tried": "History: Considering Change",
          "I don't think caffeine is the problem": "History: Doesn't See Caffeine as Issue",
          "I've tried other supplements but nothing worked": "History: Tried Supplements, Failed",
        };
        if (answers.q4_cut_back && q4Map[answers.q4_cut_back]) {
          crmTags.push(q4Map[answers.q4_cut_back]);
        }
      }

      // 7. Price tag (handles free)
      if (price) {
        const priceLabel = price === 'free' ? 'free' : `$${price}`;
        crmTags.push(`Price: ${priceLabel}/${price_interval || "community"}`);
      }

      // 8. Referral tag
      if (referred_by) {
        crmTags.push("Referred");
      }

      // 9. Source tag
      crmTags.push(`Source: ${source}`);

      // =============================================
      // PROPERTIES — custom CRM fields for raw data
      // =============================================
      const crmProperties: Array<{ name: string; type: string; value: string }> = [];

      if (archetype) {
        crmProperties.push({ name: "archetype", type: "string", value: archetype });
      }
      if (archetype_name) {
        crmProperties.push({ name: "archetype_name", type: "string", value: archetype_name });
      }
      if (bundle_key) {
        crmProperties.push({ name: "bundle_key", type: "string", value: bundle_key });
      }
      if (bundle_name) {
        crmProperties.push({ name: "bundle_name", type: "string", value: bundle_name });
      }
      if (identity_anchor) {
        crmProperties.push({ name: "identity_anchor", type: "string", value: identity_anchor });
      }
      if (price) {
        crmProperties.push({ name: "price", type: "string", value: price });
      }
      if (price_interval) {
        crmProperties.push({ name: "price_interval", type: "string", value: price_interval });
      }
      if (referred_by) {
        crmProperties.push({ name: "referred_by", type: "string", value: referred_by });
      }
      if (member_status) {
        crmProperties.push({ name: "member_status", type: "string", value: member_status });
      }

      if (sex) {
        crmProperties.push({ name: "sex", type: "string", value: sex });
      }
      if (age_band) {
        crmProperties.push({ name: "age_band", type: "string", value: age_band });
      }
      if (relationship) {
        crmProperties.push({ name: "relationship", type: "string", value: relationship });
      }
      if (kids_count !== null) {
        crmProperties.push({ name: "kids_count", type: "string", value: String(kids_count) });
      }
      if (job_type) {
        crmProperties.push({ name: "job_type", type: "string", value: job_type });
      }
      if (hours_band) {
        crmProperties.push({ name: "hours_band", type: "string", value: hours_band });
      }
      if (consumption) {
        crmProperties.push({ name: "consumption", type: "string", value: consumption });
      }
      if (identity_profile) {
        crmProperties.push({ name: "identity_profile", type: "string", value: identity_profile });
      }
      if (load_score !== null) {
        crmProperties.push({ name: "load_score", type: "string", value: String(load_score) });
      }
      if (load_season) {
        crmProperties.push({ name: "load_season", type: "string", value: load_season });
      }

      // Store individual quiz answers as properties
      if (answers) {
        if (answers.q1_morning)     crmProperties.push({ name: "q1_morning", type: "string", value: answers.q1_morning });
        if (answers.q2_cups)        crmProperties.push({ name: "q2_cups", type: "string", value: answers.q2_cups });
        if (answers.q3_after_lunch) crmProperties.push({ name: "q3_after_lunch", type: "string", value: answers.q3_after_lunch });
        if (answers.q4_cut_back)    crmProperties.push({ name: "q4_cut_back", type: "string", value: answers.q4_cut_back });
        if (answers.q5_matters_most)crmProperties.push({ name: "q5_matters_most", type: "string", value: answers.q5_matters_most });
      }

      // Store archetype scores as properties
      if (scores) {
        for (const [key, val] of Object.entries(scores)) {
          crmProperties.push({ name: `score_${key}`, type: "string", value: String(val) });
        }
      }

      // =============================================
      // BUILD & SEND CRM PAYLOAD
      // =============================================
      const crmPayload: Record<string, unknown> = {
        email: email,
        name: [name, last_name].filter(Boolean).join(" ").trim(),
        phone: phone || "",
        tags: crmTags,
        properties: crmProperties,
        subscribed: true,
        note: `Stewardship Mirror: ${archetype_name || "Unknown"} → ${bundle_name || "Unknown"}. Anchor: ${identity_anchor || "Unknown"}.`,
      };

      const crmResponse = await fetch(crmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${crmApiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "Whealthy/1.0.1",
        },
        body: JSON.stringify(crmPayload),
      });

      const crmStatus = crmResponse.status;
      const crmBody = await crmResponse.text();
      console.log(`CRM sync: status=${crmStatus}, body=${crmBody.substring(0, 300)}`);

      if (!crmResponse.ok) {
        console.warn("CRM API error:", crmStatus, crmBody.substring(0, 300));
      }
    } catch (crmErr) {
      console.error("CRM Integration error:", crmErr);
    }

    // --- NURTURE SEQUENCE INTEGRATION ---
    // Trigger nurture on quiz completion, cancel on community join
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const nurtureSecret = Deno.env.get('NURTURE_WEBHOOK_SECRET');

    if (!nurtureSecret) {
      console.error('Nurture webhook action refused: NURTURE_WEBHOOK_SECRET is not configured');
    } else if (isQuizSource && archetype) {
      // Quiz completion → trigger nurture sequence (fire and forget)
      fetch(`${supabaseUrl}/functions/v1/trigger-nurture-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': nurtureSecret },
        body: JSON.stringify({ email, first_name: name, archetype_key: archetype, bundle_key, skeptical: skeptical_flag === true }),
      }).then(r => console.log(`Nurture trigger: ${r.status}`))
        .catch(e => console.warn('Nurture trigger failed:', e));
    } else {
      // Non-quiz source (community join, Zapier, etc.) → cancel nurture sequence
      fetch(`${supabaseUrl}/functions/v1/cancel-nurture-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': nurtureSecret },
        body: JSON.stringify({ email }),
      }).then(r => console.log(`Nurture cancel: ${r.status}`))
        .catch(e => console.warn('Nurture cancel failed:', e));
    }

    return new Response(JSON.stringify({
      success: true,
      email,
      name,
      archetype: archetype_name,
      referred: !!referred_by,
      invited,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
