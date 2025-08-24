// scoring-manager.ts

// ------------------------------
// Config (tweakable constants)
// ------------------------------
export const SCORING_CONFIG = {
  MAX_BUY_AMOUNT_FOR_BONUS: 30_000_000,     // 30M tokens cap for base score
  PENALTY_MULTIPLIER: 2,                    // 2x penalty when contract is broken
  BASE_SCORE_MULTIPLIER: 0.000003,          // 30M * 0.000003 * 11 ≈ 1000 (for 1000% diff => 11x)
  ASYMPTOTE_LIMIT: 1_000_000,               // Displayed scores are capped near ±1,000,000
  ASYMPTOTE_SCALING_FACTOR: 1_000_000,      // Controls the tanh squashing speed

  // Condition 2 (time-based) scoring
  CONDITION2_MIN_SCORE: 0,                  // < 1 week ago
  CONDITION2_WEEK_SCORE: 1,                 // exactly 1 week ago
  CONDITION2_MAX_SCORE: 25,                 // >= 6 months (≈180 days)
  CONDITION2_WEEK_THRESHOLD_DAYS: 7,
  CONDITION2_MAX_THRESHOLD_DAYS: 180,       // linear interpolation between 7 and 180 days
} as const;

// ------------------------------
// Types
// ------------------------------
export type TrueCondition = 1 | 2;

export interface ContractEvent {
  userId: string;
  contractRespected: boolean;     // true = respected (bonus), false = broke (penalty)
  buyAmount: number;              // token amount involved
  diffWithCondition: number;      // percentage diff vs condition (e.g., 1000 => +1000%)
  condition1?: number;            // not used for score but may be logged
  condition2?: Date;              // meta
  trueCondition: TrueCondition;   // 2 => apply time-based scoring path
  signed_at?: Date;               // used for condition 2 path
}

export interface ScoreCalculationResult {
  userId: string;
  previousScore: number;          // RAW score before applying this event
  scoreChange: number;            // RAW delta applied (what tests compare)
  newScore: number;               // DISPLAY score after applying delta (asymptoted)
  calculationDetails: {
    baseBuyScore: number;         // base from buyAmount (capped * BASE_SCORE_MULTIPLIER)
    cappedBuyAmount: number;      // min(buyAmount, MAX_BUY_AMOUNT_FOR_BONUS)
    diffMultiplier: number;       // 1 + diffWithCondition / 100
    finalContractScore: number;   // RAW delta (with penalty sign)
    penaltyApplied: boolean;      // true if contractRespected === false
    condition2Applied: boolean;   // true if trueCondition === 2 (time-based)
  };
}

// ------------------------------
// Service
// ------------------------------
class ContractScoringService {
  /**
   * Internal storage is **RAW** totals (no asymptote).
   * We only apply the asymptote for **display/return** purposes.
   */
  private userScores: Map<string, number> = new Map();

  // ------------- Public API -------------

  /**
   * Upsert a user's RAW score (handy for tests / setup).
   */
  public setUserRawScore(userId: string, rawScore: number): void {
    this.userScores.set(userId, rawScore);
  }

  /**
   * Back-compat alias expected by tests.
   * Sets the RAW score (same as setUserRawScore).
   */
  public setUserScore(userId: string, score: number): void {
    this.setUserRawScore(userId, score);
  }

  /**
   * Get a user's RAW score (0 if new).
   */
  public getUserRawScore(userId: string): number {
    return this.userScores.get(userId) ?? 0;
  }

  /**
   * Back-compat alias expected by tests.
   * Returns RAW score (same as getUserRawScore).
   */
  public getCurrentScore(userId: string): number {
    return this.getUserRawScore(userId);
  }

  /**
   * Returns DISPLAY scores (asymptoted) for all users.
   */
  public getAllScores(): Map<string, number> {
    const out = new Map<string, number>();
    for (const [userId, raw] of this.userScores.entries()) {
      out.set(userId, this.applyAsymptote(raw));
    }
    return out;
  }

