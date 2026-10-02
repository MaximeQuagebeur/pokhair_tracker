import { describe, expect, it } from 'vitest';
import { evaluate, parseCards } from '../cards';
import { computeStats } from '../stats';
import { parseWinamaxFile } from '../winamax-parser';

const score = (s: string) => evaluate(parseCards(s));

describe('evaluate', () => {
  it('orders hand categories', () => {
    const ordered = [
      '2c 7d 9h Js Kc 3d 4h', // high card
      '2c 2d 9h Js Kc 3d 4h', // pair
      '2c 2d 9h 9s Kc 3d 4h', // two pair
      '2c 2d 2h 9s Kc 3d 4h', // trips
      'Ac 2d 3h 4s 5c 9d Jh', // wheel
      '6c 2d 3h 4s 5c 9d Jh', // six-high straight
      '2h 7h 9h Jh Kh 3d 4c', // flush
      '2c 2d 2h 9s 9c 3d 4h', // full house
      '2c 2d 2h 2s Kc 3d 4h', // quads
      'Ah 2h 3h 4h 5h 9d Jc', // steel wheel
    ];
    for (let i = 1; i < ordered.length; i++) expect(score(ordered[i])).toBeGreaterThan(score(ordered[i - 1]));
  });

  it('uses kickers and splits ties', () => {
    expect(score('Ac Ad Kh 7s 5c 3d 2h')).toBeGreaterThan(score('Ac Ad Qh 7s 5c 3d 2h'));
    expect(score('Ac Kd 9h 8s 2c 3d 4h')).toBe(score('Ah Ks 9c 8d 2s 3c 4d'));
  });
});

const HEADER = (id: string) =>
  `Winamax Poker - CashGame - HandId: #${id} - Holdem no limit (0.01€/0.02€) - 2026/09/30 18:53:56 UTC
Table: 'Nice 30' 5-max (real money) Seat #3 is the button`;

const SIMPLE_HAND = `${HEADER('22989145-288-1790794436')}
Seat 1: Zudairem (1.40€)
Seat 2: MaxDr644 (1.94€)
Seat 3: Big Fish (2€)
Seat 4: The_Jedi_88 (2.10€)
Seat 5: Oceju2635 (2€)
*** ANTE/BLINDS ***
The_Jedi_88 posts small blind 0.01€
Oceju2635 posts big blind 0.02€
Dealt to MaxDr644 [Qc Qs]
*** PRE-FLOP ***
Zudairem folds
MaxDr644 raises 0.04€ to 0.06€
Big Fish folds
The_Jedi_88 folds
Oceju2635 calls 0.04€
*** FLOP *** [8h 3c 2d]
Oceju2635 checks
MaxDr644 bets 0.08€
Oceju2635 folds
MaxDr644 collected 0.13€ from pot
*** SUMMARY ***
Total pot 0.13€ | No rake
Board: [8h 3c 2d]
Seat 2: MaxDr644 won 0.13€
`;

const ALL_IN_HAND = `${HEADER('22989145-288-1790794437')}
Seat 2: MaxDr644 (2€)
Seat 4: The_Jedi_88 (2.10€)
Seat 5: Villain (2€)
*** ANTE/BLINDS ***
The_Jedi_88 posts small blind 0.01€
Villain posts big blind 0.02€
Dealt to MaxDr644 [Ac Ad]
*** PRE-FLOP ***
MaxDr644 raises 0.04€ to 0.06€
The_Jedi_88 folds
Villain raises 1.98€ to 2€ and is all-in
MaxDr644 calls 1.94€ and is all-in
*** FLOP *** [Kc 7d 2h]
*** TURN *** [Kc 7d 2h][9s]
*** RIVER *** [Kc 7d 2h 9s][3c]
*** SHOW DOWN ***
MaxDr644 shows [Ac Ad] (One pair : Aces)
Villain shows [Kh Ks] (Three of a kind : Kings)
Villain collected 3.81€ from pot
*** SUMMARY ***
Total pot 4.01€ | Rake 0.20€
Board: [Kc 7d 2h 9s 3c]
Seat 2: MaxDr644 showed [Ac Ad] and lost with One pair : Aces
Seat 5: Villain (big blind) showed [Kh Ks] and won 3.81€ with Three of a kind : Kings
`;

const THREE_BET_HAND = `${HEADER('22989145-288-1790794438')}
Seat 1: Opener (2€)
Seat 2: MaxDr644 (2€)
Seat 4: The_Jedi_88 (2€)
Seat 5: Oceju2635 (2€)
*** ANTE/BLINDS ***
The_Jedi_88 posts small blind 0.01€
Oceju2635 posts big blind 0.02€
Dealt to MaxDr644 [Ah Kh]
*** PRE-FLOP ***
Opener raises 0.04€ to 0.06€
MaxDr644 raises 0.12€ to 0.18€
The_Jedi_88 folds
Oceju2635 folds
Opener folds
MaxDr644 collected 0.27€ from pot
*** SUMMARY ***
Total pot 0.27€ | No rake
Seat 2: MaxDr644 won 0.27€
`;

describe('parseWinamaxFile', () => {
  const { hands, errors } = parseWinamaxFile(SIMPLE_HAND + '\n\n' + ALL_IN_HAND + '\n\n' + THREE_BET_HAND, 'test.txt');
  const [simple, allIn, threeBet] = hands;

  it('parses every hand', () => {
    expect(errors).toEqual([]);
    expect(hands).toHaveLength(3);
    expect(simple.id).toBe('22989145-288-1790794436');
    expect(simple.bigBlind).toBe(0.02);
    expect(simple.hero).toBe('MaxDr644');
    expect(simple.heroCards).toEqual(['Qc', 'Qs']);
  });

  it('computes net with uncalled bets', () => {
    expect(simple.net).toBeCloseTo(0.07, 4);
    expect(simple.allInEv).toBeCloseTo(0.07, 4);
    expect(simple).toMatchObject({ vpip: true, pfr: true, sawFlop: true, showdown: false, postflopBets: 1 });
    expect(threeBet.net).toBeCloseTo(0.09, 4);
    expect(threeBet).toMatchObject({ threeBetOpportunity: true, threeBet: true });
  });

  it('computes all-in EV', () => {
    expect(allIn.net).toBeCloseTo(-2, 4);
    expect(allIn.allInAdjusted).toBe(true);
    // AA vs KK ≈ 82% of a 3.81€ raked pot, minus 2€ invested.
    expect(allIn.allInEv).toBeGreaterThan(1.05);
    expect(allIn.allInEv).toBeLessThan(1.17);
    expect(allIn).toMatchObject({ showdown: true, wonAtShowdown: false, threeBetOpportunity: false });
  });

  it('aggregates stats', () => {
    const stats = computeStats(hands);
    expect(stats.hands).toBe(3);
    expect(stats.vpip).toBe(100);
    expect(stats.threeBet).toBe(100);
    expect(stats.wtsd).toBe(50);
    expect(stats.wsd).toBe(0);
    expect(stats.winrate).toBeCloseTo(((0.07 - 2 + 0.09) / 0.02) / 0.03, 4);
  });
});
