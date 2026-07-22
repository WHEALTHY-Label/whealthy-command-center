import { describe, expect, it } from 'vitest';
import { gateDestination, isMember, toGate, type Gate } from './onboarding';

describe('gate branching', () => {
  it('routes each gate to its destination', () => {
    const cases: Array<[Gate, string]> = [
      ['join', '/join'],
      ['pending', '/pending'],
      ['quiz', '/quiz'],
      ['bundle', '/bundle'],
      ['ready', '/'],
    ];
    for (const [gate, dest] of cases) {
      expect(gateDestination(gate)).toBe(dest);
    }
  });

  it('treats only quiz/bundle/ready as member gates', () => {
    expect(isMember('quiz')).toBe(true);
    expect(isMember('bundle')).toBe(true);
    expect(isMember('ready')).toBe(true);
    expect(isMember('join')).toBe(false);
    expect(isMember('pending')).toBe(false);
  });
});

describe('toGate', () => {
  it('passes through known gates', () => {
    for (const g of ['join', 'pending', 'quiz', 'bundle', 'ready'] as const) {
      expect(toGate(g)).toBe(g);
    }
  });

  it('defaults unknown/forged values to the safest gate (join)', () => {
    expect(toGate('admin')).toBe('join');
    expect(toGate('ready ')).toBe('join');
    expect(toGate(undefined)).toBe('join');
    expect(toGate(null)).toBe('join');
    expect(toGate({ gate: 'ready' })).toBe('join');
  });
});