  /**
   * Main entrypoint for events. Applies delta in RAW space,
   * stores RAW total, returns DISPLAY score + RAW delta for tests.
   */
  public processContractEvent(event: ContractEvent): ScoreCalculationResult {
    const prevRaw = this.getUserRawScore(event.userId);

    // Condition 2 path: time-based points only (0..25)
    if (event.trueCondition === 2) {
      const rawChange = this.calculateCondition2Score(event.signed_at);
      const newRaw = prevRaw + rawChange;

      this.userScores.set(event.userId, newRaw);

      return {
        userId: event.userId,
        previousScore: prevRaw,
        scoreChange: rawChange,
        newScore: this.applyAsymptote(newRaw),
        calculationDetails: {
          baseBuyScore: 0,
          cappedBuyAmount: Math.min(
            event.buyAmount ?? 0,
            SCORING_CONFIG.MAX_BUY_AMOUNT_FOR_BONUS
          ),
          diffMultiplier: 0,
          finalContractScore: rawChange,
          penaltyApplied: false,
          condition2Applied: true,
        },
      };
    }

    // Normal path: base * multiplier (+/- penalty)
    const capped = Math.min(
      Math.max(0, event.buyAmount || 0),
      SCORING_CONFIG.MAX_BUY_AMOUNT_FOR_BONUS
    );

    const baseBuyScore = capped * SCORING_CONFIG.BASE_SCORE_MULTIPLIER;

    // Diff multiplier: allow negatives (e.g., -50% => 0.5x), extreme positive too.
    const diffMultiplier = 1 + (event.diffWithCondition || 0) / 100;

    const unsignedScore = baseBuyScore * diffMultiplier;
    const isPenalty = !event.contractRespected;

    // Penalty doubles magnitude and flips sign
    const signedDelta = isPenalty
      ? -SCORING_CONFIG.PENALTY_MULTIPLIER * unsignedScore
      : unsignedScore;

    const newRaw = prevRaw + signedDelta;

    // Persist RAW
    this.userScores.set(event.userId, newRaw);

    return {
      userId: event.userId,
      previousScore: prevRaw,
      scoreChange: signedDelta,               // RAW delta (what tests assert on)
      newScore: this.applyAsymptote(newRaw),  // DISPLAY (asymptoted)
      calculationDetails: {
        baseBuyScore,
        cappedBuyAmount: capped,
        diffMultiplier,
        finalContractScore: signedDelta,
        penaltyApplied: isPenalty,
        condition2Applied: false,
      },
    };
  }

  // ------------- Internals -------------

  /**
   * Convert RAW score to DISPLAY (asymptoted) score.
   * Uses tanh(raw / scale) * limit to smoothly cap near ±limit.
   */
  private applyAsymptote(rawScore: number): number {
    const limit = SCORING_CONFIG.ASYMPTOTE_LIMIT;
    const scale = SCORING_CONFIG.ASYMPTOTE_SCALING_FACTOR;
    return Math.tanh(rawScore / scale) * limit;
  }

  /**
   * (Optional) Invert display score back to RAW (atanh). Kept for completeness.
   */
  private invertAsymptote(displayScore: number): number {
    const limit = SCORING_CONFIG.ASYMPTOTE_LIMIT;
    const scale = SCORING_CONFIG.ASYMPTOTE_SCALING_FACTOR;
    if (displayScore === 0) return 0;

    // Clamp ratio for numerical stability
    let ratio = displayScore / limit;
    const EPS = 1e-12;
    if (ratio >= 1) ratio = 1 - EPS;
    if (ratio <= -1) ratio = -1 + EPS;

    // atanh(x) = 0.5 * ln((1 + x) / (1 - x))
    return 0.5 * Math.log((1 + ratio) / (1 - ratio)) * scale;
  }

  /**
   * 0..25 time-based score:
   *  - < 7 days => 0
   *  - = 7 days => 1
   *  - >= 180 days => 25
   *  - Linear interpolation between 7 and 180 days.
   */
  private calculateCondition2Score(signedAt?: Date): number {
    if (!signedAt) return SCORING_CONFIG.CONDITION2_MIN_SCORE;

    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;
    const ageDays = Math.max(0, Math.floor((now.getTime() - signedAt.getTime()) / msInDay));

    const wk = SCORING_CONFIG.CONDITION2_WEEK_THRESHOLD_DAYS;
    const max = SCORING_CONFIG.CONDITION2_MAX_THRESHOLD_DAYS;

    if (ageDays < wk) {
      return SCORING_CONFIG.CONDITION2_MIN_SCORE;
    }
    if (ageDays === wk) {
      return SCORING_CONFIG.CONDITION2_WEEK_SCORE;
    }
    if (ageDays >= max) {
      return SCORING_CONFIG.CONDITION2_MAX_SCORE;
    }

    // Linear interpolation from 1 @ 7d to 25 @ 180d
    const t = (ageDays - wk) / (max - wk); // 0..1
    const start = SCORING_CONFIG.CONDITION2_WEEK_SCORE;
    const end = SCORING_CONFIG.CONDITION2_MAX_SCORE;
    return start + t * (end - start);
  }
}

// Factory (what your tests import)
export function createScoringService(): ContractScoringService {
  return new ContractScoringService();
}
