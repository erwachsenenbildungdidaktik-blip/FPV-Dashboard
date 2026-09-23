/* FPV OPS — Backup-Code und Backup-Datei, Kodierung und Dekodierung. */

// Backup-Code: der ganze Datenstand als eine Textzeile, damit er sich auf dem
// Handy über das Teilen-Menü in Notizen, Mail oder einen Chat an sich selbst
// legen lässt. Keine Datei, kein Dateimanager. "FPV1." ist komprimiert,
// "FPV0." der Rückfall für Browser ohne CompressionStream.

function b64urlFromBytes(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function streamBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Response(stream).arrayBuffer().then((b) => new Uint8Array(b));
}

export function encodeBackup(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== "function") {
    return Promise.resolve("FPV0." + b64urlFromBytes(bytes));
  }
  return streamBytes(bytes, new CompressionStream("deflate-raw")).then(
    (z) => "FPV1." + b64urlFromBytes(z),
    () => "FPV0." + b64urlFromBytes(bytes)
  );
}

export function decodeBackup(text) {
  const t = String(text || "").replace(/\s+/g, "");
  return Promise.resolve()
    .then(function () {
      if (t.charAt(0) === "{") return t;
      const m = /^FPV([01])\.([A-Za-z0-9_-]+)$/.exec(t);
      if (!m) throw new Error("kein Backup-Code");
      const bytes = bytesFromB64url(m[2]);
      if (m[1] === "0") return new TextDecoder().decode(bytes);
      if (typeof DecompressionStream !== "function") {
        throw new Error("Browser kann den Code nicht entpacken");
      }
      return streamBytes(bytes, new DecompressionStream("deflate-raw")).then((b) =>
        new TextDecoder().decode(b)
      );
    })
    .then(function (json) {
      const p = JSON.parse(json);
      if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("kein Objekt");
      return p;
    });
}
