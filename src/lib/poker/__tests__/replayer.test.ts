import { describe, expect, it } from 'vitest';
import { buildReplay, describeHand } from '../actionEngine';
import { DEFAULT_HAND_SEARCH, searchHands } from '../hand-search';
import { parseWinamaxFile } from '../winamax-parser';

const SIMPLE_HAND = `Winamax Poker - CashGame - HandId: #22989145-288-1790794436 - Holdem no limit (0.01€/0.02€) - 2026/09/30 18:53:56 UTC
Table: 'Nice 30' 5-max (real money) Seat #3 is the button
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
MaxDr644 collected 0.21€ from pot
*** SUMMARY ***
Total pot 0.21€ | No rake
Board: [8h 3c 2d]
Seat 2: MaxDr644 won 0.21€
`;

const FOLD_TO_3BET = `Winamax Poker - CashGame - HandId: #1-2-3 - Holdem no limit (0.01€/0.02€) - 2026/09/30 19:00:00 UTC
Table: 'Nice 30' 6-max (real money) Seat #6 is the button
Seat 1: SmallB (2€)
Seat 2: BigB (2€)
Seat 3: MaxDr644 (2€)
Seat 4: Mid (2€)
Seat 5: Cutoff (2€)
Seat 6: Btn (2€)
*** ANTE/BLINDS ***
SmallB posts small blind 0.01€
BigB posts big blind 0.02€
Dealt to MaxDr644 [7c 6c]
*** PRE-FLOP ***
MaxDr644 raises 0.04€ to 0.06€
Mid folds
Cutoff folds
Btn raises 0.12€ to 0.18€
SmallB folds
BigB folds
MaxDr644 folds
Btn collected 0.27€ from pot
*** SUMMARY ***
Total pot 0.27€ | No rake
Seat 6: Btn (button) won 0.27€
`;

