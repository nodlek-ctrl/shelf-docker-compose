# Shelf.nu with Supabase Setup Guide

This guide explains how to set up Shelf.nu with Supabase using Podman completely self-hosted. The setup includes various services like database, authentication, storage, analytics, and more.

## ⚠️ Important Stability Notice

The current setup is experiencing significant stability issues due to race conditions between container startups. Containers may fail to start properly if their dependencies aren't fully initialized. To mitigate these issues:

1. Always clean up existing containers first:
```bash
podman compose down
```

2. Start the analytics service first:
```bash
podman compose up analytics -d
```

3. Then start the remaining services:
```bash
podman compose up
```

If any containers fail, you'll see errors in the logs mentioning "error graph container name". You may need to repeat this process several times to get a stable environment.

## System tested

- Fedora 40 (Workstation Edition)

## Prerequisites

- Podman installed
- podman-compose installed
- Basic understanding of containerization and PostgreSQL
- Deno for setting up `ANON` and `SERVICE_ROLE_KEY` automatically
- A working SMTP server to sign up for a user, `src/main.js` has some code for creating a user but it hasn't been tested. I used [Google Workspace](https://apps.google.com/supportwidget/articlehome?hl=en&article_url=https%3A%2F%2Fsupport.google.com%2Fa%2Fanswer%2F176600%3Fhl%3Den&assistant_id=generic-unu&product_context=176600&product_name=UnuFlow&trigger_context=a).

## Initial Setup

⚠️ Important Note: The volumes directory contains essential Supabase configuration files. Never delete the entire volumes directory. If you need to reset the database, only delete the PostgreSQL data directory using `sudo rm -rf volumes/db/data`.

1. Clone the repository and create necessary directories:
```bash
mkdir -p volumes/db/data
mkdir -p volumes/storage
mkdir -p volumes/functions
mkdir -p volumes/logs
mkdir -p volumes/api
```

## Configuration Files

### Environment Variables (.env)

1. Create the environment file:
```bash
cp .env.sample .env
```

## Generating JWT Tokens

After setting up your `.env` file, you'll need to generate the JWT tokens for Supabase authentication. This is automated using a Deno script:

1. Ensure you have set a value for `JWT_SECRET` in your `.env` file
2. Run the JWT generation script on any `JWT_SECRET` change:
```bash
deno run -A src/createjwt.js
```

This will automatically:
- Generate an `ANON_KEY` for public access
- Generate a `SERVICE_ROLE_KEY` for administrative access
- Update your `.env` file with these values

### Vector Configuration (volumes/logs/vector.yml)

The Vector service is responsible for log aggregation. Its configuration needs to be mounted with proper SELinux context (primarily for Fedora and other SELinux-enabled systems, can possibly be omitted on Ubuntu-based systems):

```yaml
- ./volumes/logs/vector.yml:/etc/vector/vector.yml:ro,z
```

The `:ro,z` flags mean:
- `ro`: Read-only access
- `z`: Proper SELinux context for sharing between container and host

### Google Cloud Configuration (volumes/gcloud.json)

Even though we're using PostgreSQL as our backend through Supabase, the analytics service (Logflare) requires a Google Cloud configuration file. We create a dummy file to satisfy this requirement:

```json
{
  "type": "service_account",
  "project_id": "dummy",
  "private_key_id": "dummy",
  "private_key": "-----BEGIN PRIVATE KEY-----\nDUMMY\n-----END PRIVATE KEY-----\n",
  "client_email": "dummy@dummy.iam.gserviceaccount.com",
  "client_id": "000000000000000000000"
}
```

## Service Configuration

### Database (Supabase PostgreSQL)

The database service requires several Supabase-specific initialization scripts:
- `realtime.sql`: Sets up the Supabase realtime schema
- `webhooks.sql`: Configures Supabase webhook functionality
- `roles.sql`: Sets up Supabase database roles and permissions
- `jwt.sql`: Configures Supabase JWT settings

