// Consulta la API oficial de El Toque y guarda tasas.json
const TOKEN = process.env.ELTOQUE_TOKEN;
if (!TOKEN) throw new Error("Falta ELTOQUE_TOKEN");

const OFFSET_MIN = -240; // hora de Cuba (UTC-4)
const pad = (n) => String(n).padStart(2, "0");
const dia = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const pct = (a, b) => (a ? Math.round(((b - a) / a) * 10000) / 100 : 0);

const cuba = new Date(Date.now() + OFFSET_MIN * 60000);
const ayer = new Date(cuba.getTime() - 86400000);

async function pedir(day) {
  const u = new URL("https://tasas.eltoque.com/v1/trmi");
  u.searchParams.set("date_from", `${day} 00:00:01`);
  u.searchParams.set("date_to", `${day} 23:59:01`);
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

const tiene = (c) => c && c.tasas && Object.keys(c.tasas).length > 0;
const [hoy, prev] = await Promise.all([pedir(dia(cuba)), pedir(dia(ayer))]);

// Si hoy aún no hay datos (madrugada), se usa el último día disponible
const actual = tiene(hoy) ? hoy : prev;
const anterior = tiene(hoy) && tiene(prev) ? prev : null;
if (!tiene(actual)) throw new Error("El Toque no devolvió datos"); // no se sobrescribe el archivo

const tasas = {};
for (const [moneda, valor] of Object.entries(actual.tasas)) {
  if (typeof valor !== "number") continue;
  const antes = anterior?.tasas?.[moneda];
  tasas[moneda.toUpperCase()] = {
    valor,
    cambio_vs_ayer_pct: typeof antes === "number" ? pct(antes, valor) : 0,
  };
}

const { writeFileSync } = await import("node:fs");
writeFileSync("tasas.json", JSON.stringify({
  fuente: "elTOQUE (referencia estimada)",
  moneda_base: "CUP",
  actualizado: { fecha: actual.date ?? null, hora: [actual.hour, actual.minutes, actual.seconds].map((n) => pad(n ?? 0)).join(":") },
  tasas,
}, null, 2));
