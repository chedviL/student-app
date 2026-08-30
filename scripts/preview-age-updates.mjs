/**
 * preview-age-updates.mjs
 * 
 * Preview which students will be affected by the monthly age increment.
 * Shows: old age → new age
 * 
 * RUN THIS FIRST before executing the actual update!
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

// Function to increment age correctly
function incrementAge(ageStr) {
  if (!ageStr || ageStr === '') return ageStr;

  const dotIdx = ageStr.indexOf('.');
  let years, months;

  if (dotIdx === -1) {
    // No dot: just years
    years = parseInt(ageStr, 10);
    months = 0;
  } else {
    // Has dot
    years = parseInt(ageStr.substring(0, dotIdx), 10);
    months = parseInt(ageStr.substring(dotIdx + 1), 10);
  }

  // Increment
  months += 1;
  if (months > 11) {
    years += 1;
    months = 0;
  }

  if (months === 0) {
    return years.toString();
  } else {
    return `${years}.${months}`;
  }
}

// Check if update was already run this month
async function checkPreviousUpdates() {
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

  const { data, error } = await supabase
    .from('monthly_age_updates')
    .select('student_id, update_date', { count: 'exact' })
    .gte('update_date', currentMonth + '-01');

  if (error) {
    console.log('⚠️  Note: monthly_age_updates table not found yet (needs migration)');
    return [];
  }

  return data || [];
}

// Main preview
async function main() {
  console.log('📋 PREVIEW: Monthly Age Update');
  console.log('================================\n');

  // Check if migration applied
  const previousUpdates = await checkPreviousUpdates();
  const updatedThisMonth = new Set(previousUpdates.map((u) => u.student_id));

  // Get all students with valid ages
  const { data: students, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, age, gregorian_date')
    .not('age', 'is', null)
    .neq('age', '');

  if (error) {
    console.error('❌ Error fetching students:', error.message);
    process.exit(1);
  }

  if (!students || students.length === 0) {
    console.log('✓ No students found');
    process.exit(0);
  }

  const willUpdate = students.filter(
    (s) => !updatedThisMonth.has(s.id)
  );

  console.log(`Total students: ${students.length}`);
  console.log(`Already updated this month: ${updatedThisMonth.size}`);
  console.log(`Will be updated: ${willUpdate.length}\n`);

  if (willUpdate.length > 0) {
    console.log('Changes to apply:');
    console.log('-'.repeat(80));
    console.log('Name                      | Current Age | New Age | Gregorian Date');
    console.log('-'.repeat(80));

    willUpdate.forEach((s) => {
      const newAge = incrementAge(s.age);
      const name = `${s.first_name} ${s.last_name}`.substring(0, 24).padEnd(24);
      const oldAge = (s.age || '').padEnd(11);
      const gDate = s.gregorian_date || 'N/A';
      console.log(`${name} | ${oldAge} | ${newAge.padEnd(7)} | ${gDate}`);
    });

    console.log('-'.repeat(80));
  } else {
    console.log('✓ No students to update (all already updated this month or table not ready)');
  }

  console.log('\n📌 To apply these changes, run:');
  console.log('   npm run execute-age-update\n');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
