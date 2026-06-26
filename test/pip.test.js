/* S2 — gate failable: point-in-polygon del choropleth. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pipFeature } from "../web/pip.js";

const square = { type: "Polygon", coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] };
const multi = { type: "MultiPolygon", coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]], [[[5, 5], [5, 6], [6, 6], [6, 5], [5, 5]]]] };

test("pip: punto dentro", () => assert.equal(pipFeature([5, 5], square), true));
test("pip: punto fuera", () => assert.equal(pipFeature([15, 5], square), false));
test("pip: MultiPolygon, dentro del 2º", () => assert.equal(pipFeature([5.5, 5.5], multi), true));
test("pip: MultiPolygon, fuera", () => assert.equal(pipFeature([3, 3], multi), false));
