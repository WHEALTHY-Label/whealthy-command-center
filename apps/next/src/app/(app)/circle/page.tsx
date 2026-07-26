import { memberFn } from '@/lib/fn';
import { parseCircleDay } from '@/lib/circles';
import { CircleClient } from './CircleClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function CirclePage() {
  const call = await memberFn('circle-day', {});
  const circle = call.ok ? parseCircleDay(call.data) : null;

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Circles</p>
        <h1 className={ui.title}>Your Steward Circle</h1>
        <p className={ui.sub}>Bible, body, and business. Up to seven, carrying it together.</p>
      </header>
      <CircleClient circle={circle} />
    </div>
  );
}
