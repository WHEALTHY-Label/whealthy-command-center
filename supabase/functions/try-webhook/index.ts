// ============================================================
// EDGE FUNCTION: try-webhook
// Deploy as: try-webhook
// Receives order_created webhooks from Baknd.io for one-time
// "Try" product purchases. Creates the order in Shopify so
// Supliful can auto-fulfill. NO membership check required.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Individual product Shopify Variant IDs (single SKU, not bundles)
const TRY_PRODUCT_MAP: Record<string, { variant_id: number; title: string; price: string }> = {
  "hydration": {
    variant_id: 52358764396826,
    title: "Hydration Powder (Lemonade)",
    price: "20.00"
  },
  "charge": {
    variant_id: 52358763610394,
    title: "Charge Powder (Cotton Candy)",
    price: "30.00"
  },
  "genius-guice": {
    variant_id: 52358764986650,
    title: "Genius Guice Focus Powder (Sour Candy)",
    price: "30.00"
  },
  "genius-joe": {
    variant_id: 52358763348250,
    title: "Genius Joe Mushroom Coffee (Medium Roast)",
    price: "34.00"
  },
  "boss": {
    variant_id: 52358764200218,
    title: "BOSS Capsules",
    price: "25.00"
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 1. Validate webhook secret
    const BAKND_SECRET = Deno.env.get("BAKND_WEBHOOK_SECRET") || "";
    const urlSecret = new URL(req.url).searchParams.get("secret");
    const headerSecret = req.headers.get("x-webhook-secret");
    const isValid = (BAKND_SECRET && (urlSecret === BAKND_SECRET || headerSecret === BAKND_SECRET));
    if (!isValid) {
      console.error("Unauthorized try-webhook call: Invalid secret.");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    console.log("Try-Webhook Payload:", JSON.stringify(payload));

    const order = payload.order || payload;
    if (!order) {
      return new Response(JSON.stringify({ error: "missing_order_data" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2. Extract customer details
    const email = (order.customer?.email || order.email || "").trim().toLowerCase();
    if (!email) {
      console.error("Try-Webhook rejected: Missing customer email.");
      return new Response(JSON.stringify({ error: "missing_email" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const customerName = order.customer?.name || order.billingDetails?.name || order.shippingDetails?.name || "";
    const phone = order.customer?.phone || order.billingDetails?.phone || order.shippingDetails?.phone || "";

    const ship = order.shippingDetails || order.billingDetails || {};
    const ship_name = ship.name || customerName || "Try Customer";
    const ship_phone = ship.phone || phone || null;
    const ship_address1 = ship.address || ship.address_line_1 || ship.street || "";
    const ship_address2 = ship.address2 || ship.address_line_2 || null;
    const ship_city = ship.city || "";
    const ship_state = ship.state || ship.province || "";
    const ship_zip = ship.zip || ship.postal_code || "";
    const ship_country = ship.country || "US";

    // 3. Match product key from items or URL path
    const items = order.items || [];
    let productKey = "";

    // Method A: Match from item title/product_id
    for (const item of items) {
      const title = String(item.title || item.name || "").toLowerCase();
      const pId = String(item.product_id || item.productId || "");

      if (title.includes("hydration") || pId === "hydration") {
        productKey = "hydration"; break;
      } else if (title.includes("charge") || pId === "charge") {
        productKey = "charge"; break;
      } else if (title.includes("genius guice") || title.includes("genius juice") || title.includes("focus") || pId === "genius-guice") {
        productKey = "genius-guice"; break;
      } else if (title.includes("genius joe") || title.includes("coffee") || pId === "genius-joe") {
        productKey = "genius-joe"; break;
      } else if (title.includes("boss") || pId === "boss") {
        productKey = "boss"; break;
      }
    }

    // Method B: Use product_key if Baknd sends it as a custom field
    if (!productKey && order.product_key) {
      productKey = order.product_key;
    }

    // Method C: Infer from checkout page URL if Baknd passes it
    if (!productKey && order.checkout_url) {
      const url = order.checkout_url.toLowerCase();
      if (url.includes("hydration")) productKey = "hydration";
      else if (url.includes("charge")) productKey = "charge";
      else if (url.includes("genius-guice") || url.includes("gg")) productKey = "genius-guice";
      else if (url.includes("gj-coffee") || url.includes("genius-joe")) productKey = "genius-joe";
      else if (url.includes("boss")) productKey = "boss";
    }

    if (!productKey || !TRY_PRODUCT_MAP[productKey]) {
      console.error(`Try-Webhook: Could not match product. Items: ${JSON.stringify(items)}, order keys: ${Object.keys(order).join(",")}`);
      return new Response(JSON.stringify({ error: "unknown_product", items_received: items }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const product = TRY_PRODUCT_MAP[productKey];
    console.log(`Matched Try product: ${productKey} -> ${product.title}`);

    // 4. Initialize Supabase (for logging)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 5. Create Shopify order (PAID, not $0 like bundles)
    const shopifyStore = Deno.env.get("SHOPIFY_STORE")!;
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN")!;

    const nameParts = ship_name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const shopifyOrderPayload = {
      order: {
        line_items: [{
          variant_id: product.variant_id,
          quantity: 1,
          price: product.price,
          title: product.title
        }],
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
        tags: "Try Product, One-Time Purchase, Baknd Checkout",
        note: `Try product order: ${product.title}. Paid via Baknd.io checkout.`
      }
    };

    console.log(`Sending Try order to Shopify:`, JSON.stringify(shopifyOrderPayload));

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

    console.log(`Shopify Try order created! Order ID:`, shopifyBody.order?.id);

    // 6. Log order to try_orders table
    const { error: logErr } = await supabase
      .from("try_orders")
      .insert({
        email: email,
        customer_name: ship_name,
        product_key: productKey,
        product_title: product.title,
        price: product.price,
        ship_name: ship_name,
        ship_phone: ship_phone,
        ship_address1: ship_address1,
        ship_address2: ship_address2,
        ship_city: ship_city,
        ship_state: ship_state,
        ship_zip: ship_zip,
        ship_country: ship_country,
        shopify_order_id: shopifyBody.order?.id || null,
        referral_code: order.ref || order.referral_code || null,
        status: "confirmed",
        source: "baknd_try_checkout"
      });

    if (logErr) {
      console.error("Failed to log try_order:", logErr.message);
      // Don't fail — Shopify order is already created
    }

    // 7. Track for potential upsell — check if customer is already a member
    const { data: existingMember } = await supabase
      .from("approved_members")
      .select("email, active")
      .ilike("email", email)
      .maybeSingle();

    const isMember = existingMember?.active === true;

    return new Response(JSON.stringify({
      success: true,
      message: "Try order processed successfully",
      shopify_order_id: shopifyBody.order?.id,
      product: productKey,
      is_existing_member: isMember
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unhandled error in try-webhook:", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
