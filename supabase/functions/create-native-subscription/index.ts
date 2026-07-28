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
    const product = await stripe.products.create({
      name: `WHEALTHY Routine: ${bundleKey.toUpperCase()}`,
      description: 'Personalized governance system designed from your energy assessment.',
    });

    // 3. Create the Subscription with default_incomplete
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: 'usd',
            product: product.id,
            unit_amount: 5999, // $59.99
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

    // 3. Extract the client_secret from the payment_intent
    // The TypeScript inference for expanded objects can sometimes require asserting
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
