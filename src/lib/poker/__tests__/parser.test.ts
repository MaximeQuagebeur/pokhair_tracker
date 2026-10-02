import { describe, expect, it } from 'vitest';
import { evaluate, parseCards } from '../cards';
import { availableLimits, filterHands } from '../filters';
import { buildTournamentCurve, computeStats } from '../stats';
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

const EXPRESSO_HAND = `Winamax Poker - Tournament "Expresso" buyIn: 0.46€ + 0.04€ level: 2 - HandId: #2384917-12-1790800000 - Holdem no limit (10/20/40) - 2026/10/01 20:00:00 UTC
Table: 'Expresso(123456789)#0' 3-max (real money) Seat #1 is the button
Seat 1: MaxDr644 (500)
Seat 2: Villain (500)
Seat 3: Other (500)
*** ANTE/BLINDS ***
MaxDr644 posts ante 10
Villain posts ante 10
Other posts ante 10
Villain posts small blind 20
Other posts big blind 40
Dealt to MaxDr644 [As Kd]
*** PRE-FLOP ***
MaxDr644 raises 40 to 80
Villain folds
Other folds
MaxDr644 collected 170 from pot
*** SUMMARY ***
Total pot 170 | No rake
Seat 1: MaxDr644 (button) won 170
`;

const TOURNAMENT_HEADER = `Winamax Poker - Tournament "Freeroll" buyIn: 0€ + 0€ level: 1 - HandId: #999-1-1790800001 - Holdem no limit (10/20) - 2026/10/01 20:05:00 UTC`;

describe('game types and limits', () => {
  const cash = parseWinamaxFile(SIMPLE_HAND, 'cash.txt').hands[0];
  const expresso = parseWinamaxFile(EXPRESSO_HAND, 'expresso.txt').hands[0];
  const freeroll = parseWinamaxFile(
    EXPRESSO_HAND.replace(/^.*\n/, TOURNAMENT_HEADER + '\n').replace(/\(10\/20\/40\)/, '(10/20)'),
    'mtt.txt',
  ).hands[0];

  it('classifies games and limits', () => {
    expect(cash).toMatchObject({ gameType: 'cash', limit: 'NL2' });
    expect(expresso).toMatchObject({ gameType: 'expresso', limit: '0,50€', smallBlind: 20, bigBlind: 40 });
    expect(freeroll).toMatchObject({ gameType: 'tournament', limit: 'Freeroll' });
  });

  it('computes tournament results in chips', () => {
    // Hero invested ante 10 + raise 80, uncalled 40 returned, collected 170.
    expect(expresso.net).toBe(170 - 90);
    expect(computeStats([cash, expresso]).net).toBeCloseTo(0.07, 4);
  });

  it('filters by game and limit', () => {
    const all = [cash, expresso, freeroll];
    expect(availableLimits(all, [], 'all')).toEqual(['NL2', '0,50€', 'Freeroll']);
    expect(filterHands(all, { date: 'all', game: 'expresso', limit: 'all' })).toEqual([expresso]);
    expect(filterHands(all, { date: 'all', game: 'all', limit: 'NL2' })).toEqual([cash]);
    expect(filterHands(all, { date: 'today', game: 'all', limit: 'all' }, new Date(2026, 9, 1, 23))).toHaveLength(2);
  });
});

const MONSTER_STACK = `Winamax Poker - Tournament "Monster Stack" buyIn: 0.22€ + 0.03€ level: 8 - HandId: #5042601985610612742-80-1790323902 - Holdem no limit (400/1750/3500) - 2026/09/25 08:11:42 UTC
Table: 'Monster Stack(1174072266)#0005' 6-max (real money) Seat #1 is the button
Seat 1: nouma29 (200888)
Seat 2: waiKKy (251854)
Seat 3: Not you man (98100)
Seat 4: JAILESAA7 (264445)
Seat 5: terne oie117 (188930)
Seat 6: MaxDr644 (100000)
*** ANTE/BLINDS ***
waiKKy posts ante 400
Not you man posts ante 400
nouma29 posts ante 400
JAILESAA7 posts ante 400
terne oie117 posts ante 400
MaxDr644 posts ante 400
waiKKy posts small blind 1750
Not you man posts big blind 3500
Dealt to MaxDr644 [5c 3d]
*** PRE-FLOP *** 
JAILESAA7 raises 3500 to 7000
terne oie117 folds
MaxDr644 folds
nouma29 folds
waiKKy folds
Not you man folds
JAILESAA7 collected 14650 from pot
*** SUMMARY ***
Total pot 14650 | No rake
Seat 4: JAILESAA7 won 14650
`;

