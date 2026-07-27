'use client';

import { useEffect, useRef } from 'react';
import { advanceParticle, createBurst, isSpent, type Particle } from '@/lib/welcome';
import styles from './page.module.css';

/**
 * The burst that greeted a steward when the Command Center opened
 * (index.html:18603-18698). One throw per mount, from the avatar box, up and
 * out, gone in a couple of seconds.
 *
 * Legacy fired it from `go('dash')` on every visit to the room. The layout here
 * outlives client-side navigation but this component does not, so mounting is
 * the same trigger: walk back to Home and it throws again.
 *
 * A steward who has asked his machine to stop moving things gets no burst at
 * all, which is why the media query is checked before any work is done.
 */
export function WelcomeConfetti({ originRef }: { originRef: React.RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Legacy measured the avatar box and threw from its centre, falling back to
    // a point 40px in when it could not find one.
    let startX = 40;
    let startY = rect.height / 2;
    const origin = originRef.current;
    if (origin) {
      const o = origin.getBoundingClientRect();
      startX = o.left - rect.left + o.width / 2;
      startY = o.top - rect.top + o.height / 2;
    }

    const particles: Particle[] = createBurst(startX, startY, () => Math.random());

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = 0;

      for (const p of particles) {
        if (isSpent(p)) continue;
        alive += 1;
        advanceParticle(p);

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        ctx.restore();
      }

      if (alive > 0) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [originRef]);

  return <canvas ref={canvasRef} className={styles.confetti} aria-hidden="true" />;
}
