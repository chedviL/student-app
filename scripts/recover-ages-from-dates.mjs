/**
 * recover-ages-from-dates.mjs
 * 
 * Recovery script: calculates correct age (years.months) from gregorian_date
 * Shows preview before making changes
 * 
 * PREVIEW RUN THIS FIRST!
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

// Parse gregorian_date in DD/MM/YYYY format
function parseGregorianDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  try {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month - 1, day); // month is 0-indexed
  } catch {
    return null;
  }
}

// Calculate age in years.months format from birthdate to today
function calculateAge(birthDate) {
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();

  // Adjust for month rollback
  if (months < 0) {
    years--;
    months += 12;
  }

  // If exactly on birthday, no adjustment needed
  if (today.getDate() < birthDate.getDate()) {
    months--;
    if (months < 0) {
      years--;
      months += 12;
    }
  }

  // Format: just years if months=0, otherwise years.months
  if (months === 0) {
    return years.toString();
  } else {
    return `${years}.${months}`;
  }
}

async function main() {
  console.log('🔍 RECOVERY PREVIEW: Age Recalculation from Gregorian Dates');
  console.log('==============================================================\n');

  const { data: students, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, age, gregorian_date')
    .not('gregorian_date', 'is', null)
    .neq('gregorian_date', '');

  if (error) {
    console.error('❌ Error fetching students:', error.message);
    process.exit(1);
  }

  if (!students || students.length === 0) {
    console.log('✓ No students with gregorian_date found');
    process.exit(0);
  }

  // Calculate corrections
  const corrections = [];
  students.forEach((s) => {
    const birthDate = parseGregorianDate(s.gregorian_date);
    if (!birthDate || isNaN(birthDate.getTime())) {
      return; // Skip invalid dates
    }

    const correctAge = calculateAge(birthDate);
    if (correctAge !== s.age) {
      corrections.push({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        currentAge: s.age,
        correctAge,
        birthDate: s.gregorian_date,
      });
    }
  });

  console.log(`Total students with valid gregorian_date: ${students.length}`);
  console.log(`Will be corrected: ${corrections.length}\n`);

  if (corrections.length > 0) {
    console.log('Changes to apply:');
    console.log('-'.repeat(100));
    console.log('Name                      | Birth Date | Current Age | → Correct Age');
    console.log('-'.repeat(100));

    corrections.forEach((c) => {
      const name = c.name.substring(0, 24).padEnd(24);
      const current = (c.currentAge || '?').padEnd(11);
      console.log(`${name} | ${c.birthDate.padEnd(10)} | ${current} | → ${c.correctAge}`);
    });

    console.log('-'.repeat(100));
    console.log(`\n✓ Ready to apply ${corrections.length} corrections\n`);
    console.log('To apply these changes, run:');
    console.log('   npm run execute-age-recovery\n');
  } else {
    console.log('✓ All ages are already correct!');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
