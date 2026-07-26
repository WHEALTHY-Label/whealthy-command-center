import { describe, expect, it } from 'vitest';
import {
  AFFILIATE_TARGETS,
  CC_BUNDLES,
  TRY_PRODUCTS,
  affiliateUrl,
  bundleByKey,
  extractRefId,
} from './catalog';

describe('catalog data', () => {
  it('carries the four bundles at the shipped prices', () => {
    expect(CC_BUNDLES.map((b) => b.key)).toEqual(['genius-joe', 'boss', 'genius-guice', 'charge']);
    expect(bundleByKey('boss').member).toBe(49.5);
    // Unknown keys fall back to charge, matching the live app.
    expect(bundleByKey('nope').key).toBe('charge');
    expect(bundleByKey(null).key).toBe('charge');
  });
  it('carries the five try SKUs and ten affiliate targets', () => {
    expect(TRY_PRODUCTS).toHaveLength(5);
    expect(TRY_PRODUCTS.find((p) => p.id === 'hydration')!.price).toBe(20);
    expect(AFFILIATE_TARGETS).toHaveLength(10);
  });
});

describe('extractRefId', () => {
  it('accepts a full Skool link, a fragment, or a bare token', () => {
    expect(extractRefId('https://www.skool.com/bakndcreator/about?ref=jake123')).toBe('jake123');
    expect(extractRefId('something ref=abc_9')).toBe('abc_9');
    expect(extractRefId('jake123')).toBe('jake123');
  });
  it('rejects junk', () => {
    expect(extractRefId('')).toBeNull();
    expect(extractRefId('not a ref!!')).toBeNull();
  });
});

describe('affiliateUrl', () => {
  it('builds label links with the ref and collapses the homepage path', () => {
    expect(affiliateUrl('/invite', 'jake')).toBe('https://whealthylabel.com/invite?ref=jake');
    expect(affiliateUrl('/', 'jake')).toBe('https://whealthylabel.com?ref=jake');
  });
});
