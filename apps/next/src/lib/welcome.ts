/**
 * The dashboard welcome card: the steward's own name, and the burst of confetti
 * that greeted him when the Command Center opened.
 *
 * `triggerWelcomeCelebration` at index.html:18560 owned both. This module is the
 * arithmetic half of it, kept free of imports so vitest can hold it: the naming
 * rule, the particle colours, and the physics. The canvas work lives in
 * `WelcomeConfetti`, which is the only part that needs a browser.
 */

/**
 * The name the greeting calls him.
 *
 * Legacy (18585-18592) preferred `MEMBER_NAME`, fell back to the local part of
 * the email, then to "Steward"; took the first word; and capitalised its first
 * letter only, so "mcdonald" greets as "Mcdonald" rather than "McDonald". That
 * last quirk is reproduced rather than corrected: it is the name a returning
 * steward has been greeted by, and prettifying it would silently rename him.
 */
export function greetingName(name: string | null, email: string | null): string {
  const trimmed = (name ?? '').trim();
  const local = (email ?? '').split('@')[0]?.trim() ?? '';
  const source = trimmed.length > 0 ? trimmed : local;
  const first = source.split(/\s+/)[0] ?? '';
  if (first.length === 0) return 'Steward';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** The five colours the burst drew from, in legacy's order (18627-18633). */
export const CONFETTI_COLORS: readonly string[] = [
  'rgba(204, 255, 0, 1)',
  'rgba(204, 255, 0, 0.6)',
  'rgba(255, 215, 0, 1)',
  'rgba(255, 255, 255, 1)',
  'rgba(0, 230, 118, 1)',
];

/** `const numParticles = 80` at index.html:18615. */
export const PARTICLE_COUNT = 80;

/** How much alpha a particle loses per frame (18668). */
export const FADE_PER_FRAME = 0.015;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  gravity: number;
  drag: number;
  rotation: number;
  spinSpeed: number;
  shape: 'circle' | 'square';
}

/**
 * One particle, thrown up and to the side from the avatar box.
 *
 * `rand` is passed in rather than reached for, so the shape of the burst can be
 * asserted in a test and so nothing here trips `react-hooks/purity` if it is
 * ever called from a component.
 */
export function createParticle(startX: number, startY: number, rand: () => number): Particle {
  const angle = (rand() * 0.7 - 0.35) * Math.PI - rand() * 0.3 * Math.PI;
  const speed = 2 + rand() * 6;
  const color = CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)] ?? CONFETTI_COLORS[0]!;
  return {
    x: startX,
    y: startY,
    vx: Math.cos(angle) * speed + (rand() - 0.5) * 2,
    vy: Math.sin(angle) * speed - 1 - rand() * 3,
    size: 3 + rand() * 5,
    color,
    alpha: 1,
    gravity: 0.12 + rand() * 0.1,
    drag: 0.98,
    rotation: rand() * Math.PI * 2,
    spinSpeed: (rand() - 0.5) * 0.2,
    shape: rand() > 0.4 ? 'circle' : 'square',
  };
}

/** A whole burst. */
export function createBurst(startX: number, startY: number, rand: () => number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) out.push(createParticle(startX, startY, rand));
  return out;
}

/** One frame of legacy's integrator (18663-18669). Mutates, as the original did. */
export function advanceParticle(p: Particle): void {
  p.vx *= p.drag;
  p.vy *= p.drag;
  p.vy += p.gravity;
  p.x += p.vx;
  p.y += p.vy;
  p.alpha -= FADE_PER_FRAME;
  p.rotation += p.spinSpeed;
}

/** Legacy stopped drawing a particle at `alpha <= 0` and stopped the loop when all were spent. */
export function isSpent(p: Particle): boolean {
  return p.alpha <= 0;
}
