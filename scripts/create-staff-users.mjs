import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.admin" });

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_TEST_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const password = process.env.STAFF_INITIAL_PASSWORD;

if (!supabaseUrl) {
  throw new Error("Supabase URL was not found in .env.admin");
}

if (!serviceRoleKey) {
  throw new Error("Service role key was not found in .env.admin");
}

if (!password) {
  throw new Error("STAFF_INITIAL_PASSWORD is missing");
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const staff = [
  {
    displayName: "ישראל ליפל",
    email: "ygpm001@gmail.com",
  },
  {
    displayName: "בערל רוקח",
    email: "ygpm002@gmail.com",
  },
  {
    displayName: "מזכיר",
    email: "ygpm003@gmail.com",
  },
];

async function findExistingUser(email) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) throw error;

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (user) return user;

    if (data.users.length < 100) return null;

    page++;
  }
}

async function ensureProfile(userId, displayName) {
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: displayName,
      },
      {
        onConflict: "id",
      }
    );

  if (error) throw error;
}

async function main() {
  for (const person of staff) {
    console.log(`\nProcessing: ${person.displayName}`);

    const existing = await findExistingUser(person.email);

    if (existing) {
      console.log(`User already exists: ${person.email}`);
      console.log("Password was NOT changed.");

      await ensureProfile(existing.id, person.displayName);

      console.log(`Profile updated: ${person.displayName}`);
      continue;
    }

    const { data, error } =
      await supabase.auth.admin.createUser({
        email: person.email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: person.displayName,
        },
      });

    if (error) {
      console.error(`Failed: ${person.email}`);
      console.error(error.message);
      continue;
    }

    if (!data.user) {
      console.error(`No user returned for ${person.email}`);
      continue;
    }

    await ensureProfile(
      data.user.id,
      person.displayName
    );

    console.log(`Created: ${person.email}`);
    console.log(`Display name: ${person.displayName}`);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("\nFAILED:");
  console.error(error.message);
  process.exit(1);
});