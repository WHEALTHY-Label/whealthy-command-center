import { describe, expect, it } from 'vitest';
import { parsePublicEnv } from './env';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://yzaxzmuuvozonhgwhlim.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-placeholder-value-1234567890',
  NEXT_PUBLIC_FN_BASE: 'https://yzaxzmuuvozonhgwhlim.functions.supabase.co',
};

describe('parsePublicEnv', () => {
  it('accepts a complete, well-formed configuration', () => {
    expect(parsePublicEnv(valid)).toEqual(valid);
  });

  it('rejects a missing variable', () => {
    const { NEXT_PUBLIC_FN_BASE: _omitted, ...partial } = valid;
    void _omitted;
    expect(() => parsePublicEnv(partial)).toThrow(/NEXT_PUBLIC_FN_BASE/);
  });

  it('rejects a non-URL Supabase URL', () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /Invalid public environment configuration/,
    );
  });

  it('rejects an obviously truncated anon key', () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'short' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it('never leaks a provided value in the error message', () => {
    const secretish = 'super-secret-do-not-print-me';
    try {
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: secretish });
      throw new Error('expected parse to throw');
    } catch (err) {
      expect((err as Error).message).not.toContain(secretish);
    }
  });
});
