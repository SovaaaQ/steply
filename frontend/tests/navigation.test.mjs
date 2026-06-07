import assert from "node:assert/strict";
import test from "node:test";

import { loadTsModule } from "./loadTsModule.mjs";

const navigation = await loadTsModule("src/app/navigation.ts");

test("navigation items expose stable section paths", () => {
  assert.deepEqual(
    navigation.navigationItems.map((item) => [item.id, item.path]),
    [
      ["dashboard", "/"],
      ["habits", "/habits"],
      ["pet", "/pet"],
      ["recommendations", "/recommendations"],
      ["profile", "/profile"]
    ]
  );
});

test("section paths round-trip and unknown paths fall back to dashboard", () => {
  assert.equal(navigation.getSectionPath("habits"), "/habits");
  assert.equal(navigation.getSectionPath("recommendations"), "/recommendations");
  assert.equal(navigation.getSectionFromPath("/habits/"), "habits");
  assert.equal(navigation.getSectionFromPath("/unknown"), "dashboard");
  assert.equal(navigation.getSectionFromPath("/"), "dashboard");
});
