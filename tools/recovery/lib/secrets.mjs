const rules = [
  ['supabase-service-role', /SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]/i],
  ['stripe-secret', /(?:STRIPE_SECRET_KEY\s*[:=]|\bsk_(?:live|test)_[A-Za-z0-9]+)/i],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['openai-key', /\bsk-proj-[A-Za-z0-9_-]{20,}/],
  ['baknd-api-key', /\bBAKND_API_KEY\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['resend-api-key', /\bRESEND_API_KEY\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['elevenlabs-api-key', /\bELEVENLABS_API_KEY\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['shopify-access-token', /\bSHOPIFY_ACCESS_TOKEN\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['openai-api-key', /\bOPENAI_API_KEY\s*[:=]\s*['"]?sk-[A-Za-z0-9_-]+['"]?/i],
];

export function scanSecrets(text) {
  const findings = [];
  text.split('\n').forEach((line, index) => {
    for (const [kind, pattern] of rules) {
      if (pattern.test(line)) findings.push({ kind, line: index + 1 });
    }
  });
  return findings;
}
