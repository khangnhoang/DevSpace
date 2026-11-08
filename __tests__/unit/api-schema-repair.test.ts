import { describe, expect, it } from "vitest";
import { repairGenerated } from "../../scripts/api/repair-generated.mjs";

describe("repairGenerated (drizzle-kit 0.31.11 pull output, AC14)", () => {
  it("removes the doubled quotes around an identity name and nothing else", () => {
    const input =
      'id: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: ""Courses_id_seq"", startWith: 1 }),\n';
    expect(repairGenerated("schema.ts", input)).toBe(
      'id: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "Courses_id_seq", startWith: 1 }),\n',
    );
  });

  it("defines the auth.users stub once and points the foreign keys at it, only when schema.ts refers to users", () => {
    const input = [
      'import { pgTable, uuid } from "drizzle-orm/pg-core"',
      "export const a = pgTable('a', {}, (table) => [foreignKey({ columns: [t.x], foreignColumns: [users.id] })]);",
      "",
    ].join("\n");
    const output = repairGenerated("schema.ts", input);
    expect(output).toContain(
      'import { pgSchema, pgTable, uuid } from "drizzle-orm/pg-core"',
    );
    expect(output).toContain("foreignColumns: [usersInAuth.id]");
    expect(output).not.toContain("[users.id]");
    expect(output.match(/export const usersInAuth/g)).toHaveLength(1);
    expect(output.trimEnd().endsWith("});")).toBe(true);
    const clean = "export const a = 1;\n";
    expect(repairGenerated("schema.ts", clean)).toBe(clean);
  });

  it("gives the same text for tables, imports, constraints and relations in any order, and drops policies", () => {
    const table = (name: string, constraints: string[]) =>
      [
        `export const ${name} = pgTable("${name}", {`,
        "\tid: uuid().primaryKey().notNull(),",
        "}, (table) => [",
        ...constraints,
        "]);",
      ].join("\n");
    const policy =
      '\tpgPolicy("p", { as: "permissive", for: "select", to: ["public"], using: sql`(a IN ( SELECT b\n   FROM c))` }),';
    const fk = (n: string) =>
      `\tforeignKey({\n\t\t\tcolumns: [table.id],\n\t\t\tforeignColumns: [x.id],\n\t\t\tname: "${n}"\n\t\t}),`;
    const unique = '\tunique("u").on(table.id),';
    const build = (order: "ab" | "ba") => {
      const a = table("a", [policy, fk("fk_2"), unique, fk("fk_1")]);
      const b = table("b", [unique, policy, fk("fk_1")]);
      return [
        order === "ab"
          ? 'import { pgTable, uuid, pgPolicy, unique, foreignKey } from "drizzle-orm/pg-core"'
          : 'import { foreignKey, unique, pgPolicy, uuid, pgTable } from "drizzle-orm/pg-core"',
        'import { sql } from "drizzle-orm"',
        "",
        ...(order === "ab" ? [a, b] : [b, a]).flatMap((t) => [t, ""]),
      ].join("\n");
    };
    const first = repairGenerated("schema.ts", build("ab"));
    expect(repairGenerated("schema.ts", build("ba"))).toBe(first);
    expect(first).not.toContain("pgPolicy");
    expect(first).not.toContain("SELECT");
    expect(first.indexOf("export const a")).toBeLessThan(
      first.indexOf("export const b"),
    );

    const relation = (name: string, keys: string[]) =>
      [
        `export const ${name}Relations = relations(${name}, ({one, many}) => ({`,
        ...keys,
        "}));",
      ].join("\n");
    const one = "\tuser: one(users, {\n\t\tfields: [a.id],\n\t}),";
    const many = "\tpayments: many(payments),";
    const rel = (order: "xy" | "yx") =>
      [
        'import { relations } from "drizzle-orm/relations";',
        'import { users, a, payments } from "./schema";',
        "",
        ...(order === "xy"
          ? [relation("a", [one, many]), relation("b", [many])]
          : [relation("b", [many]), relation("a", [many, one])]
        ).flatMap((r) => [r, ""]),
      ].join("\n");
    expect(repairGenerated("relations.ts", rel("yx"))).toBe(
      repairGenerated("relations.ts", rel("xy")),
    );
  });
});
