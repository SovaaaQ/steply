import assert from "node:assert/strict";
import test from "node:test";

import { loadTsModule } from "./loadTsModule.mjs";

const gamification = await loadTsModule("src/utils/gamification.ts");

test("completion XP follows difficulty and recovery rules", () => {
  assert.equal(gamification.getXPForCompletion("completed", "easy"), 5);
  assert.equal(gamification.getXPForCompletion("completed", "hard"), 15);
  assert.equal(gamification.getXPForCompletion("recovery_completed", "hard"), 8);
  assert.equal(gamification.getXPForCompletion("missed", "hard"), 0);
});

test("empty gamification summary keeps first-step defaults", () => {
  assert.equal(gamification.emptyGamificationSummary.profile.level, 1);
  assert.equal(gamification.emptyGamificationSummary.pet.is_configured, false);
  assert.equal(gamification.emptyGamificationSummary.next_best_action.cta_section, "habits");
});
