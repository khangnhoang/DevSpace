// Naming is independent of shape allowlists. Frozen legacy forms waive naming only.
import { readFileSync } from "node:fs";
import { posix } from "node:path";

export const legacyDeclarations = JSON.parse(readFileSync(new URL("./legacy-work-identifiers.json", import.meta.url), "utf8"));
export const canonicalId = /^([A-Z]{2,4})-([FPU])([1-9][0-9]*)$/;
export const nodeKey = (file, id) => `${file}#${id}`;

export function declarations(doc) {
  const result = [];
  const name = posix.basename(doc.rel);
  let section = "";
  for (const line of doc.content) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.text);
    if (heading?.[1] === "##") section = heading[2];
    let id, role;
    if (["problems.md", "future-features.md"].includes(name)) {
      if (heading && (heading[1].length === (name === "problems.md" ? 3 : 2) || /^[A-Z][A-Z0-9-]*\d(?::|\s|$)/.test(heading[2])) && !["Open", "Resolved", "Closed"].includes(heading[2])) {
        id = heading[2].split(/[\s:]/)[0];
        role = heading[1].length === (name === "problems.md" ? 3 : 2) ? "open" : "loose";
      } else if (/^[-*+]\s+/.test(line.text)) {
        const closed = /^[-*+]\s+\**([A-Z][A-Z0-9-]*\d)\**\s*(?:—|:)/.exec(line.text);
        if (closed) { id = closed[1]; role = ["Resolved", "Closed"].includes(section) ? "closed" : "loose"; }
      } else if (name === "problems.md" && /^\|/.test(line.text)) {
        const cell = line.text.split("|")[1]?.trim().replace(/~~/g, "");
        const legacyTable = doc.rel === "docs/programs/security-hotfix/problems.md" && section === "";
        if (cell && ((legacyTable && cell !== "#" && !/^:?-+:?$/.test(cell)) || /^(?:P\d+|[A-Z]{2,4}-[A-Z0-9-]*\d)$/.test(cell))) { id = cell; role = "problem-row"; }
      }
    } else if (name === "plan.md" || name === "README.md" || name === "plan-h2.md") {
      if (heading?.[1] === "#" && ["docs/programs/security-hotfix/plan.md", "docs/programs/security-hotfix/plan-h2.md"].includes(doc.rel)) {
        id = heading[2]; role = "legacy-plan";
      } else if (heading?.[1] === "#" && / detail plan — /.test(heading[2])) {
        id = heading[2].split(" detail plan — ")[0]; role = "plan-title";
      } else if (["4. Units", "4. Initiatives"].includes(section) && /^\|/.test(line.text)) {
        const cell = line.text.split("|")[1]?.trim();
        if (cell && !/^(?:Unit|Initiative)\b|^:?-+/.test(cell)) { id = cell.split(/\s/)[0]; role = "unit-row"; }
      }
    }
    if (id) result.push({ file: doc.rel, id, role, form: line.text, n: line.n,
      moved: role === "closed" && / — Moved\b/.test(line.text) });
  }
  return result;
}

export function isLegacy(entry) {
  return legacyDeclarations.some((old) => old.file === entry.file && old.id === entry.id && old.role === entry.role && old.form === entry.form);
}

// Allocation is a procedure, not a continuity check. Legacy F/P numbers do not reserve new numbers.
export function nextIdentifier(code, kind, issued, mappings = []) {
  let highest = 0n;
  for (const entry of [...issued, ...mappings.map((mapping) => mapping.from)]) {
    const match = canonicalId.exec(entry.id);
    if (match?.[1] === code && match[2] === kind && BigInt(match[3]) > highest) highest = BigInt(match[3]);
    if (kind === "U" && entry.code === code && /^U[1-9][0-9]*$/.test(entry.id) && BigInt(entry.id.slice(1)) > highest) highest = BigInt(entry.id.slice(1));
  }
  return `${code}-${kind}${highest + 1n}`;
}

