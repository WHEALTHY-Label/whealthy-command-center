import { describe, expect, it } from 'vitest';
import {
  CONFETTI_COLORS,
  FADE_PER_FRAME,
  PARTICLE_COUNT,
  advanceParticle,
  createBurst,
  createParticle,
  greetingName,
  isSpent,
  type Particle,
} from '@/lib/welcome';

/** A deterministic stand-in for Math.random, cycling a fixed tape. */
function tape(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
}

describe('greetingName', () => {
  it('greets a steward by his first name', () => {
    expect(greetingName('Ignacio Reyes', 'ignacio@thebizcofirm.com')).toBe('Ignacio');
  });

  it('capitalises a lowercase name the way the live app did', () => {
    expect(greetingName('ignacio', null)).toBe('Ignacio');
  });

  it('leaves the rest of the word alone, quirk and all', () => {
    // Legacy capitalised only charAt(0), so "mcdonald" greeted as "Mcdonald".
    expect(greetingName('mcdonald', null)).toBe('Mcdonald');
  });

  it('falls back to the local part of the email when there is no name', () => {
    expect(greetingName(null, 'ignacio@thebizcofirm.com')).toBe('Ignacio');
  });

  it('treats an empty name as no name', () => {
    expect(greetingName('   ', 'sips@example.com')).toBe('Sips');
  });

  it('falls back to Steward when it has neither', () => {
    expect(greetingName(null, null)).toBe('Steward');
    expect(greetingName('', '')).toBe('Steward');
  });

  it('never returns more than one word', () => {
    expect(greetingName('Mary Anne Van Der Berg', null)).toBe('Mary');
  });
});

describe('the burst', () => {
  it('throws exactly eighty particles, the count the live app used', () => {
    expect(createBurst(10, 10, tape([0.5])).length).toBe(PARTICLE_COUNT);
    expect(PARTICLE_COUNT).toBe(80);
  });

  it('starts every particle at the avatar, fully opaque', () => {
    const burst = createBurst(42, 17, tape([0.1, 0.9, 0.35, 0.6]));
    for (const p of burst) {
      expect(p.x).toBe(42);
      expect(p.y).toBe(17);
      expect(p.alpha).toBe(1);
    }
  });

  it('only ever paints in the five celebration colours', () => {
    const burst = createBurst(0, 0, tape([0, 0.21, 0.43, 0.67, 0.89, 0.99]));
    for (const p of burst) expect(CONFETTI_COLORS).toContain(p.color);
  });

  it('reproduces the live arithmetic exactly for a known draw', () => {
    // Every rand() returns 0.5, so the whole particle is a closed form:
    // angle = -0.15π, speed = 5, and the rest follows (index.html:18636-18651).
    const p = createParticle(0, 0, tape([0.5]));
    expect(p.vx).toBeCloseTo(Math.cos(-0.15 * Math.PI) * 5, 10);
    expect(p.vy).toBeCloseTo(Math.sin(-0.15 * Math.PI) * 5 - 2.5, 10);
    expect(p.size).toBe(5.5);
    expect(p.gravity).toBeCloseTo(0.17, 10);
    expect(p.drag).toBe(0.98);
    expect(p.spinSpeed).toBe(0);
    expect(p.color).toBe('rgba(255, 215, 0, 1)');
  });

  it('throws mostly upward, spilling a few sideways as the live cone did', () => {
    // The cone is [-0.65π, 0.35π], so a handful of draws at the top of the
    // range do start downward. That is legacy's own spread, reproduced rather
    // than tidied: the burst is meant to look thrown, not fired.
    let rng = 1;
    const lcg = () => {
      rng = (rng * 1103515245 + 12345) % 2147483648;
      return rng / 2147483648;
    };
    const burst = createBurst(0, 0, lcg);
    const upward = burst.filter((p) => p.vy < 0).length;
    expect(upward).toBeGreaterThan(PARTICLE_COUNT * 0.6);
  });

  it('picks a shape on either side of the 0.4 line', () => {
    expect(createParticle(0, 0, tape([0.9])).shape).toBe('circle');
    expect(createParticle(0, 0, tape([0.1])).shape).toBe('square');
  });
});

describe('advanceParticle', () => {
  const seed = (): Particle => ({
    x: 0,
    y: 0,
    vx: 10,
    vy: -10,
    size: 4,
    color: 'rgba(204, 255, 0, 1)',
    alpha: 1,
    gravity: 0.2,
    drag: 0.5,
    rotation: 0,
    spinSpeed: 0.1,
    shape: 'circle',
  });

  it('drags, falls, moves, fades and spins, in that order', () => {
    const p = seed();
    advanceParticle(p);
    // vx: 10 * 0.5 = 5. vy: -10 * 0.5 = -5, then + 0.2 = -4.8.
    expect(p.vx).toBe(5);
    expect(p.vy).toBeCloseTo(-4.8, 10);
    expect(p.x).toBe(5);
    expect(p.y).toBeCloseTo(-4.8, 10);
    expect(p.alpha).toBeCloseTo(1 - FADE_PER_FRAME, 10);
    expect(p.rotation).toBeCloseTo(0.1, 10);
  });

  it('burns out, so the loop always ends', () => {
    const p = seed();
    for (let i = 0; i < 200; i += 1) advanceParticle(p);
    expect(isSpent(p)).toBe(true);
  });

  it('is not spent while it still has any alpha at all', () => {
    const p = seed();
    advanceParticle(p);
    expect(isSpent(p)).toBe(false);
  });
});
