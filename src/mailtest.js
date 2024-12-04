// You can use this to test your email client, I had problems and everything was hooked up. However I wasn't able to sign a user up.
// Looking at the code, I see that I was trying to sign up a user, but I wasn't able to do that because of the SMTP server.
// I created this tiny script to test the SMTP server.
// See options 2 https://apps.google.com/supportwidget/articlehome?hl=en&article_url=https%3A%2F%2Fsupport.google.com%2Fa%2Fanswer%2F176600%3Fhl%3Den&assistant_id=generic-unu&product_context=176600&product_name=UnuFlow&trigger_context=a
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { load } from "https://deno.land/std/dotenv/mod.ts";

import { dirname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

const env = await load({ envPath: join(__dirname, "../.env") });

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PWD,
  SMTP_FROM,
  SMTP_ADMIN_EMAIL,
} = env;

async function testSmtpConnection() {
  try {
    console.log("Creating SMTP client...");

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: Number(SMTP_PORT),
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PWD,
        },
      },
    });

    console.log("Attempting to connect and send test email...");

    await client.send({
      from: SMTP_FROM,
      to: SMTP_ADMIN_EMAIL,
      subject: "SMTP Test Email",
      content: "This is a test email to verify SMTP configuration.",
      html: "<p>This is a test email to verify SMTP configuration.</p>",
    });

    console.log("Test email sent successfully!");

    await client.close();
  } catch (error) {
    console.error("Error occurred:", error.message);
    if (error.message.includes("535")) {
      console.error("\nAuthentication failed. Please check:");
      console.error("1. Username and password are correct");
      console.error(
        "2. If using Gmail, ensure 'Less secure app access' is enabled or use App Password",
      );
      console.error(
        "3. Verify SMTP_USER matches the email address for authentication",
      );
    }
  }
}

// Run the test
console.log("Starting SMTP test...");
await testSmtpConnection();
