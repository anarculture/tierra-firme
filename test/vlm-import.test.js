/* Gate del importador VLM→needs (scripts/vlm-import.js). Cubre lo que rompe silencioso:
   filtro OFERTA/relevant, formato de ítem, normalización de lugar y merge sin clobber. */
import { test } from "node:test";
import assert from "node:assert";
import { toNecesidades, mergeNecesidades, limpiaLugar, zonaDe } from "../scripts/vlm-import.js";

const rec = (o) => ({ relevant: true, kind: "NECESIDAD", destino: "Hosp X", items: [], ...o });
const item = (articulo, cantidad = null, unidad = null) => ({ fields: { articulo: { value: articulo }, cantidad: { value: cantidad }, unidad: { value: unidad } } });

test("filtro duro: solo relevant:true && kind=NECESIDAD", () => {
  const { necesidades } = toNecesidades([
    rec({ kind: "OFERTA", items: [item("Taladros")] }),                 // oferta → fuera
    rec({ relevant: false, items: [item("Comprobante")] }),            // relevant:false → fuera
    rec({ relevant: null, items: [item("X")] }),                        // sin evaluar → fuera
    rec({ destino: "Hospital A", items: [item("Gasas")] }),            // sí
  ]);
  assert.equal(necesidades.length, 1, "solo la necesidad válida sobrevive");
  assert.equal(necesidades[0].lugar, "Hospital A");
  assert.deepEqual(necesidades[0].items, ["Gasas"]);
  assert.ok(!JSON.stringify(necesidades).includes("Taladros"), "ninguna OFERTA se cuela");
  assert.ok(!JSON.stringify(necesidades).includes("Comprobante"), "ningún relevant:false se cuela");
});

test("formato de ítem: cantidad/unidad opcionales", () => {
  const { necesidades } = toNecesidades([rec({ destino: "H", items: [item("Agua"), item("Glutaraldehído", 1, "Galón")] })]);
  assert.deepEqual(necesidades[0].items, ["Agua", "Glutaraldehído (1 Galón)"]);
});

test("normaliza lugar: quita (recibe …), conserva otras expansiones, mergea variantes", () => {
  assert.equal(limpiaLugar("Hospital Domingo Luciani (recibe Dr. Carlos Vélez)"), "Hospital Domingo Luciani");
  assert.equal(limpiaLugar("HMPC (Hospital Miguel Pérez Carreño)"), "HMPC (Hospital Miguel Pérez Carreño)");
  const { necesidades } = toNecesidades([
    rec({ destino: "Hospital Domingo Luciani", items: [item("Hibiclen")] }),
    rec({ destino: "Hospital Domingo Luciani (recibe Dr. Carlos Vélez)", items: [item("Propofol")] }),
  ]);
  assert.equal(necesidades.length, 1, "las dos variantes son el mismo lugar");
  assert.deepEqual(necesidades[0].items.sort(), ["Hibiclen", "Propofol"]);
  assert.equal(necesidades[0].reportes, 2, "reportes = fotos que aportan");
});

test("sin destino → 'Por ubicar (revisar)', no se dropean los ítems", () => {
  const { necesidades, needsDestino } = toNecesidades([rec({ destino: "", archivo: "x.jpg", items: [item("Pañales")] })]);
  assert.equal(needsDestino.length, 1);
  assert.equal(necesidades[0].lugar, "Por ubicar (revisar)");
  assert.deepEqual(necesidades[0].items, ["Pañales"]);
});

test("merge: quita placeholder 'no especificada', une ítems, no clobber", () => {
  const base = [{ zona: "Caracas", lugar: "Hospital Periférico de Catia", items: ["Insumos médicos (lista detallada no especificada en el volcado)"], urgencia: "alta", reportes: 3 }];
  const add = [{ zona: "Caracas", lugar: "Hospital Periférico de Catia", items: ["47 apósitos"], urgencia: "media", reportes: 1 }];
  const [merged] = mergeNecesidades(base, add);
  assert.deepEqual(merged.items, ["47 apósitos"], "placeholder fuera, ítem real dentro");
  assert.equal(merged.urgencia, "alta", "conserva urgencia existente (no downgrade)");
  assert.equal(merged.reportes, 4);
});

test("merge: lugar nuevo se agrega", () => {
  const merged = mergeNecesidades([{ zona: "Caracas", lugar: "A", items: ["x"], urgencia: "alta", reportes: 1 }], [{ zona: "La Guaira", lugar: "B", items: ["y"], urgencia: "media", reportes: 1 }]);
  assert.equal(merged.length, 2);
});

test("salida cumple el schema de necesidades.test.js", () => {
  const { necesidades } = toNecesidades([rec({ destino: "familia particular en La Guaira", items: [item("Agua")] })]);
  const n = necesidades[0];
  assert.ok(typeof n.zona === "string" && n.zona.trim());
  assert.ok(typeof n.lugar === "string" && n.lugar.trim());
  assert.ok(Array.isArray(n.items) && n.items.length && n.items.every((s) => typeof s === "string" && s.trim()));
  assert.ok(["alta", "media", "baja"].includes(n.urgencia));
  assert.ok(Number.isInteger(n.reportes) && n.reportes >= 1);
  assert.equal(n.zona, "La Guaira", "zonaDe detecta La Guaira");
});
