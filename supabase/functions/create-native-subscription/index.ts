import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@11.1.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bundleKey, email, name } = await req.json()
    
    if (!bundleKey || !email) {
      throw new Error("Missing bundleKey or email parameter")
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error("Missing STRIPE_SECRET_KEY configuration in Supabase Secrets")
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1. Create a Customer
    const customer = await stripe.customers.create({
      email: email,
      name: name || 'WHEALTHY User',
      metadata: { bundleKey }
    });

    // 2. Create a Product to attach to the subscription
    const isAll5 = bundleKey === 'all5';
    const product = await stripe.products.create({
      name: isAll5 ? 'WHEALTHY Governance System — All 5' : `WHEALTHY Routine: ${bundleKey.toUpperCase()}`,
      description: isAll5
        ? 'The complete 5-product WHEALTHY ecosystem: Genius Guice, Genius Joe, Hydration, Charge, and Boss.'
        : 'Personalized governance system designed from your energy assessment.',
    });

    // Price: $99/mo for All 5 bundle, $59.99/mo for individual routines
    const unitAmount = isAll5 ? 9900 : 5999;

    // 3. Create the Subscription with default_incomplete
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: 'usd',
            product: product.id,
            unit_amount: unitAmount,
            recurring: {
              interval: 'month',
            }
          },
          quantity: 1,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { 
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card']
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // 4. Extract the client_secret from the payment_intent
    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice.payment_intent as any;
    
    if (!paymentIntent || !paymentIntent.client_secret) {
      throw new Error("Failed to generate payment intent client secret");
    }

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