export function checkIdentifiers(docs, rows, mappings, report) {
  const codes = new Map(rows.map((row) => [row.path, row.code]));
  const all = [...docs.values()].flatMap(declarations);
  const owned = new Map(), nodes = new Map(), seenLegacy = new Set();
  const error = (entry, rule, message) => report(entry.file, entry.n ?? 1, rule, message);
  for (const entry of all) {
    const dir = posix.dirname(entry.file);
    const home = entry.file.startsWith("docs/backlog/") ? "BL" : codes.get(entry.file.split("/").slice(0, 3).join("/"));
    entry.code = home;
    const match = canonicalId.exec(entry.id);
    const legacy = isLegacy(entry);
    if (!match && !legacy) error(entry, "work-id", `${entry.id} must use <CODE>-<KIND><positive number> or an exact retained legacy form`);
    if (entry.role === "problem-row" && !legacy) error(entry, "work-id", "only exact historical problem table rows are retained; use standard open/closed entries for new work");
    if (legacy) {
      const key = `${nodeKey(entry.file, entry.id)}#${entry.role}`;
      if (seenLegacy.has(key)) error(entry, "work-id", `duplicate legacy declaration ${entry.id}`);
      seenLegacy.add(key);
    }
    if (match) {
      const kind = entry.role === "unit-row" ? "U" : posix.basename(entry.file) === "problems.md" ? "P" : posix.basename(entry.file) === "future-features.md" ? "F" : match[2];
      if (!home || match[1] !== home || match[2] !== kind) error(entry, "work-id", `${entry.id} has the wrong owner or kind for ${entry.file}`);
      if (["open", "loose"].includes(entry.role) && !new RegExp(`^#{2,3} ${entry.id}: \\S`).test(entry.form)) error(entry, "work-id", `${entry.id} needs a colon and nonempty title`);
      if (entry.role === "unit-row" && !new RegExp(`^${entry.id}\\s+\\S`).test(entry.form.split("|")[1]?.trim() ?? "")) error(entry, "work-id", `${entry.id} needs a title after its table ID`);
    }
    const key = nodeKey(entry.file, entry.id);
    if (entry.role === "legacy-plan") continue;
    if (nodes.has(key)) error(entry, "work-ownership", `${entry.id} is declared more than once in the same file, including pointers`);
    nodes.set(key, entry);
    if (entry.role === "plan-title") continue; // The table owns nested U; the plan is its identity claim.
    if (entry.moved) continue;
    if (match) {
      if (owned.has(entry.id)) error(entry, "work-ownership", `${entry.id} has duplicate canonical ownership (first at ${owned.get(entry.id).file})`);
      else owned.set(entry.id, entry);
    }
    if (!match && entry.role === "unit-row") entry.code = codes.get(dir);
  }
  const edges = new Map();
  for (const mapping of mappings) {
    if (!mapping?.from?.file || !mapping.from.id || !mapping?.to?.file || !mapping.to.id) {
      report("scripts/docs/work-id-mappings.json", 1, "work-mapping", "mapping needs file-qualified from and to IDs"); continue;
    }
    const from = nodeKey(mapping.from.file, mapping.from.id);
    if (edges.has(from)) report(mapping.from.file, 1, "work-mapping", `ambiguous mapping source ${from}`);
    edges.set(from, nodeKey(mapping.to.file, mapping.to.id));
    const source = nodes.get(from);
    if (source && !source.moved) error(source, "work-mapping", `${from} is mapped but still declares owned work`);
    const sourceKind = canonicalId.exec(mapping.from.id)?.[2];
    const destinationKind = canonicalId.exec(mapping.to.id)?.[2];
    const sourceId = canonicalId.exec(mapping.from.id);
    if (sourceId) {
      const sourceHome = mapping.from.file.startsWith("docs/backlog/") ? "BL" : codes.get(mapping.from.file.split("/").slice(0, 3).join("/"));
      const fileKind = posix.basename(mapping.from.file) === "future-features.md" ? "F" : posix.basename(mapping.from.file) === "problems.md" ? "P" : "U";
      if (sourceId[1] !== sourceHome || sourceKind !== fileKind) report(mapping.from.file, 1, "work-mapping", `mapping source has the wrong owner or kind: ${from}`);
    }
    if (sourceKind && destinationKind && sourceKind !== destinationKind) report(mapping.from.file, 1, "work-mapping", `mapping changes kind: ${from}`);
    if (posix.basename(mapping.from.file) !== posix.basename(mapping.to.file)) report(mapping.from.file, 1, "work-mapping", `mapping changes file kind: ${from}`);
  }
  const resolve = (key, visiting = new Set()) => {
    if (visiting.has(key)) return null;
    visiting.add(key);
    if (edges.has(key)) return resolve(edges.get(key), visiting);
    const entry = nodes.get(key);
    return entry && !entry.moved ? entry : null;
  };
  for (const [from] of edges) {
    if (!resolve(from)) report(from.split("#")[0], 1, "work-mapping", `mapping has a cycle or missing canonical destination: ${from}`);
  }
  for (const entry of all.filter((item) => item.moved)) {
    const key = nodeKey(entry.file, entry.id);
    const target = resolve(key);
    if (!edges.has(key) || !target) error(entry, "work-mapping", `${entry.id} moved pointer needs a mapping to one owned destination`);
    else {
      const link = /\]\(([^)]+)\)/.exec(entry.form)?.[1];
      const first = edges.get(key)?.split("#")[0];
      if (!link || posix.normalize(posix.join(posix.dirname(entry.file), link)) !== first) error(entry, "work-mapping", `${entry.id} pointer link disagrees with its mapped destination file`);
    }
  }
  return all;
}
