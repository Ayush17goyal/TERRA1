import { createClient } from '@supabase/supabase-js';
import { repairMojibakeText } from './repair-mojibake.mjs';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const write = process.argv.includes('--write');

const targets = [
  { table: 'mentor_interactions', id: 'id', columns: ['user_message', 'response_text', 'metadata'] },
  { table: 'documents', id: 'id', columns: ['title', 'description', 'extracted_text', 'metadata'] },
  { table: 'document_chunks', id: 'id', columns: ['text', 'raw_excerpt', 'summary', 'metadata'] },
  { table: 'pattern_library', id: 'id', columns: ['name', 'purpose', 'reasoning', 'content', 'metadata'] },
  { table: 'student_drafts', id: 'id', columns: ['title', 'content', 'feedback', 'metadata'] },
];

if (!url || !key) {
  throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function repairValue(value) {
  if (typeof value === 'string') return repairMojibakeText(value);
  if (Array.isArray(value)) return value.map(repairValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairValue(item)]));
  }
  return value;
}

function changed(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

let total = 0;
for (const target of targets) {
  const select = [target.id, ...target.columns].join(',');
  const { data, error } = await supabase.from(target.table).select(select).limit(10000);
  if (error) {
    console.warn(`Skipping ${target.table}: ${error.message}`);
    continue;
  }

  for (const row of data || []) {
    const patch = {};
    for (const column of target.columns) {
      if (!(column in row)) continue;
      const repaired = repairValue(row[column]);
      if (changed(row[column], repaired)) patch[column] = repaired;
    }
    if (!Object.keys(patch).length) continue;
    total += 1;
    console.log(`${write ? 'repairing' : 'would repair'} ${target.table}.${target.id}=${row[target.id]}`);
    if (write) {
      const { error: updateError } = await supabase.from(target.table).update(patch).eq(target.id, row[target.id]);
      if (updateError) throw new Error(`${target.table}.${row[target.id]}: ${updateError.message}`);
    }
  }
}

console.log(`${write ? 'Repaired' : 'Would repair'} ${total} row(s).`);
