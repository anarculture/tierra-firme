/* M1 — gate failable: ciclo de alturas del bottom-sheet. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSheetState } from "../web/sheet.js";

test("nextSheetState cicla peek→half→full→peek", () => {
  assert.equal(nextSheetState("peek"), "half");
  assert.equal(nextSheetState("half"), "full");
  assert.equal(nextSheetState("full"), "peek");
});
test("nextSheetState con estado desconocido arranca en peek", () => {
  assert.equal(nextSheetState("?"), "peek");
});
