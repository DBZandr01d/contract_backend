// Constants for easy adjustment
const SCORING_CONFIG = {
    MAX_BUY_AMOUNT_FOR_BONUS: 1, // 1 SOL - adjust this to change the cap
    PENALTY_MULTIPLIER: 2, // 2x penalty for breaking contracts
    MIN_SCORE: 0, // Minimum possible score
    BASE_SCORE_MULTIPLIER: 100, // Base multiplier for buy amount to score conversion
  } as const;
  
  // Types
  interface ContractEvent {
    userId: string;
    contractRespected: boolean;
    buyAmount: number; // in SOL
    diffWithCondition: number; // percentage (e.g., 1000 for 1000%)
    condition1: number; // float value
    condition2: Date; // datetime value
    trueCondition: 1 | 2; // which condition is the true one
  }
  
  interface UserScore {
    userId: string;
    currentScore: number;
  }
  
  interface ScoreCalculationResult {
    newScore: number;
    scoreChange: number;
    calculationDetails: {
      baseBuyScore: number;
      cappedBuyAmount: number;
      diffMultiplier: number;
      finalContractScore: number;
      penaltyApplied: boolean;
    };
  }
  
  class ContractScoringService {
    // In a real application, this would be stored in a database
    private userScores: Map<string, number> = new Map();
  
    /**
     * Get current score for a user
     */
    getCurrentScore(userId: string): number {
      return this.userScores.get(userId) ?? 0;
    }
  
    /**
     * Calculate the base score from buy amount (before diff_with_condition multiplier)
     */
    private calculateBaseBuyScore(buyAmount: number): number {
      // Cap the buy amount at the maximum for bonus calculation
      const cappedAmount = Math.min(buyAmount, SCORING_CONFIG.MAX_BUY_AMOUNT_FOR_BONUS);
      return cappedAmount * SCORING_CONFIG.BASE_SCORE_MULTIPLIER;
    }
  
    /**
     * Calculate the final contract score including diff_with_condition
     */
    private calculateContractScore(buyAmount: number, diffWithCondition: number): number {
      const baseBuyScore = this.calculateBaseBuyScore(buyAmount);
      
      // Convert percentage to multiplier (1000% = 11x total, 100% = 2x total)
      // diffWithCondition of 1000 means 1000% increase, so multiply by (1 + 1000/100) = 11
      const diffMultiplier = 1 + (diffWithCondition / 100);
      
      return baseBuyScore * diffMultiplier;
    }
  
    /**
     * Process a contract event and update user score
     */
    processContractEvent(event: ContractEvent): ScoreCalculationResult {
      const currentScore = this.getCurrentScore(event.userId);
      
      // Check if true_condition is 2 - if so, return score of 1
      if (event.trueCondition === 2) {
        const scoreChange = 1;
        const newScore = Math.max(
          SCORING_CONFIG.MIN_SCORE,
          currentScore + scoreChange
        );
        
        // Update stored score
        this.userScores.set(event.userId, newScore);
        
        return {
          newScore,
          scoreChange: newScore - currentScore,
          calculationDetails: {
            baseBuyScore: 0,
            cappedBuyAmount: 0,
            diffMultiplier: 0,
            finalContractScore: 1,
            penaltyApplied: false,
          },
        };
      }
      
      // Normal calculation when true_condition is 1
      const contractScore = this.calculateContractScore(event.buyAmount, event.diffWithCondition);
      
      let scoreChange: number;
      let penaltyApplied = false;
  
      if (event.contractRespected) {
        // User respected the contract - add the score
        scoreChange = contractScore;
      } else {
        // User broke the contract - apply penalty (2x the contract score)
        scoreChange = -(contractScore * SCORING_CONFIG.PENALTY_MULTIPLIER);
        penaltyApplied = true;
      }
  
      // Calculate new score, ensuring it doesn't go below minimum
      const newScore = Math.max(
        SCORING_CONFIG.MIN_SCORE,
        currentScore + scoreChange
      );
  
      // Update stored score
      this.userScores.set(event.userId, newScore);
  
      // Return detailed calculation result
      return {
        newScore,
        scoreChange: newScore - currentScore, // Actual change (may be different due to min score cap)
        calculationDetails: {
          baseBuyScore: this.calculateBaseBuyScore(event.buyAmount),
          cappedBuyAmount: Math.min(event.buyAmount, SCORING_CONFIG.MAX_BUY_AMOUNT_FOR_BONUS),
          diffMultiplier: 1 + (event.diffWithCondition / 100),
          finalContractScore: contractScore,
          penaltyApplied,
        },
      };
    }
  
    /**
     * Batch process multiple contract events
     */
    processBatchContractEvents(events: ContractEvent[]): Map<string, ScoreCalculationResult> {
      const results = new Map<string, ScoreCalculationResult>();
      
      for (const event of events) {
        results.set(event.userId, this.processContractEvent(event));
      }
      
      return results;
    }
  
    /**
     * Get all user scores (for admin/debugging purposes)
     */
    getAllScores(): Map<string, number> {
      return new Map(this.userScores);
    }
  
    /**
     * Reset a user's score to 0
     */
    resetUserScore(userId: string): void {
      this.userScores.set(userId, 0);
    }
  
    /**
     * Manually set a user's score (for admin purposes)
     */
    setUserScore(userId: string, score: number): void {
      this.userScores.set(userId, Math.max(SCORING_CONFIG.MIN_SCORE, score));
    }
  }
  
  // Factory function to create a new scoring service instance
  export function createScoringService(): ContractScoringService {
    return new ContractScoringService();
  }
  
  // Export types and constants for use in other parts of the system
  export {
    ContractScoringService,
    SCORING_CONFIG,
    type ContractEvent,
    type UserScore,
    type ScoreCalculationResult,
  };
  
  // Example usage and testing
  if (require.main === module) {
    // Example usage
    const scoringService = createScoringService();
    
    // Test case 1: User respects contract with 0.5 SOL buy and 500% diff (true_condition = 1)
    const event1: ContractEvent = {
      userId: "user123",
      contractRespected: true,
      buyAmount: 0.5,
      diffWithCondition: 500, // 500% increase
      condition1: 42.5,
      condition2: new Date('2024-12-01'),
      trueCondition: 1,
    };
    
    console.log("Test 1 - Respected contract (true_condition = 1):");
    console.log(scoringService.processContractEvent(event1));
    
    // Test case 2: Same user breaks a contract with 1.5 SOL buy and 200% diff (true_condition = 1)
    const event2: ContractEvent = {
      userId: "user123",
      contractRespected: false,
      buyAmount: 1.5, // Will be capped at 1 SOL
      diffWithCondition: 200, // 200% increase
      condition1: 15.7,
      condition2: new Date('2024-12-02'),
      trueCondition: 1,
    };
    
    console.log("\nTest 2 - Broken contract (true_condition = 1):");
    console.log(scoringService.processContractEvent(event2));
    
    // Test case 3: New user with true_condition = 2 (should return score of 1)
    const event3: ContractEvent = {
      userId: "user456",
      contractRespected: true,
      buyAmount: 2.0, // This won't matter since true_condition = 2
      diffWithCondition: 1000, // This won't matter since true_condition = 2
      condition1: 100.0,
      condition2: new Date('2024-12-03'),
      trueCondition: 2,
    };
    
    console.log("\nTest 3 - true_condition = 2 (should get score of 1):");
    console.log(scoringService.processContractEvent(event3));
    
    // Test case 4: Another user with true_condition = 2, contract broken (should still get score of 1)
    const event4: ContractEvent = {
      userId: "user789",
      contractRespected: false, // This won't matter since true_condition = 2
      buyAmount: 5.0,
      diffWithCondition: 2000,
      condition1: 75.3,
      condition2: new Date('2024-12-04'),
      trueCondition: 2,
    };
    
    console.log("\nTest 4 - true_condition = 2, contract broken (should still get score of 1):");
    console.log(scoringService.processContractEvent(event4));
    
    console.log("\nFinal scores:");
    console.log(scoringService.getAllScores());
  }