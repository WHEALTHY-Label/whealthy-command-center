import { describe, expect, it } from 'vitest';
import { toAdminRole } from './roles';

describe('toAdminRole', () => {
  it('accepts the three roles the app understands', () => {
    expect(toAdminRole('master')).toBe('master');
    expect(toAdminRole('admin')).toBe('admin');
    expect(toAdminRole('moderator')).toBe('moderator');
  });

  it('normalises case and surrounding space', () => {
    // Ignacio's row reads `master`; the column is free text, so a stray
    // capital or a trailing space must not lock him out of the Control Panel.
    expect(toAdminRole('  Master ')).toBe('master');
    expect(toAdminRole('ADMIN')).toBe('admin');
  });

  it('reads the empty string non-admins get as no role', () => {
    expect(toAdminRole('')).toBeNull();
    expect(toAdminRole('   ')).toBeNull();
  });

  it('refuses an unknown role rather than trusting it', () => {
    expect(toAdminRole('superadmin')).toBeNull();
    expect(toAdminRole('owner')).toBeNull();
  });

  it('refuses anything that is not a string', () => {
    for (const bad of [null, undefined, 1, true, {}, ['master']]) {
      expect(toAdminRole(bad)).toBeNull();
    }
  });
});
