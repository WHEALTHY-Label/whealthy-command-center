// ============================================================
// EDGE FUNCTION: baknd-webhook (FREEMIUM MODEL, v10)
// Receives order_created webhooks from Baknd.io, maps items to
// Shopify Variant IDs, and creates the order in Shopify for
// Supliful fulfillment.
//
// FREEMIUM RULES (July 2026):
// - Products are sold to EVERYONE. No membership rejection.
//   Money is collected by baknd checkout; this webhook only
//   drives fulfillment records.
// - Duplicate protection is scoped to double-fired webhooks:
//   same email + same bundle within 15 minutes.
// - bundle_subscriptions rows (auto_order) are created ONLY
//   for orders detected as subscriptions. One-time buyers get
//   a bundle_orders record only.
// - Shopify push unchanged ($0 line items: payment already
//   captured by baknd; Shopify order exists for fulfillment).
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Shopify Variant IDs mapping for WHEALTHY bundles
const BUNDLE_MAP: Record<string, { name: string; variants: Array<{ id: number; qty: number; title: string }> }> = {
  "genius-joe": {
    name: "Genius Joe + Hydration",
    variants: [
      { id: 52358763348250, qty: 1, title: "Genius Joe Mushroom Coffee (Medium Roast)" },
      { id: 52358764396826, qty: 1, title: "Hydration Powder (Lemonade)" }
    ]
  },
  "boss": {
    name: "Boss + Hydration",
    variants: [
      { id: 52358764200218, qty: 1, title: "BOSS" },
      { id: 52358764396826, qty: 1, title: "Hydration Powder (Lemonade)" }
    ]
  },
  "genius-guice": {
    name: "Genius Guice + Hydration",
    variants: [
      { id: 52358764986650, qty: 1, title: "Genius Guice Focus Powder (Sour Candy)" },
      { id: 52358764396826, qty: 1, title: "Hydration Powder (Lemonade)" }
    ]
  },
  "charge": {
    name: "Charge + Hydration",
    variants: [
      { id: 52358763610394, qty: 1, title: "Charge Powder (Cotton Candy)" },
      { id: 52358764396826, qty: 1, title: "Hydration Powder (Lemonade)" }
    ]
  },
  "all5": {
    name: "The Complete Steward Governance System (5 Products)",
    variants: [
      { id: 52358763348250, qty: 1, title: "Genius Joe Mushroom Coffee (Medium Roast)" },
      { id: 52358764200218, qty: 1, title: "BOSS" },
      { id: 52358764986650, qty: 1, title: "Genius Guice Focus Powder (Sour Candy)" },
      { id: 52358763610394, qty: 1, title: "Charge Powder (Cotton Candy)" },
      { id: 52358764396826, qty: 1, title: "Hydration Powder (Lemonade)" }
    ]
  },
  "all-5": {
    name: "The Complete Steward Governance System (5 Products)",
    variants: [
      { id: 52358763348250, qty: 1, title: "Genius Joe Mushroom Coffee (Medium Roast)" },
      { id: 52358764200218, qty: 1, title: "BOSS" },
      { id: 52358764986650, qty: 1, title: "Genius Guice Focus Powder (Sour Candy)" },
      { id: 52358763610394, qty: 1, title: "Charge Powder (Cotton Candy)" },
      { id: 52358764396826, qty: 1, title: "Hydration Powder (Lemonade)" }
    ]
  },
  "complete-bundle": {
    name: "The Complete Steward Governance System (5 Products)",
    variants: [
      { id: 52358763348250, qty: 1, title: "Genius Joe Mushroom Coffee (Medium Roast)" },
      { id: 52358764200218, qty: 1, title: "BOSS" },
      { id: 52358764986650, qty: 1, title: "Genius Guice Focus Powder (Sour Candy)" },
      { id: 52358763610394, qty: 1, title: "Charge Powder (Cotton Candy)" },
      { id: 52358764396826, qty: 1, title: "Hydration Powder (Lemonade)" }
    ]
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 1. Validate webhook, accept query param or header (unchanged)
    const BAKND_SECRET = Deno.env.get("BAKND_WEBHOOK_SECRET") || "";
    const urlSecret = new URL(req.url).searchParams.get("secret");
    const headerSecret = req.headers.get("x-webhook-secret");
    const isValid = (BAKND_SECRET && (urlSecret === BAKND_SECRET || headerSecret === BAKND_SECRET));
    if (!isValid) {
      console.error("Unauthorized webhook call: Invalid secret.");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    console.log("Received Baknd.io Webhook Payload:", JSON.stringify(payload));

    const order = payload.order || payload;
    if (!order) {
      return new Response(JSON.stringify({ error: "missing_order_data" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2. Extract customer details (unchanged)
    const email = (order.customer?.email || order.email || "").trim().toLowerCase();
    if (!email) {
      console.error("Webhook rejected: Missing customer email.");
      return new Response(JSON.stringify({ error: "missing_email" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const customerName = order.customer?.name || order.billingDetails?.name || order.shippingDetails?.name || "";
    const phone = order.customer?.phone || order.billingDetails?.phone || order.shippingDetails?.phone || "";

    const ship = order.shippingDetails || order.billingDetails || {};
    const ship_name = ship.name || customerName || "WHEALTHY Customer";
    const ship_phone = ship.phone || phone || null;
    const ship_address1 = ship.address || ship.address_line_1 || ship.street || "";
    const ship_address2 = ship.address2 || ship.address_line_2 || null;
    const ship_city = ship.city || "";
    const ship_state = ship.state || ship.province || "";
    const ship_zip = ship.zip || ship.postal_code || "";
    const ship_country = ship.country || "US";

    // 3. Match items to a bundle key (unchanged)
    const items = order.items || [];
    let bundleKey = "";
    for (const item of items) {
      const pId = String(item.product_id || item.productId || "");
      const title = String(item.title || item.name || "").toLowerCase();

      if (pId === "218" || title.includes("genius joe")) {
        bundleKey = "genius-joe";
        break;
      } else if (pId === "219" || title.includes("boss")) {
        bundleKey = "boss";
        break;
      } else if (pId === "220" || title.includes("genius guice") || title.includes("genius juice")) {
        bundleKey = "genius-guice";
        break;
      } else if (pId === "221" || title.includes("charge")) {
        bundleKey = "charge";
        break;
      }
    }

    if (!bundleKey) {
      console.log(`Webhook ignored: No matching bundle found in items. Items:`, JSON.stringify(items));
      return new Response(JSON.stringify({ success: true, message: "ignored_non_bundle_order" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const bundleInfo = BUNDLE_MAP[bundleKey];
    console.log(`Matched bundle: ${bundleKey} -> ${bundleInfo.name}`);

    // 3b. Detect whether this order is a SUBSCRIPTION purchase.
    // baknd payload shapes vary; check the common flags plus item titles.
    const flatOrder = JSON.stringify(order).toLowerCase();
    const isSubscription = Boolean(
      order.subscription || order.is_subscription || order.recurring ||
      order.subscription_id || order.subscriptionId ||
      items.some((i: any) => i.subscription || i.recurring || /subscription|monthly/i.test(String(i.title || i.name || ""))) ||
      /"(billing_period|billing_interval|recurring_interval)"/.test(flatOrder)
    );
    console.log(`Order type: ${isSubscription ? "subscription" : "one-time"}`);

    // 4. Supabase (service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 5. FREEMIUM: no membership rejection. Look up member status for
    // tagging/analytics only. Anyone who paid gets fulfilled.
    let memberStatus = "non-member";
    try {
      const { data: member } = await supabase
        .from("approved_members")
        .select("email, member_status")
        .ilike("email", email)
        .maybeSingle();
      if (member) memberStatus = member.member_status || "lead";
    } catch (_e) { /* non-fatal */ }

    // 5b. Duplicate protection, scoped to double-fired webhooks:
    // same email + same bundle within the last 15 minutes.
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentDup } = await supabase
      .from("bundle_orders")
      .select("id, created_at")
      .ilike("email", email)
      .eq("bundle_key", bundleKey)
      .gte("created_at", fifteenMinAgo)
      .limit(1)
      .maybeSingle();

    if (recentDup) {
      console.log(`Duplicate webhook blocked: ${email} / ${bundleKey} already recorded at ${recentDup.created_at}`);
      return new Response(JSON.stringify({
        success: true,
        message: "duplicate_webhook_ignored",
        existing_order_id: recentDup.id
      }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 6. Push order to Shopify (unchanged: $0 line items, payment was
    // captured by baknd; this order exists to drive Supliful fulfillment)
    const shopifyStore = Deno.env.get("SHOPIFY_STORE")!;
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN")!;

    const nameParts = ship_name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const shopifyOrderPayload = {
      order: {
        line_items: bundleInfo.variants.map((v) => ({
          variant_id: v.id,
          quantity: v.qty,
          price: "0.00", // Payment captured by baknd checkout; fulfill as $0
          title: v.title
        })),
        email: email,
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          address1: ship_address1,
          address2: ship_address2,
          city: ship_city,
          province: ship_state,
          zip: ship_zip,
          country: ship_country,
          phone: ship_phone
        },
        billing_address: {
          first_name: firstName,
          last_name: lastName,
          address1: ship_address1,
          address2: ship_address2,
          city: ship_city,
          province: ship_state,
          zip: ship_zip,
          country: ship_country,
          phone: ship_phone
        },
        financial_status: "paid",
        tags: `WHEALTHY Bundle Order, Native Checkout, ${isSubscription ? "Subscription" : "One-Time"}, ${memberStatus === "member" ? "Member" : "Non-Member"}`
      }
    };

    console.log(`Sending order payload to Shopify:`, JSON.stringify(shopifyOrderPayload));

    const shopifyRes = await fetch(`https://${shopifyStore}.myshopify.com/admin/api/2023-04/orders.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopifyToken
      },
      body: JSON.stringify(shopifyOrderPayload)
    });

    const shopifyBody = await shopifyRes.json();

    if (!shopifyRes.ok) {
      console.error(`Shopify order creation failed:`, JSON.stringify(shopifyBody));
      return new Response(JSON.stringify({ error: "shopify_error", detail: shopifyBody }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    console.log(`Shopify order successfully created! Order ID:`, shopifyBody.order?.id);

    // 7. Log order to bundle_orders (every paid order, member or not)
    const { error: logErr } = await supabase
      .from("bundle_orders")
      .insert({
        email: email,
        bundle_key: bundleKey,
        bundle_name: bundleInfo.name,
        ship_name: ship_name,
        ship_phone: ship_phone,
        ship_address1: ship_address1,
        ship_address2: ship_address2,
        ship_city: ship_city,
        ship_state: ship_state,
        ship_zip: ship_zip,
        ship_country: ship_country,
        status: "confirmed",
        source: isSubscription ? "native_checkout_subscription" : "native_checkout",
        confirmed_at: new Date().toISOString()
      });

    if (logErr) {
      console.error("Failed to log order in bundle_orders:", logErr.message);
      // Do not fail: Shopify order already created.
    }

    // 8. Subscription records ONLY for actual subscription purchases.
    // One-time buyers never get an auto_order standing record.
    let nextEligible: string | null = null;
    if (isSubscription) {
      nextEligible = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const { error: subErr } = await supabase
        .from("bundle_subscriptions")
        .upsert({
          email: email,
          full_name: ship_name,
          bundle_key: bundleKey,
          bundle_name: bundleInfo.name,
          ship_name: ship_name,
          ship_phone: ship_phone,
          ship_address1: ship_address1,
          ship_address2: ship_address2,
          ship_city: ship_city,
          ship_state: ship_state,
          ship_zip: ship_zip,
          ship_country: ship_country,
          auto_order: true,
          status: "active",
          next_eligible_date: nextEligible,
          updated_at: new Date().toISOString()
        }, { onConflict: "email" });

      if (subErr) {
        console.error("Failed to update bundle_subscriptions:", subErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Order processed successfully",
      order_type: isSubscription ? "subscription" : "one-time",
      member_status: memberStatus,
      shopify_order_id: shopifyBody.order?.id,
      next_eligible_date: nextEligible
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unhandled error processing webhook:", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
