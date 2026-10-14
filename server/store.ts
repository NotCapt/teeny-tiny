export type AppEnv = { DB?: D1Database; BUCKET?: R2Bucket; TINYFISH_API_KEY?: string; PUBLIC_ORIGIN?: string };
export type RecordEntry<T> = { id: string; owner: string; kind: string; data: T; version: number; created_at: string };
export async function getRecord<T>(env: AppEnv, id: string, owner?: string): Promise<RecordEntry<T> | null> {
  if (!env.DB) throw new Error("Database is not configured.");
  const row = await env.DB.prepare("SELECT * FROM records WHERE id = ?" + (owner ? " AND owner = ?" : "")).bind(...(owner ? [id, owner] : [id])).first<{id:string;owner:string;kind:string;data:string;version:number;created_at:string}>();
  return row ? { ...row, data: JSON.parse(row.data) } : null;
}
export async function insertRecord<T>(env: AppEnv, id: string, owner: string, kind: string, data: T) {
  if (!env.DB) throw new Error("Database is not configured.");
  await env.DB.prepare("INSERT INTO records (id,owner,kind,data,version,created_at) VALUES (?,?,?,?,0,?)").bind(id,owner,kind,JSON.stringify(data),new Date().toISOString()).run();
}
export async function mutateRecord<T>(env: AppEnv, id: string, owner: string, update: (data: T) => void): Promise<T> {
  for (let i=0;i<5;i++) {
    const record = await getRecord<T>(env,id,owner);
    if(!record) throw new Error("Record not found.");
    update(record.data);
    const result=await env.DB!.prepare("UPDATE records SET data=?, version=version+1 WHERE id=? AND owner=? AND version=?").bind(JSON.stringify(record.data),id,owner,record.version).run();
    if(result.meta.changes) return record.data;
  }
  throw new Error("This case changed. Please refresh and try again.");
}
export async function listRecords<T>(env: AppEnv, owner: string, kind: string): Promise<T[]> {
  if(!env.DB) return [];
  const rows=await env.DB.prepare("SELECT data FROM records WHERE owner=? AND kind=? ORDER BY created_at DESC LIMIT 20").bind(owner,kind).all<{data:string}>();
  return rows.results.map(r=>JSON.parse(r.data));
}