### Kong API Gateway (Supabase API Gateway)

Kong serves as Supabase's API gateway and needs proper route configuration in `volumes/api/kong.yml`. It handles:
- Supabase authentication routes
- REST API routes
- Supabase realtime websocket connections
- Supabase storage endpoints

### Analytics (Supabase Analytics/Logflare)

The analytics service is configured to use Supabase's PostgreSQL instead of BigQuery:
```yaml
environment:
  POSTGRES_BACKEND_URL: postgresql://supabase_admin:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/_supabase
  POSTGRES_BACKEND_SCHEMA: _analytics
  LOGFLARE_FEATURE_FLAG_OVERRIDE: multibackend=true
```

## SELinux Considerations

The SELinux-related configurations in this guide (`:z`, `:Z`, `:ro,z` flags for volume mounts) are specific to Fedora and other SELinux-enabled systems. If you're using Ubuntu or another distribution without SELinux, you can possibly omit these flags from the volume mount configurations.

## Common Issues and Solutions

### DNS Resolution
If Kong can't resolve service names, verify the container network configuration and make sure the service names match the hostnames in Kong's configuration.

Always make sure all containers are in a healthy state and that depending containers are running without errors.

### Database Connection
If services can't connect to the Supabase database:
1. Verify the database is running
2. Check the database logs
3. Ensure proper credentials in environment variables

### Analytics Service
If the analytics service fails:
1. Verify the gcloud.json file exists
2. Ensure PostgreSQL backend configuration is correct
3. Check if all required Supabase schemas are created

### SELinux Contexts
When using Podman with SELinux (Fedora-specific):
- `:z`: Share the volume among multiple containers
- `:Z`: Private unshared volume
- Add `,ro` for read-only mounts (e.g., `:ro,z`)

## Security Considerations

- Change all default passwords and secrets in production
- Review and adjust JWT expiration times in Supabase
- Configure proper SSL/TLS in production
- Review and adjust database connection pool sizes based on load
- Implement proper backup strategies for the Supabase database and storage

## Useful Commands

```bash
# View running containers
podman ps

# View container logs
podman logs container-name

# Execute commands in containers
podman exec -it container-name command

# Reset database data only (safe to do)
sudo rm -rf volumes/db/data

# Reset everything
podman-compose down -v
```

## SMTP Configuration Testing

If you're having issues with user signups or email notifications, you can test your SMTP configuration using the provided Deno script. First, ensure your `.env` file has the following SMTP-related variables:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PWD=your-app-specific-password
SMTP_FROM=your-email@gmail.com
SMTP_ADMIN_EMAIL=admin@yourdomain.com
```

To test your SMTP configuration:

```bash
deno run -A src/test-smtp.js
```

### Troubleshooting

#### Gmail-Specific Setup

If you're using Gmail as your SMTP server:

##### Method 1

1. Disable 2-Factor Authentication if not already enabled

##### Method 2

1. Visit the Google Account settings page
2. Enable 2-Factor Authentication if not already enabled
3. Generate an App Password:
   - Go to Security → App Passwords
   - Select "Mail" and your device
   - Use the generated 16-character password as your `SMTP_PWD`

#### SMTP Issues

If you're experiencing SMTP-related problems:

1. **Authentication Failures (535 Error)**:
   - Verify `SMTP_USER` matches exactly with your email address
   - Check that `SMTP_PWD` is correct
   - For Gmail: Use App Password in case of Method 2 and regular password in case of Method 1
   - Ensure 2FA is enabled for Gmail App Password generation in case of Method 1

2. **Connection Issues**:
   - Verify `SMTP_HOST` and `SMTP_PORT` are correct
   - Try with TLS enabled/disabled
   - Ensure `SMTP_FROM` matches your authenticated email

You can use the SMTP test script to diagnose these issues. The script will provide specific error messages and suggestions for common problems. If you see "Test email sent successfully!", your SMTP configuration is working correctly.

