const rules = [
  ['supabase-service-role', /(?:\bSUPABASE_SERVICE_ROLE(?:_KEY)?|["']SUPABASE_SERVICE_ROLE(?:_KEY)?["'])\s*[:=]/i],
  ['stripe-secret', /(?:(?:\bSTRIPE_SECRET_KEY|["']STRIPE_SECRET_KEY["'])\s*[:=]|\bsk_(?:live|test)_[A-Za-z0-9]+)/i],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['openai-key', /\bsk-proj-[A-Za-z0-9_-]{20,}/],
  ['baknd-api-key', /(?:\bBAKND_API_KEY|["']BAKND_API_KEY["'])\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['resend-api-key', /(?:\bRESEND_API_KEY|["']RESEND_API_KEY["'])\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['elevenlabs-api-key', /(?:\bELEVENLABS_API_KEY|["']ELEVENLABS_API_KEY["'])\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['shopify-access-token', /(?:\bSHOPIFY_ACCESS_TOKEN|["']SHOPIFY_ACCESS_TOKEN["'])\s*[:=]\s*(?:['"][^'"]+['"]|[^\s#]+)/i],
  ['openai-api-key', /(?:\bOPENAI_API_KEY|["']OPENAI_API_KEY["'])\s*[:=]\s*['"]?sk-[A-Za-z0-9_-]+['"]?/i],
];

const genericCredentialAssignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"\r\n]+)\2/i;
const credentialHeaderLiteral = /['"]x-webhook-secret['"]\s*:\s*(['"])([^'"\r\n]+)\1/i;
const credentialIdentifierComparison = /(?<!\.)\b([A-Za-z_$][\w$]*)\s*(?:===|!==|==|!=)\s*(['"])([^'"\r\n]+)\2/i;
const credentialHeaderComparison = /headers\.get\(\s*['"][^'"]*(?:secret|token|key)[^'"]*['"]\s*\)\s*(?:===|!==|==|!=)\s*(['"])([^'"\r\n]+)\1/i;
const encodedCredentialAssignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:atob|decodeURIComponent)\(\s*(['"])([^'"\r\n]+)\2\s*\)/i;
const bufferEncodedCredentialAssignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*Buffer\.from\(\s*(['"])([^'"\r\n]+)\2\s*,\s*['"]base64['"]\s*\)/i;
const placeholderValues = /^(?:\[?(?:redacted|placeholder|example|changeme|replace(?:[_ -]?me)?|your[_ -]?(?:secret|token|key))\]?|<[^>]+>|\$\{[^}]+\})$/i;
const nonCredentialIdentifiers = /^(?:bundle|content|product|q)_?key$/i;
const credentialIdentifier = /(?:secret|token)$/i;
const credentialKeyIdentifier = /(?:api|access|private|client|webhook|signing|encryption|auth)_?key$/i;

function isCredentialIdentifier(identifier) {
  return (
    (credentialIdentifier.test(identifier) || credentialKeyIdentifier.test(identifier))
    && !nonCredentialIdentifiers.test(identifier)
    && !/^SUPABASE_ANON_KEY$/i.test(identifier)
  );
}

function isSensitiveLiteral(value) {
  return value.trim().length > 0 && !placeholderValues.test(value.trim());
}

export function scanSecrets(text) {
  const findings = [];
  text.split('\n').forEach((line, index) => {
    let knownCredentialFound = false;
    for (const [kind, pattern] of rules) {
      if (pattern.test(line)) {
        findings.push({ kind, line: index + 1 });
        knownCredentialFound = true;
      }
    }
    const genericMatch = line.match(genericCredentialAssignment);
    if (
      genericMatch
      && isCredentialIdentifier(genericMatch[1])
      && !knownCredentialFound
      && isSensitiveLiteral(genericMatch[3])
    ) {
      findings.push({ kind: 'generic-credential-assignment', line: index + 1 });
    }
    const headerMatch = line.match(credentialHeaderLiteral);
    if (headerMatch && isSensitiveLiteral(headerMatch[2])) {
      findings.push({ kind: 'credential-header-literal', line: index + 1 });
    }
    const comparisonMatch = line.match(credentialIdentifierComparison);
    const comparisonIsTypeof = comparisonMatch
      && line.slice(0, comparisonMatch.index).trimEnd().endsWith('typeof');
    if (
      comparisonMatch
      && isCredentialIdentifier(comparisonMatch[1])
      && isSensitiveLiteral(comparisonMatch[3])
      && !comparisonIsTypeof
    ) {
      findings.push({ kind: 'credential-comparison-literal', line: index + 1 });
    }
    const headerComparisonMatch = line.match(credentialHeaderComparison);
    if (headerComparisonMatch && isSensitiveLiteral(headerComparisonMatch[2])) {
      findings.push({ kind: 'credential-comparison-literal', line: index + 1 });
    }
    for (const pattern of [encodedCredentialAssignment, bufferEncodedCredentialAssignment]) {
      const encodedMatch = line.match(pattern);
      if (
        encodedMatch
        && isCredentialIdentifier(encodedMatch[1])
        && isSensitiveLiteral(encodedMatch[3])
      ) {
        findings.push({ kind: 'encoded-credential-literal', line: index + 1 });
      }
    }
  });
  return findings;
}
