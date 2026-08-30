/**
 * execute-age-update.mjs
 * 
 * Execute the monthly age increment via the Supabase function.
 * ALWAYS run preview-age-updates.mjs FIRST to see what will change!
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

async function main() {
  console.log('🔄 Executing Monthly Age Update...\n');

  try {
    // Call the stored function
    const { data, error } = await supabase.rpc('process_monthly_age_update');

    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }

    const updates = data || [];
    console.log(`✓ Updated ${updates.length} students\n`);

    if (updates.length > 0) {
      console.log('Summary:');
      console.log('-'.repeat(60));
      updates.forEach((u, idx) => {
        console.log(`  ${idx + 1}. ${u.old_age} → ${u.new_age}`);
      });
      console.log('-'.repeat(60));
      console.log('\n✓ All ages incremented successfully!');
    } else {
      console.log('ℹ️  No students were updated (already updated this month?)');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
