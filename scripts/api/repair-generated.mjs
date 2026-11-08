// Repairs and normalizes the output of drizzle-kit 0.31.11 `pull`, so the committed files equal what any local
// stack produces (AC14: CI regenerates them on the test stack and fails on a diff). Remove each repair when pull is fixed.
// 1. an identity name that needs quoting (public.courses: "Courses_id_seq") is wrapped in a second pair of quotes;
// 2. a foreign key to auth.users refers to a `users` table that the public-only filter never defines, while
//    relations.ts imports `usersInAuth`. One stub with the id column is defined for both, so the files compile;
// 3. the order of tables, relations, imports and constraints follows object creation order, which differs between a
//    stack reset in one run and one built up over several; everything is sorted by name;
// 4. policies are dropped: the SQL migrations own them, the API connects with BYPASSRLS and never reads them, and pull
//    attaches expressions to the wrong policy.

const STUB = [
  "// Stub of auth.users (a managed schema that is not pulled): only the id that the foreign keys above need.",
  'export const usersInAuth = pgSchema("auth").table("users", {',
  "\tid: uuid().primaryKey().notNull(),",
  "});",
  "",
].join("\n");

function sortedNames(names) {
  return names
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .sort()
    .join(", ");
}

// An entry starts at a line with one tab of indentation that opens a call or a key, and runs to the next such line.
function sortEntries(body, start) {
  const lines = body.split("\n");
  const entries = [];
  for (const line of lines) {
    if (start.test(line) || entries.length === 0) entries.push([line]);
    else entries[entries.length - 1].push(line);
  }
  // Compared as whole entries: several foreign keys open with the same first line.
  return entries
    .map((entry) => entry.join("\n"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join("\n");
}

function normalize(file, text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const first = normalized.search(/^export const /m);
  if (first < 0) return normalized;
  const header = normalized.slice(0, first);
  const blocks = normalized
    .slice(first)
    .split(/^(?=export const )/m)
    .map((block) => block.replace(/\s+$/, ""));
  const named = blocks
    .map((block) => ({
      name: /^export const (\w+)/.exec(block)?.[1] ?? block,
      block,
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const sortedHeader = header.replace(
    /^import \{ ([^}]*) \} from "([^"]+)"/gm,
    (_, names, from) => `import { ${sortedNames(names)} } from "${from}"`,
  );
  const body = named
    .map(({ block }) => {
      if (file === "relations.ts") {
        // relations(table, ({one, many}) => ({ key: one(...), key: many(...) }));
        return block.replace(
          /(\(\{[^}]*\}\) => \(\{\n)([\s\S]*)(\n\}\)\);)$/,
          (_, open, entries, close) =>
            `${open}${sortEntries(entries, /^\t\w+: (one|many)\(/)}${close}`,
        );
      }
      // pgTable(name, {columns}, (table) => [ constraints ]);
      return block.replace(
        /(\(table\) => \[\n)([\s\S]*)(\n\]\);)$/,
        (_, open, entries, close) =>
          `${open}${sortEntries(entries, /^\t\w+\(/)}${close}`,
      );
    })
    .join("\n\n");
  return `${sortedHeader}${body}\n`;
}

export function repairGenerated(file, text) {
  let repaired = text.replace(/name: ""([^"\n]*)""/g, 'name: "$1"');
  let stub = false;
  if (file === "schema.ts") {
    repaired = repaired
      // A template literal may span lines, so it is matched whole before the closing `}),`.
      .replace(/^\tpgPolicy\((?:`[^`]*`|[^`])*?\}\),\n/gm, "")
      .replace(/pgPolicy, |, pgPolicy(?=[ ,}])/g, "")
      // A table that held only policies keeps no empty constraint list.
      .replace(/,\s*\(table\) => \[\s*\]\);/g, ");");
    if (/\[users\.id\]/.test(repaired)) {
      stub = true;
      repaired = repaired
        .replace(/\[users\.id\]/g, "[usersInAuth.id]")
        .replace(
          /^import \{ ([^}]*) \} from "drizzle-orm\/pg-core"/m,
          (_, names) =>
            `import { ${names}, pgSchema } from "drizzle-orm/pg-core"`,
        );
    }
  }
  repaired = normalize(file, repaired);
  // Placed last, so sorting never reorders it away from the tables that its name is used by.
  return stub ? `${repaired}${STUB}` : repaired;
}
