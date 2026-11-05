// Generates src/lib/database.types.ts from the real database schema, in the format
// supabase-js expects (createClient<Database>), so table rows and function
// arguments are type-checked against what is actually in the database.
//
//   bun run db:types    reads your project through SUPABASE_DB_URL (read-only)
//
// Run it after applying a migration and commit the result.

import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { format, resolveConfig } from "prettier";

export type Query = (text: string) => Promise<Record<string, unknown>[]>;

export const TYPES_FILE = "src/lib/database.types.ts";

const SCALARS: Record<string, string> = {
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  float4: "number",
  float8: "number",
  numeric: "number",
  json: "Json",
  jsonb: "Json",
  void: "undefined",
};
const STRINGS = ["text", "varchar", "bpchar", "uuid", "date", "time", "timetz", "timestamp"];
STRINGS.push("timestamptz", "interval", "citext", "inet", "bytea");

/** TypeScript type of a Postgres type name ("_text" is text[]). */
function tsType(typname: string, enums: Set<string>): string {
  if (typname.startsWith("_")) return `${tsType(typname.slice(1), enums)}[]`;
  if (enums.has(typname)) return `Database["public"]["Enums"]["${typname}"]`;
  if (STRINGS.includes(typname)) return "string";
  return SCALARS[typname] ?? "unknown";
}

type Column = {
  table: string;
  column: string;
  typname: string;
  nullable: boolean;
  has_default: boolean;
  generated: boolean;
};
type ForeignKey = { name: string; table: string; ref: string; cols: string[]; refcols: string[] };
type Fn = {
  name: string;
  args: { name: string; typname: string; optional: boolean }[];
  ret: string;
};

export async function generateTypes(query: Query): Promise<string> {
  const enumRows = (await query(`
    select t.typname as name, to_json(array_agg(e.enumlabel order by e.enumsortorder)) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname order by t.typname`)) as { name: string; labels: string[] }[];
  const enums = new Set(enumRows.map((e) => e.name));

  const columns = (await query(`
    select c.relname as table, a.attname as column, t.typname,
           not a.attnotnull as nullable,
           a.atthasdef or a.attidentity <> '' as has_default,
           a.attgenerated <> '' as generated
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attname`)) as Column[];

  const foreignKeys = (await query(`
    select con.conname as name, rel.relname as table, frel.relname as ref,
      to_json(array(select attname from pg_attribute
        where attrelid = con.conrelid and attnum = any(con.conkey))) as cols,
      to_json(array(select attname from pg_attribute
        where attrelid = con.confrelid and attnum = any(con.confkey))) as refcols
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
    order by con.conname`)) as ForeignKey[];

  const fnRows = (await query(`
    select p.proname as name, p.pronargs as nargs, p.pronargdefaults as ndefaults,
      to_json(p.proargnames) as argnames,
      to_json(array(select t.typname from unnest(p.proargtypes::oid[]) with ordinality a(oid, i)
        join pg_type t on t.oid = a.oid order by a.i)) as argtypes,
      rt.typname as ret
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public' and p.prokind = 'f' and rt.typname <> 'trigger'
    order by p.proname, p.pronargs`)) as {
    name: string;
    nargs: number;
    ndefaults: number;
    argnames: string[] | null;
    argtypes: string[];
    ret: string;
  }[];
  const fns: Fn[] = fnRows.map((f) => ({
    name: f.name,
    ret: f.ret,
    args: f.argtypes.map((typname, i) => ({
      name: f.argnames?.[i] ?? `arg${i}`,
      typname,
      optional: i >= f.nargs - f.ndefaults,
    })),
  }));

  const tables = [...new Set(columns.map((c) => c.table))];
  const tableBlock = (table: string) => {
    const cols = columns.filter((c) => c.table === table);
    const field = (c: Column, mode: "Row" | "Insert" | "Update") => {
      const type = tsType(c.typname, enums) + (c.nullable ? " | null" : "");
      if (mode === "Row") return `${c.column}: ${type}`;
      if (c.generated) return `${c.column}?: never`;
      const optional = mode === "Update" || c.nullable || c.has_default;
      return `${c.column}${optional ? "?" : ""}: ${type}`;
    };
    const rels = foreignKeys
      .filter((fk) => fk.table === table)
      .map(
        (fk) =>
          `{ foreignKeyName: ${JSON.stringify(fk.name)}; columns: ${JSON.stringify(fk.cols)}; ` +
          `isOneToOne: false; referencedRelation: ${JSON.stringify(fk.ref)}; ` +
          `referencedColumns: ${JSON.stringify(fk.refcols)} }`,
      );
    const modes = (["Row", "Insert", "Update"] as const).map(
      (m) => `${m}: { ${cols.map((c) => field(c, m)).join("; ")} }`,
    );
    return `${table}: { ${modes.join("; ")}; Relationships: [${rels.join(", ")}] }`;
  };

  const fnNames = [...new Set(fns.map((f) => f.name))];
  const fnBlock = (name: string) => {
    const overloads = fns.filter((f) => f.name === name);
    const args = overloads.map((f) =>
      f.args.length === 0
        ? "Record<PropertyKey, never>"
        : `{ ${f.args.map((a) => `${a.name}${a.optional ? "?" : ""}: ${tsType(a.typname, enums)}`).join("; ")} }`,
    );
    return `${name}: { Args: ${args.join(" | ")}; Returns: ${tsType(overloads[0]!.ret, enums)} }`;
  };

  const empty = "{ [_ in never]: never }";
  const source = `// Generated by scripts/gen-db-types.ts from the database schema. Do not edit it directly:
// apply a migration, then run \`bun run db:types\`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: { ${tables.map(tableBlock).join("; ")} };
    Views: ${empty};
    Functions: { ${fnNames.map(fnBlock).join("; ")} };
    Enums: { ${enumRows.map((e) => `${e.name}: ${e.labels.map((l) => JSON.stringify(l)).join(" | ")}`).join("; ")} };
    CompositeTypes: ${empty};
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
export type FunctionName = keyof PublicSchema["Functions"];
`;
  const config = await resolveConfig(TYPES_FILE);
  return format(source, { ...config, parser: "typescript" });
}

async function main() {
  const url = process.env["SUPABASE_DB_URL"];
  if (!url) {
    console.error("SUPABASE_DB_URL is not set. Add it to .env.local (see .env.local.example).");
    process.exit(1);
  }
  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    writeFileSync(TYPES_FILE, await generateTypes((text) => sql.unsafe(text)));
    console.log(`Wrote ${TYPES_FILE} from ${new URL(url).hostname}`);
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    console.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
