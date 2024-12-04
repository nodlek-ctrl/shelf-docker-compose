// I haven't really used this, once I got this working via making SMTP work, with that I could sign up
// I made this because I had some problems with my SMTP server
import { load } from "https://deno.land/std/dotenv/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dirname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

// Load environment variables
const env = await load({ envPath: join(__dirname, "../.env") });

// Read environment variables
const {
  SERVICE_ROLE_KEY,
  NEW_USER_EMAIL,
  NEW_USER_PASSWORD,
  ORG_NAME = "My Organization",
} = {
  ...env,
  ...Deno.env.toObject(),
};

// Validate required environment variables
if (!SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE is required");
  Deno.exit(1);
}

if (!NEW_USER_EMAIL || !NEW_USER_PASSWORD) {
  console.error("Error: NEW_USER_EMAIL and NEW_USER_PASSWORD are required");
  Deno.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient("http://localhost:8000", SERVICE_ROLE_KEY);

async function createUserAndOrganization() {
  try {
    // First try to get the user by email
    const { data: existingUser, error: fetchError } =
      await supabase.auth.admin.listUsers();

    if (fetchError) {
      throw fetchError;
    }

    let userId;
    const existingUserData = existingUser.users.find(
      (user) => user.email === NEW_USER_EMAIL,
    );

    if (existingUserData) {
      // User exists, use their ID
      userId = existingUserData.id;
      console.log("Found existing user:", {
        email: NEW_USER_EMAIL,
        id: userId,
      });
    } else {
      // Create new user
      const { data: userData, error: userError } =
        await supabase.auth.admin.createUser({
          email: NEW_USER_EMAIL,
          password: NEW_USER_PASSWORD,
          email_confirm: true,
        });

      if (userError) {
        throw userError;
      }

      userId = userData.user.id;
      console.log("Created new user:", { email: NEW_USER_EMAIL, id: userId });
    }

    // Insert into User table
    const { error: userTableError } = await supabase.from("User").insert([
      {
        id: userId,
        email: NEW_USER_EMAIL,
        firstName: "New",
        lastName: "User",
        username: NEW_USER_EMAIL.split("@")[0],
        onboarded: false,
        usedFreeTrial: false,
        sso: false,
        createdWithInvite: false,
      },
    ]);

    if (userTableError) {
      console.error("Error creating User entry:", userTableError);
      throw userTableError;
    }

    // Create organization
    const { data: orgData, error: orgError } = await supabase
      .from("Organization")
      .insert([
        {
          name: ORG_NAME,
          userId: userId,
          type: "PERSONAL",
          currency: "USD",
          enabledSso: false,
        },
      ])
      .select()
      .single();

    if (orgError) {
      throw orgError;
    }

    // Create UserOrganization entry
    const { error: userOrgError } = await supabase
      .from("UserOrganization")
      .insert([
        {
          userId: userId,
          organizationId: orgData.id,
          roles: ["ADMIN"], // ARRAY type with _OrganizationRoles format
        },
      ]);

    if (userOrgError) {
      console.error("Error creating UserOrganization entry:", userOrgError);
      throw userOrgError;
    }

    console.log("User and organization created successfully:", {
      userId: userId,
      email: NEW_USER_EMAIL,
      organizationId: orgData.id,
      organizationName: ORG_NAME,
    });
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
}

await createUserAndOrganization();
