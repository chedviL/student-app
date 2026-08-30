/**
 * execute-age-recovery.mjs
 * 
 * Execute age recovery: updates all ages based on gregorian_date
 * ALWAYS run recover-ages-from-dates.mjs FIRST to see preview!
 */
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

function parseGregorianDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  try {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month - 1, day);
  } catch {
    return null;
  }
}

function calculateAge(birthDate) {
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }

  if (today.getDate() < birthDate.getDate()) {
    months--;
    if (months < 0) {
      years--;
      months += 12;
    }
  }

  if (months === 0) {
    return years.toString();
  } else {
    return `${years}.${months}`;
  }
}

async function main() {
  console.log('🔄 Executing Age Recovery...\n');

  const { data: students, error } = await supabase
    .from('students')
    .select('id, age, gregorian_date')
    .not('gregorian_date', 'is', null)
    .neq('gregorian_date', '');

  if (error) {
    console.error('❌ Error fetching students:', error.message);
    process.exit(1);
  }

  let corrected = 0;
  const updates = [];

  for (const student of students) {
    const birthDate = parseGregorianDate(student.gregorian_date);
    if (!birthDate || isNaN(birthDate.getTime())) continue;

    const correctAge = calculateAge(birthDate);
    if (correctAge !== student.age) {
      updates.push({
        id: student.id,
        age: correctAge,
      });
      corrected++;
    }
  }

  if (updates.length === 0) {
    console.log('✓ All ages are already correct!');
    process.exit(0);
  }

  console.log(`⏳ Updating ${updates.length} students...\n`);

  // Batch update in chunks
  const chunkSize = 100;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);

    for (const update of chunk) {
      const { error: err } = await supabase
        .from('students')
        .update({ age: update.age, updated_at: new Date().toISOString() })
        .eq('id', update.id);

      if (err) {
        console.error(`❌ Error updating ${update.id}:`, err.message);
      }
    }

    console.log(`✓ Updated ${Math.min(i + chunkSize, updates.length)}/${updates.length}`);
  }

  console.log(`\n✓ Successfully recovered ${corrected} ages!`);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
