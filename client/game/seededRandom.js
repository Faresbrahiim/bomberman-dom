// =============================================================================
// STEP 1: CLASS DEFINITION (EXECUTED FIRST - DETERMINISTIC RANDOM GENERATOR)
// =============================================================================
export class SeededRandom {
    // =============================================================================
    // STEP 2: CONSTRUCTOR (EXECUTED SECOND - SEED INITIALIZATION)
    // =============================================================================
    constructor(seed) {
        // Store seed value for reproducible random number generation
        this.seed = seed;
    }

    // =============================================================================
    // STEP 3: CORE RANDOM GENERATION (EXECUTED ON EACH CALL - PSEUDO-RANDOM ALGORITHM)
    // =============================================================================
    next() {
        // Linear Congruential Generator (LCG) algorithm for deterministic randomness
        // Uses mathematical formula: (a * seed + c) mod m
        // Where: a = 9301, c = 49297, m = 233280
        this.seed = (this.seed * 9301 + 49297) % 233280;
        
        // Return normalized value between 0 and 1
        return this.seed / 233280;
    }

    // =============================================================================
    // STEP 4: INTEGER RANGE GENERATION (EXECUTED ON DEMAND - BOUNDED RANDOM INTEGERS)
    // =============================================================================
    nextInt(min, max) {
        // Generate random integer within specified range [min, max] inclusive
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    // =============================================================================
    // STEP 5: PROBABILITY CHECK (EXECUTED ON DEMAND - CHANCE DETERMINATION)
    // =============================================================================
    chance(probability) {
        // Return true/false based on probability threshold (0-1 range)
        // Used for percentage-based random decisions
        return this.next() < probability;
    }
}