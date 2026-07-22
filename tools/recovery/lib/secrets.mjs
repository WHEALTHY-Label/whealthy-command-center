const rules = [
  ['supabase-service-role', /SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]/i],
  ['stripe-secret', /(?:STRIPE_SECRET_KEY\s*[:=]|\bsk_(?:live|test)_[A-Za-z0-9]+)/i],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['openai-key', /\bsk-proj-[A-Za-z0-9_-]{20,}/],
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
