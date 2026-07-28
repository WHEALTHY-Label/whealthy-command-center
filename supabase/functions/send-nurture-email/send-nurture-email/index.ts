// ============================================================
// EDGE FUNCTION: send-nurture-email
// Deploy as: send-nurture-email
// Called by pg_cron every 10 minutes. Processes due emails
// from nurture_queue, builds archetype-personalized HTML,
// sends via Resend API, logs to page_events.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// ARCHETYPE LABELS (human-readable)
// ============================================================
const ARCHETYPE_LABELS: Record<string, string> = {
  "owned-by-caffeine": "Owned by Caffeine",
  "wired-but-scattered": "Wired but Scattered",
  "sharp-until-2pm": "Sharp Until 2PM",
  "running-on-fumes": "Running on Fumes",
  "skeptical-steward": "The Skeptical Steward",
};

// ============================================================
// 75 COPY BLOCKS: 5 archetypes × 15 email positions
// Each block: { subject, preheader, headline, body, cta_text?, cta_url? }
// ============================================================

interface CopyBlock {
  subject: string;
  preheader: string;
  headline: string;
  body: string;
  cta_text?: string;
  cta_url?: string;
}

type ArchetypeCopy = Record<number, CopyBlock>;

// ----------------------------------------------------------
// OWNED BY CAFFEINE
// ----------------------------------------------------------
const OWNED_BY_CAFFEINE: ArchetypeCopy = {
  1: {
    subject: "Your pattern has a name, {{first_name}}.",
    preheader: "The quiz found something specific about your mornings.",
    headline: "Your Pattern: Owned by Caffeine",
    body: `The quiz didn't tell you something you didn't already know. It named it.\n\nYour alarm goes off and the first thought isn't about the day — it's about the cup. Not because you love coffee. Because you need it to function. The second cup isn't a choice either. It's the cost of the first one wearing off.\n\nThis is the Owned by Caffeine pattern. It's not a weakness. It's what happens when energy gets outsourced to a substance instead of governed by a rhythm.\n\n73% of stewards carrying your kind of responsibility show this exact pattern. You're not broken. You're just running on borrowed energy — and the interest rate is compounding.`,
  },
  2: {
    subject: "What \"owned by caffeine\" actually looks like.",
    preheader: "This is what your pattern does to your day.",
    headline: "The Pattern, Hour by Hour",
    body: `Here's what the Owned by Caffeine pattern actually does to your day — not in theory, but in practice.\n\n6:00 AM — The alarm is a starting gun for the coffee maker. You're not awake. You're chemically prompted.\n\n9:30 AM — The first cup wore off. You reach for the second one without thinking about it. This is the dependency loop: the thing that wakes you up is also the thing you need to recover from.\n\n1:00 PM — Post-lunch fog. Your body wants rest. Your schedule doesn't care. Cup three.\n\n3:30 PM — Jittery but not sharp. Energy without direction. You're moving but not producing.\n\n6:00 PM — You come home running on whatever's left. The people who matter most get the version of you that caffeine already used up.\n\nThis isn't about coffee being bad. It's about the loop being in control instead of you.`,
  },
  3: {
    subject: "The dependency loop — and the one thing that breaks it.",
    preheader: "One governance principle for your specific pattern.",
    headline: "Breaking the Loop Without Losing Function",
    body: `The reason most people can't reduce caffeine isn't discipline. It's dependency architecture. Your body adapted to the substance, so removing it creates a gap. The gap feels like failure. So you go back.\n\nHere's the governance principle for your pattern: you don't remove the cup. You replace what the cup was doing.\n\nThe caffeine isn't giving you energy. It's suppressing the adenosine that tells your body it's tired. Real governance means building the rhythm that produces alertness without borrowing it from a chemical.\n\nStep one isn't quitting coffee. Step one is noticing the second cup — the one that happens on autopilot — and asking: am I choosing this, or is the pattern choosing for me?\n\nThat question is the beginning of governance. Not willpower. Awareness.`,
    cta_text: "This is what the Stewards community works through together.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  4: {
    subject: "The real cost of borrowed energy.",
    preheader: "Not shame. Just math.",
    headline: "What the Pattern Costs You",
    body: `This isn't a guilt trip. It's an accounting.\n\nEvery cup of borrowed energy has an interest payment. Not in dollars — in clarity, in patience, in presence.\n\nThe afternoon fog that costs you your sharpest thinking hours — that's interest. The short temper at 6pm when your kids want your attention — that's interest. The inability to be still, to pray without your mind racing, to sit in silence without reaching for the phone — that's interest.\n\nThe pattern doesn't just take energy. It takes the quality of the hours you already have.\n\n30 more days in this pattern means 30 more evenings where your family gets what's left. 90 days means a full quarter of afternoons running on fumes and calling it normal.\n\nThe pattern isn't punishing you. It's compounding. And the longer it runs, the more it costs.`,
  },
  5: {
    subject: "A governed morning for the caffeine pattern.",
    preheader: "What the first 90 minutes could actually look like.",
    headline: "The First 90 Minutes, Governed",
    body: `Right now your morning starts with a chemical. Here's what a governed version of the same morning looks like — same schedule, different architecture.\n\nMinute 0-15: Wake. Water first. Not because coffee is evil, but because hydration is the foundation the body actually needs before stimulation. 16oz, room temperature.\n\nMinute 15-30: Movement. Doesn't need to be a workout. Walk, stretch, breathe. The goal is to tell your nervous system it's time to be alert — without outsourcing that signal to caffeine.\n\nMinute 30-60: Your first governed energy input. This is where a functional blend replaces the dependency cup — something that supports clarity without the crash cycle.\n\nMinute 60-90: Your first focused block of work. The clarity window. Not jittery, not buzzed. Clear.\n\nThis isn't about removing coffee from your life. It's about removing the dependency from your morning. The difference between choosing a cup and needing one is governance.`,
  },
  6: {
    subject: "What stability actually feels like.",
    preheader: "Not a buzz. Not a crash. Something in between.",
    headline: "The Feeling You Forgot Existed",
    body: `When you've been in the caffeine loop long enough, you forget what stable energy feels like. You know \"on\" and you know \"crashing.\" The space between them disappeared.\n\nStability isn't a feeling of being amped. It's the absence of the dip. It's 2pm and you're still thinking clearly — not because something kicked in, but because nothing wore off.\n\nIt's coming home at 6pm and still having something to give. Not performing energy. Actually having it.\n\nStewards who break the caffeine loop don't describe it as feeling \"great\" or \"amazing.\" They describe it as feeling normal — for the first time in years. Clarity without the spike. Presence without the cost.\n\nThat's governed energy. Not a high. A baseline that holds.`,
    cta_text: "The Stewards community is where this gets practiced daily.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  7: {
    subject: "The 2pm decision that changes the whole afternoon.",
    preheader: "One midday principle for the caffeine pattern.",
    headline: "Midday Governance",
    body: `The caffeine pattern has a critical junction around 1-2pm. This is when the morning cups are fully metabolized and your body hits the natural circadian dip. Most people in your pattern respond with another cup.\n\nThat third cup is the most expensive one. It doesn't give you clean afternoon energy. It gives you scattered, jittery semi-alertness that crashes again by 4pm. And it disrupts your sleep architecture, which means tomorrow's first cup is even more necessary.\n\nThe governed alternative: replace the third cup with something that supports the afternoon without extending the dependency cycle. Hydration with electrolytes. A functional blend without the caffeine spike.\n\nThe midday principle for your pattern is this: the afternoon is not a problem to solve with more stimulation. It's a rhythm to support with the right foundation.\n\nNotice the 2pm reach. That's your governance checkpoint. What you do in that moment determines the rest of the day — and how much of yourself you bring home.`,
  },
  8: {
    subject: "\"But I've tried cutting back before.\"",
    preheader: "The most common objection your pattern holds — answered.",
    headline: "You Tried. Here's Why It Didn't Hold.",
    body: `If you've tried reducing caffeine before and felt worse, that's not failure. That's withdrawal. And withdrawal is proof of the pattern, not proof that coffee is what you need.\n\nThe reason cold-turkey doesn't work for the caffeine pattern is simple: you're removing the substance without replacing the system. Your body adapted to outsourced energy. When you take it away, there's a gap. The gap feels terrible. So you go back.\n\nGovernance isn't removal. It's replacement. You don't just stop the dependency — you build the rhythm that makes the dependency unnecessary.\n\nThat's what makes the Stewards approach different from every \"30-day caffeine detox\" you've scrolled past. This isn't about willpower. It's about architecture.\n\nThe community works through this exact transition together — not with meal plans and motivational quotes, but with daily rhythm practice specific to each energy pattern.`,
    cta_text: "This is what gets worked through live inside the community.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  9: {
    subject: "A full governed day — your pattern, reimagined.",
    preheader: "Morning to evening. No dependency. No crash.",
    headline: "One Governed Day, Start to Finish",
    body: `Here's what a full day looks like when the caffeine pattern is governed — not eliminated, governed.\n\nMorning: You wake up and hydrate first. Your energy input is functional, not dependent. Clarity arrives without the spike.\n\nMidday: The transition between morning and afternoon happens without a second stimulant. Steady output. Focused work. Not wired, not dull — governed.\n\nAfternoon: The 2pm checkpoint passes without the reach. Electrolytes and a clean rhythm carry the back half of the day. You're still sharp at 4pm.\n\nEvening: You come home with something left. Patience isn't performance — it's real. The people who matter don't get your scraps.\n\nNight: Sleep comes naturally because your system isn't still processing the 3pm cup. Tomorrow starts from a real baseline, not a chemical one.\n\nThis isn't fantasy. This is what governance produces when the pattern stops running the day.`,
    cta_text: "The community is where this rhythm gets built.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  10: {
    subject: "Carrying well across everything that matters.",
    preheader: "Faith, family, work — they all need the same thing from you.",
    headline: "What Carrying Well Actually Requires",
    body: `You carry responsibility across multiple arenas. Faith. Family. Work. Each one demands presence, clarity, patience. None of them care that the other ones are also pulling on you.\n\nWhen energy is borrowed, the tax shows up everywhere. Short with your kids because the afternoon crash stole your patience. Distracted in prayer because the caffeine jitters won't let your mind settle. Reactive at work because the third cup gave you agitation instead of focus.\n\nGoverned energy doesn't give you more hours. It gives you more of yourself within the hours you already have.\n\nStewardship — real stewardship — starts with the body. Not because the body is most important, but because it's the vehicle for everything else. You can't carry faith, family, and work well on borrowed fuel.\n\nThe pattern has a name. The alternative has a rhythm. And the rhythm starts with governing the thing you've been outsourcing.`,
    cta_text: "The Stewards community exists for exactly this pattern.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  11: {
    subject: "What to track this week.",
    preheader: "Three things to notice. That's it.",
    headline: "The Governance Checkpoint",
    body: `You don't need a complete overhaul this week. You need three observations.\n\n1. Count the cups. Not to judge. To know. Write down every caffeinated drink for three days. The number isn't the problem — the autopilot is. How many of those were decisions vs. reflexes?\n\n2. Notice the 2pm reach. When the afternoon dip hits, what do you reach for? The answer tells you what your pattern defaults to when governance isn't present.\n\n3. Check the 6pm version. When you walk through the door at the end of the day, what's left? Rate it honestly: 1-10, how present are you? This is the real scoreboard.\n\nThese three data points tell you exactly where the pattern is running your day. No shame. Just clarity. The steward who can see the pattern clearly is already halfway to governing it.\n\nThe community tracks these checkpoints together — not as a challenge, but as a daily practice.`,
    cta_text: "The community is where accountability meets rhythm.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  12: {
    subject: "Borrowed energy vs. governed energy — your version.",
    preheader: "The difference is everything.",
    headline: "Two Versions of the Same Day",
    body: `Borrowed energy: the alarm rings and the coffee maker is the first relationship of the day. Energy comes fast, leaves faster. The second cup chases the first. The third chases the second. By 3pm you're running on chemical credit. By 6pm the bill comes due. The people who matter get what's left after the substance took its cut.\n\nGoverned energy: the morning starts with hydration, then a functional input that supports clarity without creating dependency. The rhythm holds through midday without a second stimulant. The afternoon carries itself. Evening arrives and you still have something to give.\n\nSame person. Same responsibilities. Same 24 hours. Different architecture.\n\nBorrowed energy always comes due. Governed energy compounds. The question isn't whether you have enough energy — it's whether the energy you're using belongs to you, or whether you're paying rent on it every single day.`,
    cta_text: "Join the community where governed energy is the standard.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  13: {
    subject: "What stewards in your pattern notice after 30 days.",
    preheader: "Not miracles. Shifts.",
    headline: "30 Days of Governance: What Changes",
    body: `Stewards who have governed the caffeine pattern for 30 days don't report dramatic transformations. They report something more useful: awareness.\n\nThe first thing that shifts is the morning. The cup becomes a choice instead of a requirement. They still drink coffee — but the relationship with it changes. It's preference, not dependency.\n\nThe second shift is the afternoon. The 2pm crash softens. Not because willpower increased, but because the foundation underneath changed. When hydration and rhythm replace stimulation, the afternoon holds.\n\nThe third shift is the evening. This is the one stewards mention most. Not more energy — more presence. Coming home and being actually available. Patience that isn't performed.\n\nThese aren't product results. They're pattern results. What happens when the loop gets interrupted and a rhythm takes its place.\n\n30 days doesn't fix everything. But it proves the pattern can be governed — and that proof changes what feels possible.`,
    cta_text: "The community is where 30-day rhythms get built and held.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  14: {
    subject: "The pattern doesn't fix itself in isolation.",
    preheader: "You already know this.",
    headline: "Why Alone Doesn't Work",
    body: `You've known about this pattern for a while. Maybe years. You've probably tried to adjust it on your own — cut back for a week, switch to decaf, try a cold-turkey run that lasted three days.\n\nThe pattern held. Not because you lack discipline, but because patterns are structural. They're wired into your routine, your environment, your defaults. Changing a pattern in isolation is like trying to renovate a house while you're living in it — alone.\n\nGovernance happens in community. Not because you need accountability partners to police your coffee intake. Because rhythm is contagious. When you're surrounded by people who are practicing governed energy daily, the pattern loses its grip.\n\nThe Stewards community isn't a support group. It's a standard. A place where governed energy is normal, where the caffeine loop is understood, and where the daily rhythm gets practiced alongside people carrying the same weight you carry.\n\nYou don't have to figure this out alone.`,
    cta_text: "You don't have to figure this out alone.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  15: {
    subject: "One thing about your pattern you haven't heard yet.",
    preheader: "This is the last email in this sequence.",
    headline: "The Truth About the Caffeine Pattern",
    body: `Here's what nobody tells the person in the caffeine pattern:\n\nThe dependency isn't about caffeine. It's about trust.\n\nYou don't trust your body to produce energy on its own anymore. At some point — maybe years ago — you stopped believing that your own system could sustain you through a full day. So you outsourced it. Cup by cup, you handed the controls to a substance and called it \"just how I function.\"\n\nBut you weren't always this way. There was a time when you woke up and felt alert without chemical intervention. When afternoons didn't require a reload. When evenings had margin.\n\nThat version of you isn't gone. It's buried under a dependency loop that trained your body to forget what its own energy feels like.\n\nGovernance isn't about adding something. It's about trusting the rhythm your body already knows how to run — and giving it the foundation to do it.\n\nThis is the last email in this sequence. The pattern has a name. The alternative has a community. Whenever you're ready, the door is open.`,
    cta_text: "The Stewards community is ready when you are.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
};

// ----------------------------------------------------------
// WIRED BUT SCATTERED
// ----------------------------------------------------------
const WIRED_BUT_SCATTERED: ArchetypeCopy = {
  1: {
    subject: "Your pattern has a name, {{first_name}}.",
    preheader: "The quiz found something specific about how your energy moves.",
    headline: "Your Pattern: Wired but Scattered",
    body: `You don't lack energy. You lack direction for it.\n\nThe quiz identified the Wired but Scattered pattern — and if you're honest, you already knew. You're on from the moment you wake up. Ideas firing, tasks stacking, conversations running in parallel. You move fast. You start things. You're never not busy.\n\nBut at the end of the day, when you look at what actually got finished — what moved the needle — the list is shorter than the effort deserves.\n\nThis isn't laziness. It's misdirected energy. 68% of high-responsibility stewards report this exact pattern: plenty of fuel, no filter.\n\nYou don't need more energy. You need a governance system that aims what you already have.`,
  },
  2: {
    subject: "What \"wired but scattered\" actually costs you.",
    preheader: "Your day, mapped honestly.",
    headline: "The Pattern in Motion",
    body: `Here's what the Wired but Scattered pattern does to your day:\n\n7:00 AM — You're already thinking about twelve things before your feet hit the floor. The energy is there. The direction isn't.\n\n9:00 AM — Three tasks started, none finished. An email half-written, a project tab open, a call you meant to make. Everything feels urgent. Nothing feels complete.\n\n12:00 PM — You've been busy all morning but can't name what you produced. The energy spent doesn't match the output.\n\n3:00 PM — Still wired. Still scattered. The engine is running hot but the wheels are spinning. You switch between tasks like changing radio stations.\n\n6:00 PM — You're tired but can't explain from what. You didn't rest because you were always \"on.\" You didn't produce because nothing landed.\n\nThe Wired pattern doesn't burn out from exhaustion. It burns out from inefficiency — maximum effort, fractional return.`,
  },
  3: {
    subject: "The one principle that aims scattered energy.",
    preheader: "Not more energy. A filter for what you have.",
    headline: "The Filter Principle",
    body: `Most productivity advice tells scattered people to slow down. That doesn't work for your pattern because the energy isn't optional — it's how you're wired.\n\nThe governance principle for the Wired but Scattered pattern isn't about reducing energy. It's about installing a filter.\n\nA filter does one thing: it separates signal from noise. Right now, your energy treats every input as equally urgent. The email, the idea, the notification, the conversation — they all get the same voltage.\n\nGovernance means choosing three things each morning that get your directed energy — and letting everything else receive your maintenance energy. Directed energy is focused, intentional, aimed. Maintenance energy is autopilot — the things that need to happen but don't need your best.\n\nThe scattered pattern breaks when you stop giving everything your A-game and start giving three things your A-game. The rest gets handled. It just doesn't get your fire.\n\nThat's the filter. Simple to understand. Requires practice to hold.`,
    cta_text: "This is what the Stewards community practices together.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  4: {
    subject: "The hidden cost of being \"always on.\"",
    preheader: "What scattered energy takes from the people who matter.",
    headline: "Always On, Never Landing",
    body: `The scattered pattern has a cost that doesn't show up in your work metrics. It shows up at home.\n\nWhen you're wired all day — energy flying in every direction — by evening you've got nothing aimed left. Your body is still buzzing but your capacity for presence is spent.\n\nYour kids want focused attention. You give them distracted proximity. Your partner wants a real conversation. You give them half-listening while your mind processes the eleven things you didn't finish. Prayer or silence asks for stillness. Your nervous system won't cooperate.\n\nThe cost of scattered energy isn't just unfinished tasks. It's unfinished presence.\n\nYou're not neglecting the people who matter on purpose. You're just arriving to them with an engine that's been redlining all day. There's heat but no horsepower left.\n\nNaming this cost isn't about guilt. It's about seeing clearly what the pattern takes — so you can decide whether to keep paying it.`,
  },
  5: {
    subject: "A governed morning for the scattered pattern.",
    preheader: "The first 60 minutes that aim the whole day.",
    headline: "Morning Architecture for Scattered Energy",
    body: `The Wired but Scattered pattern starts running before your morning does. Your mind is already twelve steps ahead. The governance starts in the first 60 minutes.\n\nMinute 0-10: Wake. Hydrate. Don't reach for the phone. The phone is a scattering device — every notification adds a thread your brain will try to process simultaneously.\n\nMinute 10-20: Write down every thought that's already in your head. All of it. This isn't journaling. It's a brain dump. Get it out of your operating memory and onto paper.\n\nMinute 20-30: From that list, circle three. These are today's directed-energy targets. Everything else goes to maintenance. This is the filter installation.\n\nMinute 30-60: Your first focused block starts here. One thing. No tabs. No switching. Set a timer if it helps. This is what aimed energy feels like — and for your pattern, it might feel unfamiliar at first.\n\nThe scattered pattern doesn't need less energy. It needs a morning that tells that energy where to land.`,
  },
  6: {
    subject: "What focused energy actually feels like.",
    preheader: "Not slow. Not dull. Aimed.",
    headline: "The Difference Between Wired and Governed",
    body: `You know what wired feels like — the buzzing, the multi-track processing, the sense of being on without being effective.\n\nGoverned energy for the scattered pattern feels different. It's not less. It's aimed.\n\nImagine the same voltage you carry right now, but running through a single channel instead of twelve. The output doesn't decrease — it concentrates. One task gets your full fire instead of eleven tasks getting sparks.\n\nStewards who govern their scattered pattern describe it the same way: \"I did less and produced more.\" Not because they worked harder, but because they stopped dispersing.\n\nFocused energy isn't about being calm. It's about being deliberate. You can still be intense, driven, fired up — but the fire has a target instead of a blast radius.\n\nThat shift — from scattered to aimed — changes the quality of everything. Your work, your conversations, your rest, your faith.`,
    cta_text: "The Stewards community practices this daily.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  7: {
    subject: "The midday reset for scattered energy.",
    preheader: "What to do when the threads start multiplying.",
    headline: "The 1PM Checkpoint",
    body: `By midday, the scattered pattern has accumulated threads. Open loops. Unfinished tasks. Half-formed ideas. Your energy is still there, but it's dispersed across so many channels that none of them are getting real voltage.\n\nHere's the midday governance principle: stop and re-filter.\n\nAt 1pm (or whenever your midday break falls), take 5 minutes:\n\n1. Name what you actually completed this morning. Not started — completed.\n2. Look at your three directed-energy targets from the morning. How many got your real focus?\n3. For the afternoon, choose ONE thing that gets your best energy. One.\n\nThe scattered pattern wants to spread. Governance narrows. The afternoon doesn't need to be a continuation of morning chaos. It can be a fresh filter.\n\nHydrate. Reset. Pick one target. Give it your fire. Let the rest be maintenance.\n\nThis 5-minute checkpoint is the difference between a day that felt busy and a day that was productive.`,
  },
  8: {
    subject: "\"But this is just how I'm wired.\"",
    preheader: "The objection every scattered steward holds.",
    headline: "Wired Doesn't Mean Ungovernable",
    body: `The most common thing stewards in the scattered pattern say is: \"This is just how my brain works.\"\n\nAnd they're right — partially. The wiring is real. Some people genuinely process in parallel. They see connections others miss. They generate ideas faster than most people can write them down.\n\nBut \"wired this way\" doesn't mean \"ungovernable.\" A river is powerful precisely because it's channeled. Remove the banks and you get a flood — energy everywhere, destruction instead of production.\n\nYour wiring is an asset. The scattering is what happens when the asset runs without governance.\n\nYou don't need to change how your brain works. You need a system that channels it. Morning filters. Midday resets. Directed-energy blocks. These aren't restrictions — they're riverbanks.\n\nThe Stewards community is full of people with this exact wiring. The difference isn't personality — it's practice. Governed energy for the scattered pattern isn't a personality change. It's an infrastructure upgrade.`,
    cta_text: "This is what gets worked through live inside the community.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  9: {
    subject: "What a full governed day looks like for your pattern.",
    preheader: "Same energy. Different architecture.",
    headline: "A Governed Day, Wired but Aimed",
    body: `Morning: Wake, hydrate, brain dump, filter. Three targets named before the day starts. First focused block lands on target one. The energy is there — it's just aimed.\n\nMidmorning: Target one completed or advanced meaningfully. Brief break. Movement. The energy recharges but the filter holds — you don't scatter into twelve new things.\n\nMidday: Reset checkpoint. What landed? What's next? One afternoon target chosen. Lunch is fuel, not multitasking.\n\nAfternoon: The one target gets your directed energy. Everything else — emails, messages, admin — gets maintenance-level attention. Not ignored. Just not given your fire.\n\nEvening: You arrive home knowing what you accomplished because it was specific. The buzzing subsides because the energy was spent on targets, not scattered across noise. Presence is possible because the engine isn't still redlining.\n\nSame person. Same wiring. Same energy. Different day. The difference is governance.`,
    cta_text: "The community is where this rhythm gets built.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  10: {
    subject: "When scattered energy hits faith, family, and work.",
    preheader: "All three need the same thing from you: focus.",
    headline: "Carrying Well Requires Aim",
    body: `Scattered energy doesn't just affect your productivity. It affects every arena you carry.\n\nFaith asks for stillness. Scattered energy makes silence feel unbearable. Your mind races through prayer. Devotional time becomes another task to check off instead of a rhythm to inhabit.\n\nFamily asks for presence. Scattered energy gives proximity without attention. You're in the room but not in the moment. Your kids learn early that you're always busy — not because you work too much, but because your attention is always elsewhere.\n\nWork asks for depth. Scattered energy produces breadth — lots of things touched, nothing completed well. Your capacity is enormous but your output doesn't reflect it.\n\nAll three arenas need the same thing from you: aimed energy. The kind that stays in the room. The kind that finishes what it starts. The kind that doesn't scatter at the first notification.\n\nGovernance gives you that. Not by reducing who you are, but by aiming who you are.`,
    cta_text: "The Stewards community exists for exactly this pattern.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  11: {
    subject: "Three things to track this week.",
    preheader: "Simple observations. Big data.",
    headline: "Your Governance Metrics",
    body: `This week, track three things. No apps needed. Just awareness.\n\n1. Morning filter compliance. Each morning, name your three directed-energy targets. At the end of the day, count how many actually got your focused attention. The gap between planned and practiced is your governance metric.\n\n2. Context switches. Set a small tally on your desk. Every time you switch from one task to another before the first is complete, mark it. Don't try to reduce it yet — just count. Awareness precedes governance.\n\n3. Evening presence score. When you sit down with your family or enter your evening space, rate your presence 1-10. Not your energy level — your focus. Can you stay in a conversation without your mind pulling you elsewhere?\n\nThese three numbers — filter compliance, context switches, presence score — tell the full story of whether your energy is governed or scattered.\n\nThe community tracks these together. Not as competition — as daily practice.`,
    cta_text: "The community is where accountability meets daily rhythm.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  12: {
    subject: "Scattered vs. governed — two versions of you.",
    preheader: "Same energy. Opposite results.",
    headline: "The Split Screen",
    body: `Scattered: you start the day with energy and no filter. Twelve things get attention. None get depth. By 3pm you've been busy for eight hours and can't name what you finished. Evening arrives and you're exhausted from dispersion, not production.\n\nGoverned: you start the day with energy and a filter. Three things get your fire. The rest gets handled on maintenance mode. By 3pm, three meaningful things are complete. Evening arrives and the energy was spent on targets — so presence is possible.\n\nSame person. Same wiring. Same responsibilities. The difference is architecture.\n\nScattered energy is a garden hose with no nozzle — water everywhere, nothing watered deeply. Governed energy is the same hose with a nozzle — pressure, direction, impact.\n\nYou've been running without the nozzle. Governance installs it. Not once — daily. And daily practice is what makes the scattered pattern finally productive instead of just busy.`,
    cta_text: "Join the community where governed energy is the standard.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  13: {
    subject: "What changes after 30 days of aimed energy.",
    preheader: "The shifts stewards in your pattern report.",
    headline: "30 Days Governed: What's Different",
    body: `Stewards who practice governed energy for 30 days with the scattered pattern report three consistent shifts:\n\nFirst: the morning gets quieter. Not less energized — less chaotic. The filter becomes automatic. You wake up and know what gets your fire today. The twelve-thread brain dump still happens, but it takes 5 minutes instead of running all day.\n\nSecond: completion increases. The number of things started stays the same (you're still wired that way), but the number of things finished goes up. Dramatically. Because directed energy produces output that scattered energy never can.\n\nThird: people notice. Your family notices you're more present. Your team notices you're more reliable. You notice that evenings feel different — not drained, but satisfied. The exhaustion was never from working hard. It was from dispersing.\n\nThese aren't product effects. They're pattern effects. What happens when scattered wiring meets governed practice.`,
    cta_text: "The community is where 30-day rhythms get built and held.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  14: {
    subject: "You can't filter alone.",
    preheader: "The pattern holds because the environment reinforces it.",
    headline: "Why Isolation Doesn't Govern Scattering",
    body: `You've tried to focus before. Bought the planner. Downloaded the app. Set the intention. And within a week, the scattering returned.\n\nNot because you're undisciplined. Because the pattern is environmental. Every notification, every open tab, every \"quick question\" from a colleague — the world is designed to scatter you. And fighting that alone is like trying to stay dry in a rainstorm with willpower.\n\nGovernance happens in community because community changes the environment. When the people around you are practicing directed energy, your default shifts. The filter stops being something you force and starts being something you inhabit.\n\nThe Stewards community is full of people with your exact wiring — high-energy, multi-threaded, carrying real responsibility. The difference isn't talent or discipline. It's that they practice governance daily, together, with a system that turns scattered into aimed.\n\nYou don't have to figure this out alone. And honestly — for this pattern — alone is why it hasn't worked yet.`,
    cta_text: "You don't have to figure this out alone.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  15: {
    subject: "The truth about your wiring no one tells you.",
    preheader: "Last email. One thing you haven't heard.",
    headline: "What Your Scattering Actually Is",
    body: `Here's what nobody tells the person with the scattered pattern:\n\nYour scattering isn't a flaw. It's a misapplied gift.\n\nThe ability to see twelve connections simultaneously, to generate ideas faster than you can capture them, to carry energy that never fully turns off — that's not a disorder. That's capacity.\n\nThe problem was never the wiring. The problem is that nobody taught you how to govern it. So the capacity became chaos. The gift became noise. And you spent years calling yourself scattered when you were actually just ungoverned.\n\nEvery great leader, builder, and steward who carries this wiring went through the same realization: the energy isn't the issue. The architecture is.\n\nGovernance doesn't reduce who you are. It aims who you are. And when that energy finally has direction — when the river gets its banks — the output is extraordinary.\n\nThis is the last email in this sequence. Your pattern has a name. Your energy has potential that scattered practice has been wasting. The community is there when you're ready to aim it.`,
    cta_text: "The Stewards community is ready when you are.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
};

// ----------------------------------------------------------
// SHARP UNTIL 2PM
// ----------------------------------------------------------
const SHARP_UNTIL_2PM: ArchetypeCopy = {
  1: {
    subject: "Your pattern has a name, {{first_name}}.",
    preheader: "You're not imagining the afternoon collapse.",
    headline: "Your Pattern: Sharp Until 2PM",
    body: `You're not imagining it. The morning works. You're clear, productive, sharp — and then somewhere around 2pm, it falls apart.\n\nThe quiz identified the Sharp Until 2PM pattern. You have real energy in the first half of the day. Your best thinking, your clearest decisions, your most productive hours — they all land before lunch.\n\nThen the crash hits. Not a gradual decline. A wall. Focus drops. Clarity dissolves. The afternoon becomes something to survive, not something to use.\n\n81% of stewards carrying this pattern report \"faking it\" through the afternoon. Performing alertness while running on fumes. Giving the second half of the day to maintenance mode while the real work waits until tomorrow morning.\n\nYour mornings aren't the problem. Your afternoons are unarchitected. And the cost is half your day — every day.`,
  },
  2: {
    subject: "Where your day actually breaks.",
    preheader: "The anatomy of the afternoon wall.",
    headline: "The Collapse, Mapped",
    body: `The Sharp Until 2PM pattern has a specific architecture. Understanding it is the first step to governing it.\n\n7-11 AM: Peak clarity. Your cortisol is naturally high, your circadian rhythm supports alertness, and whatever you consumed in the morning is still working. This is real energy.\n\n11:30 AM - 12:30 PM: Lunch. This is where the architecture starts to break. Most stewards in this pattern eat whatever's convenient — high glycemic, carb-heavy, fast. Blood sugar spikes.\n\n1:00 PM: The transition window. Your body begins processing the meal. Blood glucose is rising, then crashing. The circadian afternoon dip (which everyone has) combines with the glycemic crash.\n\n2:00 PM: The wall. It's not one thing — it's two things compounding. Natural circadian dip plus dietary crash equals a clarity collapse that no amount of willpower can override.\n\n2-6 PM: Survival mode. The second half of your day runs at 40% of the morning's capacity.\n\nThe afternoon isn't failing you randomly. The architecture is predictable — which means it's governable.`,
  },
  3: {
    subject: "The one principle that holds the afternoon.",
    preheader: "Afternoon governance starts before 2pm.",
    headline: "Afternoon Architecture",
    body: `Here's the governance principle for the Sharp Until 2PM pattern: the afternoon is won or lost between 11am and 1pm.\n\nThe crash at 2pm isn't random. It's the result of what happens in the transition window — the two hours where your energy shifts from morning clarity to afternoon survival.\n\nThree things determine whether the wall hits:\n\n1. What you eat at lunch. High glycemic meals (bread, pasta, fast food) create a blood sugar spike-and-crash cycle that lands right at 2pm. Protein, fat, and vegetables hold glucose stable.\n\n2. Whether you hydrate through the morning. Dehydration compounds the circadian dip. Most stewards in your pattern haven't had water since their morning coffee.\n\n3. Whether your energy system has a second-half foundation. Morning clarity runs on cortisol and stimulants. Afternoon clarity needs a different input — electrolytes, sustained nutrition, functional support.\n\nThe principle is simple: architect the transition window and the afternoon holds. Ignore it and the wall is guaranteed.`,
    cta_text: "This is what the Stewards community works through together.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  4: {
    subject: "What losing your afternoon actually costs.",
    preheader: "Half your productive hours. Every day.",
    headline: "The Cost of the Wall",
    body: `Let's do the math on the Sharp Until 2PM pattern.\n\nIf you're sharp from 7am to 2pm, that's seven productive hours. If the afternoon collapses, you're running at maybe 40% capacity from 2pm to 6pm — that's another four hours at partial output.\n\nEffective daily output: roughly 8.5 hours of equivalent productivity out of an 11-hour working day. But here's the part that hurts: the work that requires your best thinking gets compressed into the morning. Anything complex, creative, or high-stakes has to happen before lunch.\n\nThat means: hard conversations get avoided in the afternoon. Strategic thinking gets postponed. Deep work gets scheduled for tomorrow morning — where it competes with everything else.\n\nOver a week, you're losing approximately 12 quality hours. Over a month, 50. Over a year, 600 hours of your sharpest capacity — gone to an unarchitected afternoon.\n\nThe wall isn't just uncomfortable. It's expensive. In output, in opportunity, and in the version of yourself that gets to exist after 2pm.`,
  },
  5: {
    subject: "The governed morning that protects the afternoon.",
    preheader: "Morning decisions that hold through 5pm.",
    headline: "Morning Choices, Afternoon Consequences",
    body: `Your morning is already good. The goal isn't to fix it — it's to extend it.\n\nThe Sharp Until 2PM pattern has strong morning architecture. What it lacks is transition protection. Here's how to build that into the morning without adding complexity:\n\nWake + Hydrate: Water before coffee. 16oz minimum. You're starting the hydration foundation that prevents the 2pm dehydration compound.\n\nMorning Energy Input: Whatever you use for morning clarity, pair it with sustained nutrition — not just stimulation. Functional inputs that support the whole day, not just the first half.\n\n10:30 AM Pre-Lunch Foundation: This is the governance move most people skip. Before lunch, have a hydration input with electrolytes. It sets the floor for the afternoon. Think of it as the bridge you build before you need it.\n\nLunch Architecture: Protein and fat first. Vegetables second. Carbs last (if at all). This isn't a diet. It's blood sugar governance. Stable glucose = stable afternoon.\n\nThese four decisions — made before 1pm — determine whether the wall hits or the day holds.`,
  },
  6: {
    subject: "What clarity past 2pm actually feels like.",
    preheader: "Not wired. Not crashing. Steady.",
    headline: "The Afternoon That Holds",
    body: `You've adapted to the wall so thoroughly that you might have forgotten what a clear afternoon feels like.\n\nIt's not the same as the morning. Morning clarity is high-voltage — cortisol-driven, sharp, fast. Afternoon clarity is different. It's steady. Not explosive, but sustained. The thinking is slower but deeper. The focus is calmer but present.\n\nStewards who govern their afternoon don't describe it as \"feeling great.\" They describe it as \"still being there.\" Still sharp at 3pm. Still able to think clearly at 4pm. Still making real decisions at 5pm instead of deferring everything to tomorrow.\n\nThe most common reaction: \"I didn't realize how much I was compensating.\" The afternoon crash was so normalized that surviving it felt like a skill. Governance removes the need for that survival.\n\nClarity past 2pm changes the value of your day. Not just in output — in quality. The afternoon stops being something to endure and starts being usable.`,
    cta_text: "The Stewards community practices afternoon governance daily.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  7: {
    subject: "The 1:30pm move that changes everything.",
    preheader: "One midday intervention for your pattern.",
    headline: "The Transition Protocol",
    body: `The Sharp Until 2PM pattern has one critical governance window: 1:00-1:30pm. What happens in this 30-minute block determines whether the afternoon holds or collapses.\n\nAt 1:00pm — before the wall arrives — do three things:\n\n1. Hydrate with electrolytes. Not water alone. Your body has been running on morning stimulation for six hours. It needs mineral support, not just volume. This is the foundation move.\n\n2. Move for five minutes. Walk. Stretch. Stand. Movement signals your nervous system to stay alert through the circadian dip. It doesn't need to be exercise — it needs to be intentional.\n\n3. Set one afternoon target. Not a list. One thing that gets your focused energy from 2-4pm. Everything else is maintenance. The afternoon doesn't need to match the morning's volume — it needs to deliver one thing well.\n\nThis 30-minute protocol costs nothing and changes the entire second half of your day. The wall hits when the transition is unmanaged. Manage the transition and the wall softens.`,
  },
  8: {
    subject: "\"I just need to push through it.\"",
    preheader: "The objection your pattern holds — and why it costs you.",
    headline: "Pushing Through Is Not Governance",
    body: `The most common response to the afternoon wall is to push through it. More coffee. More willpower. More forcing yourself to look at the screen even though nothing's landing.\n\nPushing through feels productive. It isn't. Here's why:\n\nDecisions made during the crash are lower quality. Emails sent at 3pm by a depleted brain create more work tomorrow. Creative thinking in the fog produces nothing. The \"push through\" approach doesn't recover lost productivity — it creates the illusion of activity while quality drops.\n\nAnd the cost extends beyond work. Pushing through the afternoon means arriving home empty. The push took everything that was left. Family gets the aftermath.\n\nGovernance isn't about powering through the wall. It's about building the architecture so the wall doesn't hit. The difference between surviving the afternoon and actually using it is not effort — it's preparation.\n\nThe Stewards community doesn't teach \"push harder.\" It teaches \"build better.\" And for the Sharp Until 2PM pattern, the afternoon is where that building matters most.`,
    cta_text: "This gets worked through live inside the community.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  9: {
    subject: "A full day that doesn't collapse at 2pm.",
    preheader: "Morning through evening. Governed.",
    headline: "The Full Day, Architected",
    body: `Morning: Strong as always. Hydration first, energy input second. Your morning clarity is real — governance doesn't change it, it protects it.\n\n10:30 AM: Pre-lunch hydration with electrolytes. The bridge gets built before you need it.\n\nLunch: Protein-forward. Stable glucose. No spike-crash cycle.\n\n1:00 PM: Transition protocol. Hydrate, move, set one afternoon target.\n\n2:00 PM: The wall... doesn't hit. Not because willpower blocked it, but because the architecture held. Clarity is softer than the morning but present. Real.\n\n3:30 PM: Still thinking clearly. One focused block completed. The afternoon produced something meaningful instead of just time passed.\n\n5:30 PM: Day ends with energy remaining. Not wired. Not crashing. Governed.\n\n7:00 PM: Home. Present. The afternoon didn't steal what was meant for the evening.\n\nThis isn't a perfect day. It's a governed one. The difference is that the second half contributes instead of collapses.`,
    cta_text: "The community is where this daily rhythm gets built.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  10: {
    subject: "What your family gets when the afternoon holds.",
    preheader: "Faith, family, work — they all need the second half of your day.",
    headline: "The Evening Depends on the Afternoon",
    body: `When the afternoon collapses, the evening inherits the damage.\n\nFaith gets the leftovers. Prayer after a crashed afternoon is just going through motions. Your body is there, your spirit is depleted. The stillness that faith requires feels impossible when your system has been in survival mode for four hours.\n\nFamily gets what survived. You come home and the patience is gone. Not because the day was hard — the morning was fine. Because the afternoon drained everything the morning built. Your kids don't know you crashed at 2pm. They just know that Dad seems tired again.\n\nWork gets tomorrow's problem. Every afternoon that collapses creates a backlog that compresses tomorrow's morning even further. The cycle tightens.\n\nWhen the afternoon holds — when governance keeps clarity through 5pm — the evening is different. You arrive home with capacity. Patience is real, not performed. Stillness is possible.\n\nThe afternoon is the hinge. Everything that matters in the evening depends on what happens between 1 and 5pm.`,
    cta_text: "The Stewards community exists for exactly this.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  11: {
    subject: "Three things to watch this week.",
    preheader: "Your afternoon governance data.",
    headline: "The Afternoon Scorecard",
    body: `Track three things this week. No tools needed — just honest observation.\n\n1. The wall time. Each day, note when your clarity drops. Is it consistently 2pm? Earlier? Later? The exact timing tells you how much your transition window matters. If it's always 2pm, the lunch architecture is the lever.\n\n2. What you ate at lunch. Write it down for three days. Then note your 3pm clarity. The correlation will be obvious. High-glycemic lunches produce walls. Protein-forward lunches hold.\n\n3. The 6pm check. When you get home, honestly rate: am I present or performing? 1-10. This is the ultimate metric — because the whole point of afternoon governance is what it gives back to the evening.\n\nThese three data points — wall time, lunch content, evening presence — map your pattern perfectly. Once you see the connections, you can't unsee them.\n\nThe community uses these exact checkpoints as daily governance practice.`,
    cta_text: "The community is where these checkpoints become daily practice.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  12: {
    subject: "The afternoon, two ways.",
    preheader: "Collapsed vs. governed. Same hours. Different life.",
    headline: "Two Afternoons",
    body: `Collapsed afternoon: 2pm hits and the fog rolls in. Coffee number three. Eyes on the screen but nothing processing. Three hours of fake productivity. You leave work knowing the afternoon was wasted. Home gets what survived.\n\nGoverned afternoon: 1pm transition protocol lands. Hydration holds the foundation. One focused block at 2pm produces real output. 3:30pm — still clear. Not morning-sharp, but present. 5:30pm — you close with energy remaining. Home gets a version of you that's still there.\n\nThe difference isn't willpower. It's what happens between 11am and 1pm — the hydration, the lunch choice, the 5-minute move, the electrolyte foundation.\n\nYou're giving away half your waking hours to an unarchitected transition. 4-5 hours every day where you're present but not productive, available but not sharp.\n\nGovernance reclaims the afternoon. Not perfectly. Not dramatically. But consistently — day after day, the second half of the day starts contributing instead of just existing.`,
    cta_text: "Join the community where governed energy is the standard.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  13: {
    subject: "What 30 days of afternoon governance looks like.",
    preheader: "The shifts stewards in your pattern report.",
    headline: "30 Days: What Shifts",
    body: `Stewards who practice afternoon governance for 30 days with the Sharp Until 2PM pattern report consistent shifts:\n\nWeek 1: The wall still hits, but later. Instead of 2pm, it pushes to 2:30, then 3pm. The transition protocol is new and takes conscious effort. But the difference between crashing at 2 and crashing at 3 is an entire hour of reclaimed clarity.\n\nWeek 2: The crash softens. Not eliminated — softened. The cliff becomes a slope. Clarity doesn't disappear; it dims slightly but holds. Afternoons become usable.\n\nWeek 3: The transition protocol becomes automatic. You hydrate before lunch without thinking about it. The 1pm checkpoint is habit. The afternoon target is set before you finish eating.\n\nWeek 4: The evening changes. This is where stewards notice the real impact. Not in their productivity metrics — in their presence at home. The afternoon held, so the evening has margin. Patience is real. Stillness is possible.\n\nNone of this is dramatic. It's structural. The afternoon was always governable — it just needed the architecture.`,
    cta_text: "The community is where this 30-day rhythm gets built.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  14: {
    subject: "You can't architect the afternoon alone.",
    preheader: "The pattern holds because the environment supports it.",
    headline: "Why Solo Governance Stalls",
    body: `You might have read these emails, tried the transition protocol for a few days, and then defaulted back to the crash. That's not failure. That's how patterns work.\n\nThe Sharp Until 2PM pattern is reinforced by everything around you. The lunch options at your office. The meeting schedule that ignores circadian rhythm. The culture that rewards \"pushing through\" instead of governing transitions.\n\nChanging the pattern in isolation means fighting your environment every day. It's possible but exhausting — and exhaustion is the last thing this pattern needs.\n\nGovernance in community changes the default. When the people around you are practicing afternoon architecture, your pattern has a model to follow. When someone asks \"how was your afternoon?\" and the answer matters, the protocol sticks.\n\nThe Stewards community exists for exactly this: people carrying real responsibility, practicing governed energy daily, holding the afternoon together instead of letting it collapse.\n\nYou don't have to figure this out alone. And for this pattern — alone is why the wall keeps winning.`,
    cta_text: "You don't have to figure this out alone.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  15: {
    subject: "One thing about your pattern you haven't considered.",
    preheader: "Last email. One truth.",
    headline: "The Real Issue Isn't the Afternoon",
    body: `Here's what nobody tells the person in the Sharp Until 2PM pattern:\n\nThe afternoon isn't broken. Your morning is just unsustainable.\n\nYou've been running the first half of the day on peak stimulation — cortisol, caffeine, urgency. It feels amazing. Sharp, fast, productive. But that level of output wasn't designed to last all day. It was designed to get you through danger. Fight or flight, compressed into a workday.\n\nWhen the afternoon collapses, it's not a failure. It's your body's honest response to a morning that was running too hot. The wall isn't a bug — it's the natural consequence of unsustainable morning architecture.\n\nGovernance doesn't mean making the morning less productive. It means building a foundation that lets the whole day contribute — morning intensity moderated slightly, afternoon supported properly, evening protected completely.\n\nA governed day doesn't peak and crash. It rises, holds, and lands.\n\nThis is the last email in this sequence. Your pattern has a name. The afternoon has an architecture. The community is there when you're ready to build it.`,
    cta_text: "The Stewards community is ready when you are.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
};

// ----------------------------------------------------------
// RUNNING ON FUMES
// ----------------------------------------------------------
const RUNNING_ON_FUMES: ArchetypeCopy = {
  1: {
    subject: "Your pattern has a name, {{first_name}}.",
    preheader: "You're not tired. You're depleted.",
    headline: "Your Pattern: Running on Fumes",
    body: `You're not crashing. You're just never fully on.\n\nThe quiz identified the Running on Fumes pattern — and it's not what most people think. This isn't burnout. Burnout is dramatic. This is quieter. It's the low-grade depletion that becomes so normal you stop noticing it.\n\nYou wake up at 60%. You function at 60%. You come home at 60%. And because 60% is enough to keep everything running, nobody sees the problem — least of all you.\n\n77% of stewards carrying this pattern describe themselves as \"always at 60%.\" Not enough to crash. Not enough to thrive. Just enough to keep carrying what you carry.\n\nThe Running on Fumes pattern isn't about energy spikes or crashes. It's about a baseline that quietly eroded over time. You didn't lose your energy all at once. You gave it away — piece by piece — to everyone and everything else.`,
  },
  2: {
    subject: "What 60% actually looks like across your day.",
    preheader: "You've normalized depletion. Here's the proof.",
    headline: "Functional Depletion",
    body: `Here's what the Running on Fumes pattern actually looks like — the version you've normalized:\n\n6:30 AM — Wake up not refreshed but not terrible. Just... not all the way on. Start moving because the schedule doesn't wait.\n\n9:00 AM — Working, producing, carrying. But the sharpness that used to be there feels dulled. You get things done. They just take more effort than they should.\n\n12:00 PM — Lunch is fuel, not restoration. You eat because you have to. The idea of a real break feels like a luxury for people who carry less.\n\n3:00 PM — Still going. Still functional. But the tank that was at 60% this morning is at 35%. Nobody notices because you've mastered the art of performing capacity.\n\n6:00 PM — Home. The people who need you most get what's left — which isn't much. You love them. You just don't have anything to pour out.\n\n10:00 PM — Collapse, not rest. Sleep doesn't restore because the system is too depleted to fully recover overnight.\n\nThis cycle repeats. Daily. And because it never crashes dramatically, it never gets addressed.`,
  },
  3: {
    subject: "The governance principle for the depleted steward.",
    preheader: "Not optimization. Sustainability.",
    headline: "Sustainable Output, Not Maximum Output",
    body: `Every other energy approach will tell you to optimize. Perform better. Do more with less. Stack supplements. Hack your biology.\n\nThat advice is the opposite of what the Running on Fumes pattern needs.\n\nHere's the governance principle for your pattern: sustainable output over maximum output. Always.\n\nYou're not underperforming because you lack something. You're depleted because you've been overdelivering without replenishing. The system isn't broken — it's overdrawn.\n\nGovernance for the depleted steward starts with one counter-intuitive truth: you need to take before you can give. Not selfishly. Strategically. The body that carries everyone else needs to be carried first.\n\nThat means: hydration before output. Nutrition before tasks. Rest before performance. Foundation before function.\n\nThis feels selfish to the steward who is used to being last. It isn't. It's the only way to ensure that the giving doesn't run dry.`,
    cta_text: "This is what the Stewards community practices together.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  4: {
    subject: "The cost of carrying everyone on empty.",
    preheader: "What depletion takes from the people you carry.",
    headline: "What Empty Stewardship Costs",
    body: `You carry people. Family, team, community, faith — they all lean on you. And you show up for them. Every time.\n\nBut here's what 60% stewardship actually delivers:\n\nYour kids get presence without patience. You're in the room but your capacity for gentleness is spent. The short temper that surfaces at 7pm isn't character — it's chemistry. A depleted body produces cortisol, not compassion.\n\nYour partner gets reliability without connection. You show up, you provide, you perform the role. But the intimacy that requires emotional capacity isn't possible when the tank is empty.\n\nYour faith gets duty without depth. You pray because you're supposed to. You read because it's on the schedule. But the stillness, the listening, the surrender — that requires a nervous system that isn't running on fumes.\n\nYour work gets competence without creativity. The day gets done. The excellence that used to be natural now requires effort that depletes you further.\n\nNone of this is because you don't care. It's because the tank that everyone draws from hasn't been filled. Stewardship from an empty well isn't stewardship. It's survival.`,
  },
  5: {
    subject: "A morning built for the depleted, not the optimized.",
    preheader: "Before you give anything, fill the well.",
    headline: "The Replenishment Morning",
    body: `Most morning routines are designed for performance. Wake up, activate, produce. For the Running on Fumes pattern, that's exactly backwards.\n\nYour morning needs to replenish before it produces. Here's what that looks like:\n\nMinute 0-10: Wake. Don't reach for the phone, the to-do list, or the responsibilities. The first ten minutes belong to you — not because you deserve leisure, but because the well needs filling before anyone draws from it.\n\nMinute 10-20: Hydrate deeply. Not coffee. Water with electrolytes. Your depleted system needs mineral replenishment before stimulation. This is the foundation.\n\nMinute 20-30: Stillness. Prayer, silence, breathing — whatever connects you to something bigger than the to-do list. The depleted steward needs spiritual filling alongside physical filling.\n\nMinute 30-45: Eat. Real food. Protein, fat, nutrients. Your body is the engine that carries everything else. Feed it before you drive it.\n\nMinute 45-60: Now begin. The day starts after the well has been filled — not before.\n\nThis isn't luxury. For your pattern, this is the minimum foundation that prevents further depletion.`,
  },
  6: {
    subject: "What it feels like when the baseline rises.",
    preheader: "Not 60%. Something closer to whole.",
    headline: "Above the Depletion Line",
    body: `You've lived at 60% for so long that it feels normal. Here's what stewards in your pattern describe when the baseline starts to rise:\n\nFirst: the morning feels different. Not explosive — but present. You wake up and there's something there. Not just obligation pulling you out of bed, but actual capacity to meet the day.\n\nSecond: patience returns. Not as a discipline you practice, but as a resource you actually have. The short temper softens — not because you tried harder, but because the tank has something in it.\n\nThird: creativity resurfaces. Ideas that used to require effort start flowing again. The brain that was conserving energy to survive starts spending it on creation.\n\nFourth: rest works. Sleep actually restores because the system isn't so overdrawn that eight hours can't catch up. You wake up closer to 80% instead of 60%.\n\nNone of this is dramatic. It's not a transformation story. It's the quiet return of a baseline you forgot existed. The body remembering what it feels like to be filled instead of drained.`,
    cta_text: "The Stewards community is where baselines get rebuilt.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  7: {
    subject: "The midday principle for the depleted steward.",
    preheader: "How to stop giving away the afternoon.",
    headline: "Midday Replenishment",
    body: `The Running on Fumes pattern has a specific midday failure point: the steward gives everything away in the morning and has nothing left for the afternoon.\n\nNot because the morning was hard. Because the morning was spent entirely on others. Every unit of the 60% baseline was directed outward — to tasks, to people, to obligations. By noon, the well is empty again.\n\nThe midday governance principle for your pattern: replenish at noon, don't just refuel.\n\nRefueling is eating something quick and getting back to work. Replenishing is different:\n\n1. Eat slowly. Actually sit. Not at your desk. The depleted body needs the signal that it's allowed to receive, not just produce.\n\n2. Hydrate again. Electrolytes, not just water. Your afternoon baseline depends on midday mineral replenishment.\n\n3. Take 10 minutes of nothing. Not scrolling. Not planning. Nothing. The depleted nervous system needs gaps where no one is drawing from it.\n\nThese aren't productivity hacks. They're sustainability practices. The afternoon exists. The question is whether you'll arrive to it with anything left.`,
  },
  8: {
    subject: "\"I don't have time to take care of myself.\"",
    preheader: "The objection every depleted steward carries.",
    headline: "The Self-Care Paradox",
    body: `The most common thing stewards in the Running on Fumes pattern say is: \"I don't have time for that.\" Meaning: I don't have time to eat properly, hydrate, rest, or build a morning that fills before it empties.\n\nHere's the paradox: the time you don't have for replenishment is the same time being wasted on depletion.\n\nThe afternoon at 35% capacity? That's time — spent poorly. The evening where patience runs out by 7pm? That's time — lost to emptiness. The Sunday where you're too tired to be present with your family? That's time — consumed by a pattern that never replenished.\n\nYou're not saving time by skipping your own care. You're converting quality time into depleted time. The math doesn't work.\n\nGovernance for the depleted steward isn't about adding more to the schedule. It's about front-loading replenishment so the hours you already have actually produce at capacity.\n\nThe community understands this paradox because everyone in it carries the same weight. The solution isn't motivation. It's practice.`,
    cta_text: "This is what gets practiced live inside the community.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  9: {
    subject: "A full day above the depletion line.",
    preheader: "What it looks like when the well is filled first.",
    headline: "One Governed Day — Filled Before Poured",
    body: `Morning: The well gets filled first. Hydration, stillness, nutrition — before the world gets access. You start at 75% instead of 60%. The difference is everything.\n\nMid-morning: Productive without being drained. The output comes from capacity, not compensation. You're still carrying — but the tank has margin.\n\nMidday: Replenishment. Real food, real pause, real hydration. The afternoon gets a foundation instead of scraps.\n\nAfternoon: Still functional at 3pm. Not because you pushed through, but because the system was filled. The depletion curve flattened.\n\nEvening: You arrive home with something. Patience is real. Presence is possible. The people who matter aren't getting the empty version. They're getting a steward who was filled before he was emptied.\n\nNight: Sleep starts from a reasonable baseline. Recovery is possible because the deficit wasn't as deep.\n\nThis isn't a perfect day. It's a sustainable one. And for the depleted steward, sustainable is the revolution.`,
    cta_text: "The community is where sustainable rhythm gets practiced.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  10: {
    subject: "Stewardship starts with the steward.",
    preheader: "You can't pour from what's empty.",
    headline: "The Steward Gets Filled First",
    body: `You carry faith, family, and work. That's stewardship. And you take it seriously — probably more seriously than anyone around you realizes.\n\nBut stewardship has a requirement that the depleted steward constantly ignores: the steward must be maintained.\n\nA shepherd who doesn't eat can't lead the flock. A provider who doesn't rest can't sustain the provision. A man of faith who never fills his own well can't pour into anyone else's.\n\nThis isn't selfish. This is structural. The people who depend on you need a version of you that has something to give. And right now, at 60%, what they're getting is the performance of stewardship without the substance.\n\nGovernance for your pattern starts with a decision that feels foreign: I get filled first. Not because I'm most important, but because everything I carry depends on the condition of the carrier.\n\nThe body is the vehicle. The energy is the fuel. When both are depleted, stewardship becomes survival. And your family, your faith, and your calling deserve more than survival.`,
    cta_text: "The Stewards community exists for exactly this.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  11: {
    subject: "What to notice this week.",
    preheader: "Three observations for the depleted steward.",
    headline: "The Depletion Checkpoints",
    body: `This week, notice three things:\n\n1. Your morning starting level. Before you begin producing, before the to-do list starts, take a moment and honestly rate your energy: 1-10. Do this for five days. The average is your current baseline. If it's below 7, the well isn't filling overnight.\n\n2. The first give vs. the first fill. What's the first thing you do each morning — give (check email, respond to someone, start a task) or fill (hydrate, eat, be still)? Track which one wins for five days. The ratio tells you everything about why the tank is empty.\n\n3. The 8pm capacity check. At 8pm — after dinner, after the kids, after the day — rate what's left. Not tiredness. Capacity. Could you have a meaningful conversation? Could you sit in stillness? Or are you empty?\n\nThese three data points — morning baseline, first-give-vs-first-fill, and 8pm capacity — map the depletion pattern precisely. Once you see the numbers, the pattern becomes undeniable.\n\nThe community tracks these together as daily practice.`,
    cta_text: "The community makes these checkpoints a shared rhythm.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  12: {
    subject: "Depleted vs. governed — the same steward, different fuel.",
    preheader: "Not a different life. A different foundation.",
    headline: "Two Versions of Carrying",
    body: `Depleted carrying: wake at 60%. Give before filling. Run through the morning on compensation. Hit noon empty. Push through the afternoon on fumes. Arrive home with nothing left. Love the people in front of you but have no capacity to show it. Sleep poorly because the deficit is too deep to recover.\n\nGoverned carrying: wake and fill first. Start at 75% because the morning replenished before it produced. Move through the day with margin — not abundance, but margin. Hit noon with something left. Replenish. Carry through the afternoon without collapse. Arrive home with capacity. Be present — actually present — for the people who matter.\n\nSame person. Same responsibilities. Same weight carried. Different foundation.\n\nThe difference between depletion and governance isn't dramatic. It's 15 minutes of morning replenishment. It's hydration before stimulation. It's eating before producing. It's small decisions that compound into a baseline that holds.\n\nYou've been carrying everything on an empty foundation. Governance fills the foundation first.`,
    cta_text: "Join the community where governed energy is the standard.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  13: {
    subject: "What changes after 30 days of filling first.",
    preheader: "Not transformation. Restoration.",
    headline: "30 Days: What Returns",
    body: `Stewards in the Running on Fumes pattern who practice filling-first governance for 30 days don't report transformation. They report restoration.\n\nWeek 1: The morning feels different. Not dramatically. But the 10-15 minutes of hydration, stillness, and nutrition before output creates a buffer that wasn't there before. Starting at 65% instead of 55%.\n\nWeek 2: The evening shifts. This is usually the first thing people mention. Not more energy — more presence. Coming home and being capable of a real conversation instead of just occupying space.\n\nWeek 3: Sleep improves. Not because of any product or technique, but because the daily deficit is smaller. The body can actually recover because it's not starting from as deep a hole.\n\nWeek 4: The baseline rises. 60% becomes 70%. The difference is felt everywhere — patience, creativity, presence, rest. Nothing dramatic. Just the quiet return of capacity that was always there but never got filled.\n\nThis isn't a results story. It's a restoration story. The energy was always yours. It just needed the well to stop being empty.`,
    cta_text: "The community is where restoration rhythms get held.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  14: {
    subject: "You can't restore alone.",
    preheader: "Depletion is relational. So is restoration.",
    headline: "Why the Depleted Steward Needs Community",
    body: `The Running on Fumes pattern has a structural problem with solo recovery: the same environment that depleted you is the one you're trying to recover in.\n\nThe family still needs you. The work still demands. The responsibilities don't pause because you decided to \"focus on yourself.\" So the morning replenishment lasts until the first demand hits — and then the old pattern takes over.\n\nRestoration in isolation fails because there's no external rhythm supporting it. No one asking \"did you fill first today?\" No one practicing the same replenishment alongside you. No one modeling what governed carrying looks like.\n\nThe Stewards community exists specifically for stewards carrying this weight. Not a support group where people share how tired they are. A practice community where the daily rhythm of filling-before-giving gets reinforced.\n\nYou've been trying to restore alone in the same environment that depleted you. That's like trying to fill a bucket with a hole in it. The community doesn't fill the bucket for you — it helps you patch the hole.\n\nYou don't have to carry this alone anymore.`,
    cta_text: "You don't have to carry this alone.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  15: {
    subject: "The truth about the depleted steward.",
    preheader: "Last email. One thing you need to hear.",
    headline: "What Nobody Told You About Running on Fumes",
    body: `Here's what nobody tells the person in the Running on Fumes pattern:\n\nYou didn't fail at having energy. You succeeded too well at giving it away.\n\nEvery person you carried. Every responsibility you shouldered without complaint. Every time you said \"I'm fine\" when you weren't. Every morning you started producing before you were filled. Every evening you collapsed because everything you had went somewhere else.\n\nThat's not weakness. That's the pattern of someone who takes stewardship seriously — too seriously to include themselves in the care.\n\nBut stewardship that depletes the steward isn't sustainable stewardship. It's sacrifice without renewal. And at some point, the well runs dry and the carrying becomes performance.\n\nYou're not lazy. You're not broken. You're not \"just tired.\" You're a steward who forgot that the steward gets filled first.\n\nGovernance isn't about getting more out of yourself. It's about putting something back in — daily, consistently, before the day starts drawing.\n\nThis is the last email. Your pattern has a name. The restoration has a rhythm. The community is there whenever you're ready to stop carrying on empty.`,
    cta_text: "The Stewards community is ready when you are.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
};

// ----------------------------------------------------------
// THE SKEPTICAL STEWARD
// ----------------------------------------------------------
const SKEPTICAL_STEWARD: ArchetypeCopy = {
  1: {
    subject: "Your pattern has a name, {{first_name}}.",
    preheader: "You've been here before. We know.",
    headline: "Your Pattern: The Skeptical Steward",
    body: `You took the quiz. You probably didn't expect much. And honestly — after everything you've tried, why would you?\n\nThe Skeptical Steward pattern is the simplest to identify and the hardest to serve. Because you've already been through it. The products that promised. The subscriptions that ghosted. The influencer recommendations that turned out to be ads.\n\nYour skepticism isn't a personality trait. It's earned. The average steward in this pattern has tried 4 products and abandoned all of them before finding anything that stuck.\n\nSo here's what we're not going to do in these emails: we're not going to hype. We're not going to make promises. We're not going to manufacture urgency or fabricate results.\n\nWhat we are going to do is give you information. Principles. Real patterns. Things you can verify independently. If the logic holds, you'll know. If it doesn't, you'll know that too.\n\nYour skepticism is welcome here. It's the right response to a category that has lied to you.`,
  },
  2: {
    subject: "Why everything else didn't work.",
    preheader: "Not a sales pitch. An honest diagnosis.",
    headline: "The Graveyard of Things You Tried",
    body: `Let's be honest about why previous products failed you. Not because they were all scams — some were probably decent formulations. They failed because the model was wrong.\n\nHere's what most energy products do: they sell you a substance and leave you alone with it. Take this pill. Drink this shake. Feel the difference. No context. No system. No understanding of why your energy pattern exists in the first place.\n\nSo you take the pill. Maybe you feel something for a week. Maybe you don't. Either way, the underlying pattern hasn't changed. The dependency hasn't shifted. The daily rhythm that produces depletion is still running.\n\nThe product runs out or the novelty fades, and you're back where you started — plus one more addition to the graveyard of things that didn't work.\n\nThe problem was never the pill. The problem was that nobody addressed the pattern. A product without a system is just a transaction. And your energy pattern isn't transactional — it's structural.\n\nThat's the distinction. Not a better product. A different approach.`,
  },
  3: {
    subject: "The logic behind governed energy.",
    preheader: "No hype. Just the reasoning.",
    headline: "The System Argument",
    body: `You don't respond to persuasion. So here's the logic instead.\n\nYour body runs on four inputs: hydration, nutrition, movement, and sleep. Every energy pattern — including yours — is the result of how these four inputs are architected (or not) across your day.\n\nMost energy products address one input with one substance and call it a solution. That's like fixing one tire on a car with four flats.\n\nGoverned energy is a systems approach:\n\n1. Foundation: hydration and electrolytes. This is the baseline that everything else sits on. Most people are chronically undermineralized and don't know it.\n\n2. Directed input: functional nutrition timed to your day's energy demands. Not stimulation — support. What your body needs when it needs it.\n\n3. Rhythm: the daily structure that keeps inputs consistent instead of reactive.\n\n4. Community: the accountability layer that makes the rhythm stick past week one.\n\nNo single product fixes an energy pattern. A system can — if the logic is sound and the practice is consistent.\n\nYou're welcome to poke holes in this. That's what the skeptical mind does well.`,
    cta_text: "If the logic holds, the community is where it gets practiced.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  4: {
    subject: "What skepticism actually costs.",
    preheader: "Your defenses are valid. But they have a price.",
    headline: "The Tax on Justified Skepticism",
    body: `Your skepticism is earned. It's protected you from bad products, false promises, and wasted money. It's served you well.\n\nBut earned skepticism has a cost that nobody talks about: it closes the door to things that might actually work.\n\nWhen everything gets filtered through \"I've heard this before,\" the novel gets treated the same as the fraudulent. The logical gets dismissed alongside the hyped. The systematic approach gets shelved next to the snake oil.\n\nThis isn't a criticism. It's an observation. The same filter that protects you from scams also protects you from solutions. And at some point, the cost of staying guarded exceeds the cost of being wrong.\n\nYou've spent money on things that failed. That's real. But you've also spent years in a pattern that costs you daily — in clarity, in patience, in presence, in the quality of the hours you give to the people who matter.\n\nThe question isn't whether to trust blindly. It's whether the logic holds well enough to test — knowing you can walk away if it doesn't.\n\nThat's all governance asks of the skeptical steward. Not belief. A test.`,
  },
  5: {
    subject: "A morning framework you can verify yourself.",
    preheader: "No product pitch. Just the architecture.",
    headline: "The Morning, Deconstructed",
    body: `Here's a morning governance framework. No brand mentions. No product pushes. Just the architecture — which you can test with things you already own.\n\n1. Hydrate before stimulate. Whatever you drink in the morning, put 16oz of water first. With a pinch of salt if you want to get the electrolyte benefit. This is basic physiology — overnight dehydration impairs cognitive function. Water first corrects it.\n\n2. Delay caffeine 60-90 minutes after waking. Research (Huberman, Walker, others you can verify) shows that caffeine consumed immediately on waking blocks the natural cortisol awakening response. Delaying it lets your body's own alertness system activate first.\n\n3. Eat protein within the first two hours. Protein stabilizes blood glucose, which prevents the mid-morning crash. This isn't a diet recommendation — it's glucose governance.\n\n4. Define your first focused block. One thing. 60-90 minutes. No switching. This is where your morning clarity — natural or supported — produces actual output.\n\nTest this for five days. Note how the morning feels by Day 3. If it doesn't work, you've lost nothing. If it does, you've gained data.`,
  },
  6: {
    subject: "What stable energy actually feels like.",
    preheader: "Not a buzz. Not a crash. Data.",
    headline: "The Subjective Feel of Governance",
    body: `The skeptical steward doesn't trust \"feel-good\" descriptions. So here's what governed energy actually is, described as precisely as possible:\n\nIt's the absence of dips. Not the presence of a high — the absence of the low points you've adapted to.\n\nYou know the 10am mini-crash when the first coffee wears off? That gap closes. You know the 2pm fog where thinking requires effort? That lifts. You know the 6pm depletion where patience runs out? That softens.\n\nGoverned energy doesn't feel like being \"on.\" It feels like not hitting the off-switch repeatedly throughout the day. The baseline holds instead of bouncing.\n\nStewards who experience this don't use emotional language. They use observational language: \"I was still clear at 3pm.\" \"I didn't reach for the second cup.\" \"I noticed I was more patient after work.\"\n\nThese are not testimonials. These are the physiological outcomes of consistent hydration, stable blood glucose, and proper mineral balance. They're predictable, testable, and verifiable.\n\nIf that sounds too good to be true, test the morning framework from the last email for five days. Trust your own data.`,
    cta_text: "The Stewards community runs on data, not hype.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  7: {
    subject: "The midday test.",
    preheader: "One experiment. Your own results.",
    headline: "A Controlled Afternoon Experiment",
    body: `The skeptical mind wants evidence. Here's an experiment you can run this week:\n\nDay 1-2 (Control): Eat your normal lunch. Note your clarity at 3pm on a 1-10 scale. Note your patience at 6pm. Note your overall afternoon quality.\n\nDay 3-5 (Variable): Change one thing at lunch — make it protein-forward. Chicken, eggs, fish, whatever. Reduce the bread/pasta/rice. Add a glass of water with a pinch of salt 30 minutes before eating.\n\nNote the same metrics: 3pm clarity, 6pm patience, afternoon quality.\n\nCompare the two sets. If the protein-forward days score higher, you've just demonstrated blood glucose governance with your own data. If they don't, you've lost three days of suboptimal lunches — not exactly a high cost.\n\nThis experiment costs nothing. It uses no products. It produces your own evidence. The skeptical steward doesn't need to trust a brand. Just trust your own controlled observations.\n\nThe pattern is structural. The evidence is testable. The choice to act on it is yours.`,
  },
  8: {
    subject: "\"I've heard all of this before.\"",
    preheader: "The objection we expected. And the honest answer.",
    headline: "What's Actually Different",
    body: `You've heard the hydration pitch. The protein pitch. The morning routine pitch. So what makes this different?\n\nHonestly? The information isn't different. The physiology of energy hasn't changed. Water, electrolytes, protein, rhythm — this is basic science, not a proprietary discovery.\n\nWhat's different is the system around it.\n\nEvery product you've tried gave you a substance without a structure. Take this. Feel better. Bye.\n\nGovernance isn't a substance. It's a daily practice. The morning framework, the midday checkpoint, the evening reflection — these are rhythms, not purchases. And rhythms only hold when they're practiced in community.\n\nThat's the honest differentiator. Not a better pill. A system that includes the accountability, the daily practice, and the community that makes the rhythm stick past week one.\n\nYour skepticism is about products. And it should be — most products in this category deserve skepticism. But this isn't a product pitch. It's a practice pitch. And practices are judged by consistency, not claims.\n\nThe community exists for stewards who are done with products and ready for practice.`,
    cta_text: "The community is where practice happens daily.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  9: {
    subject: "What a governed day looks like — no hype version.",
    preheader: "Straightforward. Verifiable. Practical.",
    headline: "A Governed Day, Documented",
    body: `Morning: Wake. Water with electrolytes (16oz). Wait 60 minutes for caffeine. Eat protein. First focused work block. Total governance investment: 15 minutes of intentional sequencing.\n\nMid-morning: Hydrate again. The body processes water continuously — one morning glass isn't enough. This is maintenance, not intervention.\n\nMidday: Protein-forward lunch. 5-minute pause before returning to work. Hydration checkpoint.\n\nAfternoon: Clarity holds through 3pm because blood glucose is stable and hydration is maintained. Not superhuman clarity — functional clarity. The kind that lets you finish work well instead of running on autopilot.\n\nEvening: Arrive home with capacity. Not because a product gave you a boost — because the day's architecture prevented the usual drain.\n\nThis is governance. No transformations. No breakthroughs. Just a consistently better day produced by consistently better inputs. The logic is simple. The practice is where it gets hard.\n\nEverything described above can be tested with things you already have. The community just makes the practice consistent.`,
    cta_text: "The community exists for the practice, not the product.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  10: {
    subject: "Stewardship doesn't run on skepticism.",
    preheader: "Faith, family, work — they need the full version of you.",
    headline: "What Your Skepticism Protects and What It Costs",
    body: `Your skepticism has protected your wallet. But it hasn't protected your energy, your presence, or your capacity.\n\nFaith doesn't improve because you correctly identified a scam product. Your prayer life, your sense of calling, your ability to be still — none of that benefits from justified cynicism.\n\nFamily doesn't benefit from being right about the supplement industry. Your kids need patience, not product reviews. Your partner needs presence, not proof that the last thing you tried didn't work.\n\nWork doesn't care about your healthy skepticism. It cares about your afternoon clarity, your decision quality, your sustained output.\n\nSkepticism is a defensive tool. It protects. But it doesn't build. At some point, the steward has to shift from protecting against bad solutions to testing reasonable ones.\n\nThe morning framework costs nothing to test. The midday experiment risks nothing. The governed day is verifiable with your own data.\n\nThe question isn't whether you've been burned before. You have. The question is whether that history is a reason to stay in the pattern — or information that helps you evaluate the next option more carefully.`,
    cta_text: "The Stewards community is built for careful evaluators.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  11: {
    subject: "Your own data this week.",
    preheader: "Three metrics. Your observation. No trust required.",
    headline: "The Skeptic's Scorecard",
    body: `You don't need to trust anything. You need data. Here's how to collect it.\n\nMetric 1: Morning hydration compliance. For five days, track whether you hydrated before stimulating (coffee, tea, etc.). Binary: yes or no. Then note your 10am clarity on a 1-10 scale. Plot the correlation.\n\nMetric 2: Lunch composition vs. afternoon clarity. Write down what you eat at lunch (roughly — protein-heavy, carb-heavy, mixed). Then rate your 3pm clarity 1-10. Five days of data will show the pattern clearly.\n\nMetric 3: Evening capacity. At 8pm, rate your remaining capacity 1-10. Not tiredness — capacity. Could you have a meaningful conversation? Could you be present? Track this alongside your morning and lunch data.\n\nAfter five days, you'll have your own evidence. Not ours. Yours. The correlations between morning hydration, lunch composition, and evening capacity are not subtle — they'll be obvious in your own numbers.\n\nIf the data supports governance, the community is where the daily practice gets built. If it doesn't, you've lost nothing but five days of note-taking.`,
    cta_text: "The community tracks these metrics together daily.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  12: {
    subject: "Products vs. practice — the real distinction.",
    preheader: "Why what you tried before was missing the point.",
    headline: "You Were Buying Products. This Is a Practice.",
    body: `Every product you've tried operated on the same model: buy substance → consume substance → feel different → substance runs out → feel the same → buy next substance.\n\nThat model is designed to sell, not to govern. It creates dependency on a transaction instead of building a rhythm that sustains.\n\nGovernance is a practice, not a purchase. The morning framework works with water and protein you already have. The midday checkpoint costs nothing. The evening reflection takes two minutes.\n\nProducts support the practice — they don't replace it. A functional hydration blend makes consistent mineralization easier. A governance-designed morning input replaces the dependency cup with something that sustains. But the practice is what produces the results.\n\nThis is the distinction your skepticism has been searching for. Not \"this product is better than the last one.\" But: \"this is a different model entirely.\"\n\nProducts are transactions. Practices are rhythms. Transactions end when you stop buying. Rhythms compound when you keep practicing.\n\nThe community exists because practice requires consistency, and consistency requires community.`,
    cta_text: "Join the community where practice replaces purchasing.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  13: {
    subject: "What 30 days of practice produces.",
    preheader: "Observable changes. Not marketing claims.",
    headline: "30 Days: Observable Shifts",
    body: `Stewards who practice governance for 30 days report changes that are observable, not emotional:\n\n1. Caffeine timing shifts. They stop needing the immediate morning cup. Not because willpower increased, but because the hydration-first habit produced natural morning alertness. The cup becomes a choice at 8am instead of a requirement at 6am.\n\n2. Afternoon metrics improve. The 3pm clarity score — tracked across 30 days — shows a measurable trend. Not dramatic. Typically 2-3 points on a 10-point scale. But consistent.\n\n3. Evening capacity increases. The 8pm metric shifts from 3-4 to 5-6. Again, not dramatic. But the difference between a 3 and a 6 in evening capacity is the difference between performing presence and actually being present.\n\n4. The morning practice becomes automatic. By Day 20, hydrate-before-stimulate isn't a decision. It's a default. That's the sign that the rhythm has taken hold.\n\nThese aren't product claims. They're practice outcomes — predictable, testable, and observable in your own data. If you ran the five-day experiment from the earlier email, you already have the baseline. 30 days just extends the trend.`,
    cta_text: "The community is where 30-day practices get supported.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  14: {
    subject: "Skepticism served you. Community serves you next.",
    preheader: "Different tool for a different phase.",
    headline: "From Defense to Construction",
    body: `Your skepticism got you here. It protected you from bad purchases, false promises, and empty claims. It's done its job well.\n\nBut skepticism is a defensive tool. It evaluates. It filters. It protects. What it can't do is build.\n\nBuilding a governed rhythm requires a different tool: practice. And practice — specifically the kind that sticks past week one — requires community.\n\nNot because you need cheerleaders. Because you need structure that exists outside your own willpower. A morning framework is easy to design. Practicing it for 30 days while carrying real responsibility is another thing entirely.\n\nThe Stewards community is built for people exactly like you — people who won't be persuaded by marketing but who recognize sound logic when they see it. People who need evidence, not emotion. People who have been burned and won't settle for hype.\n\nYour skepticism has been the right tool for the right phase. The next phase needs a different tool. The practice needs community. And the community is designed for people who think exactly like you do.\n\nYou don't have to figure this out alone. You just have to test it.`,
    cta_text: "You don't have to figure this out alone.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
  15: {
    subject: "One last thing the skeptical steward needs to hear.",
    preheader: "Last email. No pitch. Just one truth.",
    headline: "What Your Skepticism Is Really Protecting",
    body: `Here's what nobody tells the skeptical steward:\n\nYour skepticism isn't really about products. It's about hope.\n\nYou stopped hoping that something would work because hope has a cost. Every time you tried something and it failed, the disappointment compounded. So you built a wall — not against products, but against the vulnerability of wanting something to actually change.\n\nThat wall is rational. It's earned. And it's keeping you stuck.\n\nBecause behind the skepticism is a person who actually wants clarity, presence, energy that holds. A person who takes stewardship seriously enough to have searched for a solution multiple times. A person who hasn't given up — they've just armored up.\n\nGovernance doesn't ask you to drop the armor. It asks you to test the logic. Five days of morning hydration. Five days of lunch tracking. Your own data, your own observations, your own conclusions.\n\nThe armor can stay on. The test costs nothing. And if the data says governance works — then you have something no product ever gave you: your own evidence.\n\nThis is the last email. Your pattern has a name. The logic is testable. The community is there when your own data says it's time.`,
    cta_text: "The Stewards community is ready when your data says it's time.",
    cta_url: "https://www.skool.com/bakndcreator",
  },
};

// ============================================================
// MASTER COPY MAP
// ============================================================
const COPY_MAP: Record<string, ArchetypeCopy> = {
  "owned-by-caffeine": OWNED_BY_CAFFEINE,
  "wired-but-scattered": WIRED_BUT_SCATTERED,
  "sharp-until-2pm": SHARP_UNTIL_2PM,
  "running-on-fumes": RUNNING_ON_FUMES,
  "skeptical-steward": SKEPTICAL_STEWARD,
};

// ============================================================
// HTML EMAIL TEMPLATE BUILDER
// ============================================================
function buildEmailHtml(block: CopyBlock, firstName: string, archetypeLabel: string, position: number): string {
  const name = firstName || "Steward";
  const subject = block.subject.replace("{{first_name}}", name);
  const bodyHtml = block.body
    .split("\n\n")
    .map(p => {
      if (p.startsWith("1.") || p.startsWith("2.") || p.startsWith("3.") || p.startsWith("4.") || p.startsWith("5.")) {
        return `<p style="margin:0 0 8px;color:#e0e0e0;font-size:15px;line-height:1.65;padding-left:12px;border-left:2px solid #CCFF00;">${p}</p>`;
      }
      return `<p style="margin:0 0 16px;color:#e0e0e0;font-size:15px;line-height:1.65;">${p}</p>`;
    })
    .join("\n");

  const ctaHtml = block.cta_text && block.cta_url
    ? `<div style="margin:32px 0 0;padding:24px 0 0;border-top:1px solid #222;">
        <p style="margin:0 0 16px;color:#999;font-size:14px;line-height:1.6;">${block.cta_text}</p>
        <a href="${block.cta_url}" style="display:inline-block;background:#CCFF00;color:#080809;font-family:'Oswald',Arial Black,sans-serif;font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;padding:14px 28px;border-radius:6px;">Join the Stewards</a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#080809;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">

  <!-- LOGO -->
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-family:'Oswald',Arial Black,sans-serif;font-size:22px;font-weight:700;letter-spacing:0.06em;color:#fff;">W<span style="color:#CCFF00;">HEAL</span>THY</span>
  </div>

  <!-- HEADLINE -->
  <h1 style="font-family:'Oswald',Arial Black,sans-serif;font-size:28px;font-weight:700;color:#fff;margin:0 0 8px;line-height:1.2;">${block.headline}</h1>
  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#CCFF00;margin:0 0 24px;font-weight:600;">${archetypeLabel} · Email ${position} of 15</p>

  <!-- BODY -->
  ${bodyHtml}

  <!-- CTA -->
  ${ctaHtml}

  <!-- FOOTER -->
  <div style="margin-top:48px;padding-top:24px;border-top:1px solid #1a1a1a;">
    <p style="color:#555;font-size:11px;line-height:1.5;margin:0 0 8px;">
      You're receiving this because you completed the WHEALTHY Stewardship Mirror quiz. We respect your time and your inbox.
    </p>
    <p style="color:#555;font-size:11px;line-height:1.5;margin:0 0 8px;">
      <a href="https://whealthylabel.com" style="color:#777;text-decoration:underline;">whealthylabel.com</a> ·
      <a href="mailto:hello@whealthylabel.com" style="color:#777;text-decoration:underline;">Contact</a>
    </p>
    <p style="color:#444;font-size:10px;line-height:1.4;margin:16px 0 0;">
      *These statements have not been evaluated by the FDA and are not intended to diagnose, treat, cure, or prevent any disease. WHEALTHY products are designed to supplement a balanced diet and active lifestyle.
    </p>
    <p style="color:#444;font-size:10px;line-height:1.4;margin:8px 0 0;">
      © 2026 WHEALTHY. All rights reserved. Govern Your Energy.
    </p>
  </div>

</div>
</body>
</html>`;
}

function buildPlainText(block: CopyBlock, firstName: string, position: number): string {
  const name = firstName || "Steward";
  const subject = block.subject.replace("{{first_name}}", name);
  let text = `${block.headline}\n\n${block.body}\n`;
  if (block.cta_text && block.cta_url) {
    text += `\n---\n${block.cta_text}\n${block.cta_url}\n`;
  }
  text += `\n---\nEmail ${position} of 15 · WHEALTHY Stewards\nwhealthylabel.com\n`;
  return text;
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 1. Validate webhook secret
    const SECRET = Deno.env.get("NURTURE_WEBHOOK_SECRET");
    if (!SECRET) {
      return new Response(JSON.stringify({ error: "nurture_webhook_secret_not_configured" }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const headerSecret = req.headers.get("x-webhook-secret");
    const urlSecret = new URL(req.url).searchParams.get("secret");
    if (headerSecret !== SECRET && urlSecret !== SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2. Init Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Query for due emails (batch of 10)
    const { data: dueEmails, error: queryErr } = await supabase
      .from("nurture_queue")
      .select("*")
      .lte("scheduled_at", new Date().toISOString())
      .is("sent_at", null)
      .eq("cancelled", false)
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (queryErr) {
      console.error("Query error:", queryErr.message);
      return new Response(JSON.stringify({ error: "query_failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!dueEmails || dueEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_KEY) {
      console.error("RESEND_API_KEY not set!");
      return new Response(JSON.stringify({ error: "resend_key_missing" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Sender address — update after domain verification
    const FROM = Deno.env.get("RESEND_FROM") || "WHEALTHY <hello@whealthylabel.com>";

    let processed = 0;
    let cancelled = 0;

    for (const item of dueEmails) {
      try {
        // Double-check: is this person now an active community member?
        const { data: member } = await supabase
          .from("approved_members")
          .select("active")
          .ilike("email", item.email)
          .maybeSingle();

        if (member?.active === true) {
          // Cancel entire sequence for this contact
          await supabase
            .from("nurture_queue")
            .update({ cancelled: true, cancel_reason: "community_joined" })
            .ilike("email", item.email)
            .is("sent_at", null)
            .eq("cancelled", false);

          cancelled++;
          console.log(`Sequence cancelled at send time for ${item.email} — community member detected.`);
          continue;
        }

        // Get copy block
        const archetypeCopy = COPY_MAP[item.archetype_key];
        if (!archetypeCopy) {
          console.error(`No copy for archetype: ${item.archetype_key}`);
          continue;
        }

        const block = archetypeCopy[item.position];
        if (!block) {
          console.error(`No copy for position ${item.position} in ${item.archetype_key}`);
          continue;
        }

        const firstName = item.first_name || "Steward";
        const archetypeLabel = ARCHETYPE_LABELS[item.archetype_key] || item.archetype_key;
        const subject = block.subject.replace("{{first_name}}", firstName);

        const html = buildEmailHtml(block, firstName, archetypeLabel, item.position);
        const text = buildPlainText(block, firstName, item.position);

        // Send via Resend
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            to: [item.email],
            subject: subject,
            html: html,
            text: text,
          }),
        });

        const resendBody = await resendRes.json();

        if (!resendRes.ok) {
          console.error(`Resend failed for ${item.email} pos ${item.position}:`, JSON.stringify(resendBody));
          continue;
        }

        // Mark as sent
        await supabase
          .from("nurture_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", item.id);

        // Log to page_events
        await supabase.from("page_events").insert({
          event_type: "nurture_email_sent",
          page: "system",
          session_id: `nurture_${item.email}_${item.position}`,
          metadata: {
            email: item.email,
            archetype_key: item.archetype_key,
            position: item.position,
            subject: subject,
            resend_id: resendBody.id || null,
          },
        }).catch((e: Error) => console.warn("Event log failed:", e));

        processed++;
        console.log(`Sent email ${item.position}/15 to ${item.email} (${item.archetype_key})`);

      } catch (sendErr) {
        console.error(`Error processing nurture item ${item.id}:`, sendErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed,
      cancelled,
      total_due: dueEmails.length,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
