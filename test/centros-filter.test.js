/* S4 — gate failable: filtro de centros (estado + búsqueda sin acentos). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrar, estadosDe } from "../web/centros-filter.js";

const items = [
  { payload: { name: "Iglesia A", estado: "Falcón", municipio: "Coro" } },
  { payload: { name: "Fundación B", estado: "Miranda", municipio: "Sucre" } },
  { payload: { name: "ONG C", estado: "Falcón", municipio: "Punto Fijo" } }
];

test("estadosDe: únicos y ordenados", () => assert.deepEqual(estadosDe(items), ["Falcón", "Miranda"]));
test("filtrar por estado", () => assert.equal(filtrar(items, { estado: "Falcón" }).length, 2));
test("filtrar por texto, insensible a acentos", () => assert.equal(filtrar(items, { q: "FUNDACION" }).length, 1));
test("filtrar por municipio", () => assert.equal(filtrar(items, { q: "punto" }).length, 1));
test("sin filtro → todos", () => assert.equal(filtrar(items).length, 3));
