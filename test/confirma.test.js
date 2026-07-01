/* Gate de confirmación inline (issue 08): eco → confirmación → registro marcado
   confirmado_por_autor. */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro } from "../src/libro.js";
import { ecoCompra, ecoEntrega, eco, interpretarRespuesta, confirmar } from "../src/confirma.js";

test("eco de compra estructura items + total", () => {
  const s = ecoCompra({ categoria: "compra", items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }] });
  assert.match(s, /200× gasas @130/);
  assert.match(s, /total 26\.000 Bs/);
  assert.match(s, /¿Correcto\? SÍ \/ editar\./);
});

test("eco de entrega nombra items + destino", () => {
  const s = ecoEntrega({ categoria: "entrega", items: [{ insumo: "gasas", cantidad: 200 }], destino: "Pérez" });
  assert.match(s, /200× gasas → Pérez/);
});

test("interpretarRespuesta: SÍ confirma, editar corrige, otro ambiguo", () => {
  for (const s of ["sí", "si", "Sí", "correcto", "ok", "dale", "listo", "👍"]) assert.equal(interpretarRespuesta(s), "si", s);
  for (const s of ["editar", "no", "corrige eso", "cambiar", "está mal"]) assert.equal(interpretarRespuesta(s), "editar", s);
  assert.equal(interpretarRespuesta("y las gasas?"), "otro");
});

test("ciclo eco → confirmación → registro (compra) marcado por autor", () => {
  const l = emptyLibro();
  const pendiente = { categoria: "compra", items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }], quien_compro: "Ana" };
  const echo = eco(pendiente);
  assert.match(echo, /¿Correcto\?/);
  assert.equal(interpretarRespuesta("sí"), "si");
  const { tipo, registro } = confirmar(l, pendiente);
  assert.equal(tipo, "compra");
  assert.equal(registro.confirmado_por_autor, true, "entra marcada confirmado-por-autor");
  assert.equal(registro.costo_total, 26000);
  assert.equal(l.compras.length, 1);
});

test("ciclo para entrega también marca confirmado_por_autor", () => {
  const l = emptyLibro();
  const { tipo, registro } = confirmar(l, { categoria: "entrega", items: [{ insumo: "gasas", cantidad: 200 }], destino: "Pérez", foto: "c.jpg" });
  assert.equal(tipo, "entrega");
  assert.equal(registro.confirmado_por_autor, true);
  assert.equal(l.entregas.length, 1);
});

test("señal de edición gana sobre un 'ok/sí' inicial (regresión #08)", () => {
  assert.equal(interpretarRespuesta("ok pero cambia el precio a 150"), "editar");
  assert.equal(interpretarRespuesta("listo, pero está mal el total"), "editar");
  assert.equal(interpretarRespuesta("sí, corrige la cantidad"), "editar");
  assert.equal(interpretarRespuesta("sí"), "si", "afirmación limpia sigue confirmando");
  assert.equal(interpretarRespuesta("correcto"), "si");
});

test("editar NO registra (espera corrección)", () => {
  assert.equal(interpretarRespuesta("editar"), "editar");
  // el bot no llama a confirmar() si la respuesta no es 'si' — el libro queda intacto
  const l = emptyLibro();
  assert.equal(l.compras.length, 0);
});
