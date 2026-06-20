import assert from "node:assert/strict";
import test from "node:test";

import { loadTsModule } from "./loadTsModule.mjs";

const habitForm = await loadTsModule("src/utils/habitForm.ts");

test("preferred time input keeps a compact HH:MM mask", () => {
  assert.equal(habitForm.formatPreferredTimeInput("1000"), "10:00");
  assert.equal(habitForm.formatPreferredTimeInput("930"), "09:30");
  assert.equal(habitForm.formatPreferredTimeInput("18:30"), "18:30");
  assert.equal(habitForm.formatPreferredTimeInput("18a30"), "18:30");
  assert.equal(habitForm.formatPreferredTimeInput("12345"), "12:34");
});

test("preferred time input completes common mobile numeric entry", () => {
  assert.equal(habitForm.completePreferredTimeInput("9"), "09:00");
  assert.equal(habitForm.completePreferredTimeInput("930"), "09:30");
  assert.equal(habitForm.completePreferredTimeInput("183"), "18:03");
  assert.equal(habitForm.completePreferredTimeInput("2360"), "");
  assert.equal(habitForm.completePreferredTimeInput("2400"), "");
});
