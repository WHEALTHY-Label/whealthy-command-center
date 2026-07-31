# AG BRIEF: 3D rotating product carousel on the homepage, single-section replacement

**From:** Claude. **Executor:** AG (frontend). **Date:** July 30, 2026.
**Scope:** `whealthy-home.html` ONLY, one section. Nothing else on the page changes. No backend, no new dependencies, no libraries, no CDN scripts. Pure CSS 3D transforms plus a small amount of inline JS, same single-file pattern as the rest of the page.
**Deploy rule (AG_FIX_NOW item 0 applies):** build, verify, commit, push to main. No CLI production deploys, ever.

---

## 1. What gets replaced, exactly

Inside `<section class="governance-routine" id="governance-routine">`:

**REMOVE:** the entire `.governance-timeline` grid, meaning the `#timelineConnector`, the three `.category-column` wrappers (Energy / Focus / Hydration headers), and all six `.time-block` cards inside them. Also remove the now-unused `.governance-timeline` and `.category-column` CSS if nothing else references it (grep first).

**KEEP, untouched, in place:** the section header (`.governance-routine__header` with "Protect the Hours That Belong to Them" and its sub copy), the `.shipping-notice-block` (U.S. shipping), and the entire `.governance-timeline-cta` block ($99 CTA with countdown). The carousel drops in where the grid was, between the header and the shipping notice.

## 2. What gets built: the rotating ring

A 3D carousel ring of SIX cards rotating slowly around a shared vertical axis, like a circular gallery seen at a slight angle. Structure sketch (adapt class names to the page's conventions):

```html
<div class="gov-carousel" aria-label="The WHEALTHY daily governance products">
  <div class="gov-carousel__stage">   <!-- perspective: 1400px -->
    <div class="gov-carousel__ring">  <!-- transform-style: preserve-3d; animation: ring-spin 45s linear infinite -->
      <a class="gov-carousel__card" href="..." style="--i:0">...</a>
      <!-- 6 cards, each: transform: rotateY(calc(var(--i) * 60deg)) translateZ(var(--ring-radius)) -->
    </div>
  </div>
</div>
```

- `--ring-radius`: about 340px desktop, 240px tablet, 170px phone. Cards face outward; `backface-visibility: hidden` so the far side reads as card backs passing behind, matching the reference screenshot's depth feel.
- `@keyframes ring-spin { to { transform: rotateY(360deg) } }`, roughly 45s per revolution, `animation-play-state: paused` on `:hover` and `:focus-within`.
- Drag/swipe to spin: pointerdown/move/up on the stage adjusts a rotation offset (CSS variable) and suspends the animation while dragging; resume on release. A click only counts as a link tap if total pointer movement stayed under about 8px, otherwise it was a drag.
- Cards are real `<a>` links, keyboard focusable, each with a descriptive aria-label.

## 3. The six cards, their content and links

Reuse the card visual language already on the page (`--glass` background, `var(--border)`, lime accents, Oswald titles) and the EXACT image URLs already in the section being removed (content.app-sources.com thumbnails for Joe, Charge, Boss, Guice, Hydration, and the bundle). Card layout is compact: product image on top, time label, title, product tag. The long promise/replaces prose from the old cards is dropped deliberately; the $99 CTA block below the carousel carries the sell.

Order around the ring follows the canonical day (per `ag_brief_rhythm_v2_rethink.md` section 1, this REPLACES the old wrong labels that had Boss at midday and Guice at 2-4pm):

1. **Genius Joe** · label `Morning · The Morning Stack` · tag `Functional Coffee` · links to the existing Joe try page URL used elsewhere on the site.
2. **Boss** · label `Morning · The Morning Stack` · tag `Performance Capsules` · Boss try page. (Paired with Joe. Never labeled midday.)
3. **Hydration** · label `All Day · Continuous` · tag `Hydration Powder` · Hydration try page.
4. **Charge** · label `2pm · Energy Governance` · tag `Charge Powder` · Charge try page.
5. **Genius Guice** · label `Afternoon · Personalized to you` · tag `Think Drink` · Guice try page. **No clock time on this card, ever. Not 2-4pm, not any fixed hour.** The personalized-afternoon rule is locked product doctrine.
6. **The Governance System** (bundle image) · label `The Full Day · $99/mo` · tag `All 5 Products` · links to the $99 CTA block anchor below (`#governance-cta` or scroll target on the existing CTA), not offsite. Give this card a slightly distinct treatment (lime border like the CTA block) so the ring visually resolves toward the system.

Keep one shipping notice for the whole section (the existing `.shipping-notice-block` below), not per card.

## 4. Mobile and accessibility (project law: dynamically responsive, never clunky)

- 768px: radius ~240px, card width ~170px, ring still spins, drag still works.
- 480px and below: radius ~170px, card width ~140px, slow the spin to ~60s. The section must never horizontally overflow the viewport; `overflow: hidden` on the section, and verify at 360, 390, and 428px.
- `prefers-reduced-motion: reduce`: no spin at all. Render the same six cards as a static 2-column grid (3 rows), same links, same content. This is also the fallback if JS is disabled, so build the static grid as the no-JS default and enhance into the ring.
- Tap targets minimum 44px. Focus outline visible on cards. The ring pauses while any card has focus.

## 5. Performance rules

Transforms and opacity only, no layout-affecting animation. No per-frame JS while idle (the idle spin is pure CSS). `loading="lazy"` on card images (they already exist on the CDN, no new assets). No box-shadow animation on the moving cards. Test that scrolling past the section stays smooth on a phone.

## 6. Acceptance checklist

- [ ] Old grid, connector, and category columns gone; section header, shipping block, and $99 CTA block byte-identical to before.
- [ ] Six cards, canonical labels exactly as section 3, Guice card shows no clock time.
- [ ] Ring spins idle, pauses on hover/focus, drags smoothly with mouse and touch, card tap navigates and drag does not.
- [ ] Reduced-motion and no-JS render the static grid with identical content and links.
- [ ] Clean at 360, 390, 428, 768, 1200px, zero horizontal overflow.
- [ ] No em dashes anywhere in new markup or copy. No new external scripts or fonts.
- [ ] Committed and pushed to main. No CLI deploy.
