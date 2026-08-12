import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.admin')

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREATE_USER_EMAIL, CREATE_USER_PASSWORD } = env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CREATE_USER_EMAIL || !CREATE_USER_PASSWORD) {
  console.error('חסרים משתנים ב-.env.admin')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const { data, error } = await supabase.auth.admin.createUser({
  email: CREATE_USER_EMAIL,
  password: CREATE_USER_PASSWORD,
  email_confirm: true
})

if (error) {
  console.error('שגיאה:', error.message)
  process.exit(1)
}

console.log('✅ משתמש נוצר בהצלחה:')
console.log('  ID:', data.user.id)
console.log('  Email:', data.user.email)
console.log('  Confirmed:', data.user.email_confirmed_at)
