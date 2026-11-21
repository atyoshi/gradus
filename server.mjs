import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(
  path.dirname(process.env.GRADUS_DB || path.join(root, "data/gradus.sqlite")),
  { recursive: true },
);
const db = new DatabaseSync(
  process.env.GRADUS_DB || path.join(root, "data/gradus.sqlite"),
);
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS library (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, body TEXT NOT NULL);",
);
const dev = process.argv.includes("--dev");
const vite = dev
  ? await (
      await import("vite")
    ).createServer({
      server: { middlewareMode: true },
      optimizeDeps: { entries: ["index.html"] },
      appType: "spa",
    })
  : null;
const port = Number(process.env.PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const validScore = (s) =>
  s &&
  s.version === 1 &&
  typeof s.id === "string" &&
  typeof s.title === "string" &&
  Number.isInteger(s.bars) &&
  s.bars > 0 &&
  s.bars <= 64 &&
  Array.isArray(s.voices) &&
  s.voices.length >= 1 &&
  s.voices.length <= 4 &&
  s.voices.every(
    (v) =>
      typeof v.id === "string" &&
      Array.isArray(v.notes) &&
      v.notes.length <= 1000 &&
      v.notes.every(
        (n) =>
          typeof n.id === "string" &&
          Number.isFinite(n.time) &&
          n.time >= 0 &&
          Number.isFinite(n.duration) &&
          n.duration > 0 &&
          (!n.pitch ||
            (/^[A-G]$/.test(n.pitch.step) &&
              Number.isInteger(n.pitch.octave) &&
              n.pitch.octave >= 0 &&
              n.pitch.octave <= 8 &&
              [-2, -1, 0, 1, 2].includes(n.pitch.alter))),
      ),
  );
const server = http.createServer(async (req, res) => {
  try {
    if (
      req.headers.host !== `127.0.0.1:${port}` &&
      req.headers.host !== `localhost:${port}`
    ) {
      res.writeHead(403).end();
      return;
    }
    if (req.url?.startsWith("/api/")) {
      if (
        req.headers.origin &&
        req.headers.origin !== origin &&
        req.headers.origin !== `http://localhost:${port}`
      ) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      const send = (x) => res.end(JSON.stringify(x));
      if (req.method === "GET" && req.url === "/api/library") {
        send(
          db
            .prepare("SELECT body, updated FROM library ORDER BY updated DESC")
            .all()
            .map((r) => ({ ...JSON.parse(r.body), libraryUpdatedAt: r.updated })),
        );
        return;
      }
      if (req.method === "GET" && req.url === "/api/settings") {
        send(
          JSON.parse(
            db.prepare("SELECT body FROM settings WHERE id=1").get()?.body ||
              "{}",
          ),
        );
        return;
      }
      if (req.method === "GET" && req.url === "/api/backup") {
        send({
          version: 1,
          scores: db
            .prepare("SELECT body FROM library")
            .all()
            .map((r) => JSON.parse(r.body)),
          settings: JSON.parse(
            db.prepare("SELECT body FROM settings WHERE id=1").get()?.body ||
              "{}",
          ),
        });
        return;
      }
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 12_000_000) throw Error("File exceeds 12MB.");
        }
        const value = JSON.parse(body);
        if (req.url === "/api/library") {
          if (!validScore(value)) throw Error("Invalid score.");
          const updated = new Date().toISOString();
          db.prepare("INSERT OR REPLACE INTO library VALUES (?,?,?)").run(
            value.id,
            JSON.stringify(value),
            updated,
          );
          send({ ok: true, updated });
          return;
        }
        if (req.url === "/api/settings") {
          db.prepare("INSERT OR REPLACE INTO settings VALUES (1,?)").run(
            JSON.stringify(value),
          );
          send({ ok: true });
          return;
        }
        if (req.url === "/api/restore") {
          if (
            value.version !== 1 ||
            !Array.isArray(value.scores) ||
            !value.scores.every(validScore)
          )
            throw Error("Invalid backup.");
          db.exec("BEGIN");
          try {
            for (const s of value.scores)
              db.prepare("INSERT OR REPLACE INTO library VALUES (?,?,?)").run(
                s.id,
                JSON.stringify(s),
                new Date().toISOString(),
              );
            db.prepare("INSERT OR REPLACE INTO settings VALUES (1,?)").run(
              JSON.stringify(value.settings || {}),
            );
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          send({ ok: true });
          return;
        }
      }
      res.writeHead(404).end(JSON.stringify({ error: "Unknown endpoint" }));
      return;
    }
    if (vite) {
      vite.middlewares(req, res, () => {
        res.writeHead(404).end();
      });
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    let file = path.resolve(root, "dist", "." + pathname);
    if (!file.startsWith(path.join(root, "dist") + path.sep)) {
      file = path.join(root, "dist/index.html");
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(root, "dist/index.html");
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
    };
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res
      .writeHead(400, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: e.message }));
  }
});
export const ready = new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Gradus → ${origin}`);
    resolve(server);
  });
});
await ready;