const ALL_IN = `Winamax Poker - Tournament "Expresso Nitro Freeroll" buyIn: 0€ + 0€ level: 1 - HandId: #5125739469990789121-1-1790784621 - Holdem no limit (10/20) - 2026/09/30 16:10:21 UTC
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

describe('hand record replayer fields', () => {
  const { hands, texts } = parseWinamaxFile([SIMPLE_HAND, FOLD_TO_3BET, ALL_IN].join('\n\n'), 'x.txt');
  const [simple, foldTo3Bet, allIn] = hands;

  it('stores raw texts', () => {
    expect(texts.map((t) => t.id)).toEqual(hands.map((h) => h.id));
    expect(texts[0].text.startsWith('Winamax Poker - CashGame')).toBe(true);
  });

  it('computes position, pot, end street and preflop line', () => {
    expect(simple).toMatchObject({
      heroPosition: 'CO',
      pot: 0.21,
      endStreet: 'flop',
      preflopActions: 'R',
      steal: true,
      foldToThreeBet: false,
    });
    expect(foldTo3Bet).toMatchObject({
      heroPosition: 'UTG',
      endStreet: 'preflop',
      preflopActions: 'RF',
      steal: false,
      foldToThreeBet: true,
    });
    expect(allIn).toMatchObject({ heroPosition: 'BTN', endStreet: 'showdown', pot: 620, steal: true });
  });

  it('searches and sorts', () => {
    const all = [simple, foldTo3Bet, allIn];
    const search = (patch: Partial<typeof DEFAULT_HAND_SEARCH>) => searchHands(all, { ...DEFAULT_HAND_SEARCH, ...patch });
    expect(search({ result: 'won' })).toEqual([simple]);
    expect(search({ position: 'UTG' })).toEqual([foldTo3Bet]);
    expect(search({ preflop: 'foldToThreeBet' })).toEqual([foldTo3Bet]);
    expect(search({ preflop: 'steal' }).map((h) => h.id)).toEqual([simple.id, allIn.id]);
    expect(search({ ending: 'showdown' })).toEqual([allIn]);
    expect(search({ preflop: 'allIn' })).toEqual([allIn]);
    expect(search({ pot: 'medium' })).toHaveLength(3);
    expect(search({ pot: 'small' })).toEqual([]);
    expect(search({ sortKey: 'netBB', sortDir: 'asc' })[0]).toBe(allIn);
  });
});

describe('buildReplay', () => {
  it('replays a simple hand step by step', () => {
    const replay = buildReplay(SIMPLE_HAND)!;
    expect(replay).toMatchObject({ maxSeats: 5, isCash: true, hero: 'MaxDr644' });
    const kinds = replay.steps.map((s) => s.kind);
    expect(kinds).toEqual(['init', 'action', 'action', 'action', 'action', 'action', 'street', 'action', 'action', 'action', 'payout']);
    expect(replay.streetStarts).toEqual({ preflop: 0, flop: 6 });

    const init = replay.steps[0];
    const hero = (i: number) => replay.steps[i].players.find((p) => p.isHero)!;
    expect(init.players.find((p) => p.name === 'Oceju2635')).toMatchObject({ bet: 0.02, stack: 1.98, position: 'BB' });
    expect(init.players.find((p) => p.name === 'Big Fish')).toMatchObject({ isButton: true, position: 'BTN' });
    expect(init.players.find((p) => p.name === 'Zudairem')).toMatchObject({ position: 'HJ' });
    expect(init.players.find((p) => p.name === 'MaxDr644')).toMatchObject({ position: 'CO' });
    expect(hero(0).cards).toEqual(['Qc', 'Qs']);
    expect(init.players.find((p) => p.name === 'Zudairem')?.cards).toBeNull();

    expect(replay.steps[2].message).toMatch(/MaxDr644 relance à 0,06/);
    expect(replay.steps[2]).toMatchObject({ action: 'raise', allIn: false });
    expect(buildReplay(SIMPLE_HAND, 'bb')!.steps[2].message).toBe('MaxDr644 relance à 3 bb');
    expect(hero(2)).toMatchObject({ bet: 0.06, stack: 1.88 });

    const flop = replay.steps[6];
    expect(flop.board).toEqual(['8h', '3c', '2d']);
    expect(flop.pot).toBe(0.13);
    expect(flop.players.every((p) => p.bet === 0)).toBe(true);

    const payout = replay.steps[replay.steps.length - 1];
    expect(payout.players.find((p) => p.isHero)).toMatchObject({ won: 0.21, stack: 2.01 });
    expect(payout.pot).toBe(0);
  });

  it('describes the hand as plain text', () => {
    const text = describeHand(buildReplay(SIMPLE_HAND)!, 'stake');
    expect(text).toMatch(/- CO MaxDr644 \(Héros\) : 1,94\s€ \(97 bb\) — Q♣ Q♠/);
    expect(text).toContain('- [HJ] Zudairem se couche');
    expect(text).toMatch(/Flop : .+ \(pot 0,13\s€, 2 joueurs\) :/);
    expect(text).toMatch(/Résultat : MaxDr644 remporte 0,21\s€/);
  });

  it('runs out the board and reveals cards at showdown', () => {
    const replay = buildReplay(ALL_IN)!;
    expect(replay.isCash).toBe(false);
    expect(replay.steps.map((s) => s.kind)).toEqual([
      'init', 'action', 'action', 'action', 'street', 'street', 'street', 'showdown', 'payout',
    ]);
    const showdown = replay.steps[replay.streetStarts.showdown!];
    expect(showdown.board).toHaveLength(5);
    expect(showdown.pot).toBe(620);
    expect(showdown.players.find((p) => p.name === 'Acham974')).toMatchObject({
      cards: ['Jd', '4s'],
      handDescription: 'Two pairs : Jacks and Tens',
    });
    // Opponent cards stay hidden before the showdown.
    expect(replay.steps[3].players.find((p) => p.name === 'Acham974')?.cards).toBeNull();
    const payout = replay.steps[replay.steps.length - 1];
    expect(payout.players.find((p) => p.name === 'Acham974')).toMatchObject({ won: 620, stack: 620 });
  });
});
