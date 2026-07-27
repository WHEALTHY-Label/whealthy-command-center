import { CommunityPromo } from '../CommunityPromo';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

/**
 * `#enterCommunityView` at index.html:8475, the destination the rail's "Enter
 * Community" row pointed at (`go('communityEnter')`). It is deliberately the
 * promo and nothing else: unlike the Community room it never shows the feed,
 * so a steward who wants the door rather than the headlines has one.
 *
 * The header is written flat rather than through `PersonalHeader`, because
 * `personalizePageHeader` never touched this view: `enterCommunityView` is
 * absent from the legacy `personalMap` and kept the static title below.
 */
export default function EnterCommunityPage() {
  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Community</p>
        <h1 className={ui.title}>Enter Community</h1>
        <p className={ui.sub}>The full house on Skool, one click away.</p>
      </header>
      <CommunityPromo cta="Open Skool Community →" />
    </div>
  );
}
