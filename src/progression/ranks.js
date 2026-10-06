const TIERS = Object.freeze(['BEGINNER', 'AMATEUR', 'PRO', 'EXPERT', 'MASTER', 'LEGENDARY']);
const DIVISIONS = Object.freeze(['I', 'II', 'III', 'IV', 'V']);
// XP curve: small, gently growing steps INSIDE a tier, a big promotion jump BETWEEN tiers,
// and every tier much longer than the last. Legendary means a lot of play.
//   step inside tier t (division d -> d+1) = TIER_BASE[t] x (1 + DIVISION_GROWTH x d)
//   promotion (tier t, V -> tier t+1, I)    = TIER_BASE[t+1] x PROMOTION
// Totals: Amateur I 603 XP, Pro I 2,267, Expert I 5,831, Master I 12,799, Legendary I 25,943,
// Legendary V 41,047.
const TIER_BASE = Object.freeze([60, 200, 450, 900, 1700, 3200]);
const DIVISION_GROWTH = 0.12;
const PROMOTION = 1.6;

let minimumXP = 0;
export const RANKS = Object.freeze(TIERS.flatMap((tier, tierIndex) => (
  DIVISIONS.map((division, divisionIndex) => {
    const rank = Object.freeze({ tier, division, label: `${tier} ${division}`, minimumXP });
    if (divisionIndex < DIVISIONS.length - 1) {
      minimumXP += Math.round(TIER_BASE[tierIndex] * (1 + DIVISION_GROWTH * divisionIndex));
    } else if (tierIndex < TIERS.length - 1) {
      minimumXP += Math.round(TIER_BASE[tierIndex + 1] * PROMOTION);
    }
    return rank;
  })
)));

export const MAX_CAREER_XP = RANKS[RANKS.length - 1].minimumXP;

export function rankForXP(totalXP) {
  const xp = Math.max(0, Math.floor(Number.isFinite(totalXP) ? totalXP : 0));
  let index = RANKS.length - 1;
  for (let i = 0; i < RANKS.length - 1; i++) {
    if (xp < RANKS[i + 1].minimumXP) {
      index = i;
      break;
    }
  }
  const rank = RANKS[index];
  const next = RANKS[index + 1] || null;
  const currentStart = rank.minimumXP;
  const nextStart = next ? next.minimumXP : currentStart;
  return Object.freeze({
    index,
    rank,
    next,
    totalXP: xp,
    currentXP: xp - currentStart,
    requiredXP: next ? nextStart - currentStart : 0,
    progress: next ? Math.min(1, (xp - currentStart) / (nextStart - currentStart)) : 1,
    careerProgress: index === RANKS.length - 1
      ? 1
      : (index + (xp - currentStart) / (nextStart - currentStart)) / (RANKS.length - 1),
  });
}
