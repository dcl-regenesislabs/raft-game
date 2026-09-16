// Initial tuning baseline. Timing targets require fresh-player playtests.
export const CAMPAIGN = {
  recoverySeconds: 75,
  warningSeconds: 30,
  broadcastSeconds: 120,
  productionQueueLimit: 5,
  seed: 1729,
  chapterNames: ['Stay afloat', 'Make a home', 'Defend the raft', 'Build an advantage', 'Prepare rescue', 'Send the signal'],
  raids: [
    { kind: 'zombie' as const, count: 2, hp: 60, reward: { wood: 12, metal: 8, bolts: 8 } },
    { kind: 'pirate' as const, count: 3, hp: 100, reward: { wood: 16, metal: 12, metalPlate: 4, harpoons: 6 } },
    { kind: 'beast' as const, count: 3, hp: 130, reward: { wood: 18, metal: 14, metalPlate: 6, cannonballs: 4 } }
  ],
  // Finite, taught threats: the next group starts only after the previous clears.
  finale: [
    { kind: 'zombie' as const, count: 2, hp: 70 },
    { kind: 'pirate' as const, count: 2, hp: 110 },
    { kind: 'beast' as const, count: 2, hp: 140 }
  ]
}
export const AMMO_BATCHES: Record<string, number> = { arrows: 4, bolts: 4, harpoons: 2, cannonballs: 2, nets: 2 }
// Cyclic balanced salvage avoids unbounded essential-resource droughts.
export const OPENING_SALVAGE = ['wood', 'plants', 'plastic', 'wood', 'metal', 'plants', 'wood', 'plastic', 'plants', 'barrel'] as const

export const WORKSHOP_SALVAGE = ['wood', 'plants', 'metal', 'wood', 'metal', 'plastic', 'metal', 'plants', 'metal', 'barrel'] as const