const EXPRESSO_FREEROLL = `Winamax Poker - Tournament "Expresso Nitro Freeroll" buyIn: 0€ + 0€ level: 1 - HandId: #5125739469990789121-1-1790784621 - Holdem no limit (10/20) - 2026/09/30 16:10:21 UTC
Table: 'Expresso Nitro Freeroll(1193429220)#0' 3-max (real money) Seat #3 is the button
Seat 1: Acham974 (300)
Seat 2: franc5733876 (300)
Seat 3: MaxDr644 (300)
*** ANTE/BLINDS ***
Acham974 posts small blind 10
franc5733876 posts big blind 20
Dealt to MaxDr644 [4h Ah]
*** PRE-FLOP *** 
MaxDr644 raises 280 to 300 and is all-in
Acham974 calls 290 and is all-in
franc5733876 folds
*** FLOP *** [2c Jh Th]
*** TURN *** [2c Jh Th][Ts]
*** RIVER *** [2c Jh Th Ts][4c]
*** SHOW DOWN ***
MaxDr644 shows [4h Ah] (Two pairs : Tens and 4)
Acham974 shows [Jd 4s] (Two pairs : Jacks and Tens)
Acham974 collected 620 from pot
*** SUMMARY ***
Total pot 620 | No rake
Board: [2c Jh Th Ts 4c]
Seat 1: Acham974 (small blind) showed [Jd 4s] and won 620 with Two pairs : Jacks and Tens
Seat 3: MaxDr644 (button) showed [4h Ah] and lost with Two pairs : Tens and 4
`;

const TOURNAMENT_SUMMARY = `Winamax Poker - Tournament summary : Monster Stack(1174072266) - Late Registration
Player : MaxDr644
Buy-In : 0.22€ + 0.03€
Registered players : 78
Prizepool : 22.44€
Tournament started 2026/09/25 06:30:00 UTC
You played 1h 48min 59s 
You finished in 42th place
`;

describe('real Winamax tournament histories', () => {
  it('parses a Monster Stack hand with antes', () => {
    const { hands, errors } = parseWinamaxFile(MONSTER_STACK, 'mtt.txt');
    expect(errors).toEqual([]);
    expect(hands[0]).toMatchObject({
      gameType: 'tournament',
      limit: '0,25€',
      smallBlind: 1750,
      bigBlind: 3500,
      net: -400,
      vpip: false,
      sawFlop: false,
    });
  });

  it('parses an Expresso all-in with EV', () => {
    const hand = parseWinamaxFile(EXPRESSO_FREEROLL, 'expresso.txt').hands[0];
    expect(hand).toMatchObject({ gameType: 'expresso', limit: 'Freeroll', net: -300, showdown: true, allInAdjusted: true });
    // A4s vs J4o preflop: hero is a solid favourite in a 620 pot.
    expect(hand.allInEv).toBeGreaterThan(0);
  });

  it('parses tournament summary files', () => {
    const { hands, tournaments, errors } = parseWinamaxFile('\uFEFF' + TOURNAMENT_SUMMARY, 'summary.txt');
    expect(hands).toEqual([]);
    expect(errors).toEqual([]);
    expect(tournaments[0]).toMatchObject({
      id: '1174072266',
      name: 'Monster Stack',
      gameType: 'tournament',
      limit: '0,25€',
      buyIn: 0.25,
      winnings: 0,
      position: 42,
      players: 78,
      finished: true,
      startTime: Date.UTC(2026, 8, 25, 6, 30, 0),
      endTime: Date.UTC(2026, 8, 25, 8, 18, 59),
    });
  });

  it('computes ROI, ITM and € curves from summaries', () => {
    const lost = parseWinamaxFile(TOURNAMENT_SUMMARY, 's1.txt').tournaments[0];
    const won = parseWinamaxFile(
      TOURNAMENT_SUMMARY.replace('Monster Stack(1174072266)', 'Expresso(55)').replace(
        'You finished in 42th place',
        'You finished in 1st place\nYou won 0.75€',
      ),
      's2.txt',
    ).tournaments[0];
    expect(won).toMatchObject({ gameType: 'expresso', winnings: 0.75, position: 1 });

    const stats = computeStats([], [lost, won]);
    expect(stats.tournaments).toBe(2);
    expect(stats.net).toBeCloseTo(0.25, 4);
    expect(stats.roi).toBeCloseTo(50, 4);
    expect(stats.itm).toBe(50);
    expect(stats.winrate).toBeNull();
    expect(buildTournamentCurve([lost, won]).map((p) => p.net)).toEqual([0, -0.25, 0.25]);
  });
});
