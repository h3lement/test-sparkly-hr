# Supabase Setup & Management Guide for Cursor

This guide explains how to connect and manage your Supabase project from Cursor.

## Prerequisites

✅ Supabase CLI is already installed (v2.67.1)
✅ Your project is configured with project ID: `itcnukhlqkrsirrznuig`
✅ Environment variables are set up in `.env`

## 1. Environment Variables

Your project requires these environment variables in `.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

**To get these values:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the "Project URL" and "anon public" key

## 2. Connecting to Your Supabase Project

### Option A: Link to Remote Project (Recommended)

```bash
# Login to Supabase CLI
supabase login

# Link to your existing project
supabase link --project-ref itcnukhlqkrsirrznuig
```

This will:
- Connect your local project to the remote Supabase project
- Allow you to pull database schema and types
- Enable remote database management

### Option B: Run Local Supabase (Development)

```bash
# Start local Supabase instance
supabase start

# This will:
# - Start local PostgreSQL database
# - Start local Supabase services (Auth, Storage, etc.)
# - Generate local environment variables
```

**Note:** Local development requires Docker to be running.

## 3. Managing Database Schema

### Pull Latest Schema from Remote

```bash
# Pull the latest database schema
supabase db pull

# This updates your local migrations to match the remote database
```

### Generate TypeScript Types

```bash
# Generate TypeScript types from your database schema
supabase gen types typescript --linked > src/integrations/supabase/types.ts

# Or for local development:
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Create New Migrations

```bash
# Create a new migration file
supabase migration new migration_name

# Edit the generated SQL file in supabase/migrations/
```

### Apply Migrations

```bash
# Push migrations to remote database
supabase db push

# Or apply to local database
supabase migration up
```

## 4. Managing Edge Functions

Your project has many Edge Functions in `supabase/functions/`. To manage them:

### Deploy a Function

```bash
# Deploy a specific function
supabase functions deploy function-name

# Deploy all functions
supabase functions deploy
```

### Test Functions Locally

```bash
# Serve functions locally
supabase functions serve

# Test a specific function
supabase functions serve function-name
```

### View Function Logs

```bash
# View logs for a specific function
supabase functions logs function-name

# Follow logs in real-time
supabase functions logs function-name --follow
```

## 5. Database Management Commands

### Open Database Studio

```bash
# Open Supabase Studio in browser (for local)
supabase studio

# Or access remote: https://app.supabase.com/project/itcnukhlqkrsirrznuig
```

### Execute SQL Queries

```bash
# Run SQL file against remote database
supabase db execute --file path/to/query.sql

# Or use psql directly
supabase db psql
```

### Reset Database

```bash
# ⚠️ WARNING: This will delete all data!
# Reset local database
supabase db reset

# Reset remote database (use with caution)
supabase db reset --linked
```

## 6. Useful Cursor Integration Tips

### Quick Commands in Cursor Terminal

You can run any Supabase CLI command directly in Cursor's integrated terminal:

1. Open terminal: `` Ctrl+` `` (or View → Terminal)
2. Run Supabase commands as needed

### Common Workflows

**Update types after schema changes:**
```bash
supabase db pull && supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

**Deploy function changes:**
```bash
supabase functions deploy function-name
```

**Check project status:**
```bash
supabase status
```

## 7. Project-Specific Configuration

Your `supabase/config.toml` file contains:
- Project ID: `itcnukhlqkrsirrznuig`
- Edge Function JWT verification settings

**To modify function settings:**
Edit `supabase/config.toml` and update the `verify_jwt` settings for each function.

## 8. Troubleshooting

### "Access token not provided"
```bash
supabase login
```

### "No such container" error
```bash
# If using local Supabase, ensure Docker is running
supabase start
```

### Environment variables not loading
- Ensure `.env` file is in project root
- Restart the dev server after changing `.env`
- Check that variables start with `VITE_` for Vite projects

### Type generation fails
```bash
# Ensure you're linked to the project
supabase link --project-ref itcnukhlqkrsirrznuig

# Or use local if running locally
supabase gen types typescript --local
```

## 9. Quick Reference

| Task | Command |
|------|---------|
| Login | `supabase login` |
| Link project | `supabase link --project-ref itcnukhlqkrsirrznuig` |
| Pull schema | `supabase db pull` |
| Generate types | `supabase gen types typescript --linked > src/integrations/supabase/types.ts` |
| Deploy function | `supabase functions deploy function-name` |
| View logs | `supabase functions logs function-name` |
| Open Studio | `supabase studio` |
| Check status | `supabase status` |

## 10. Next Steps

1. **Login to Supabase CLI:**
   ```bash
   supabase login
   ```

2. **Link your project:**
   ```bash
   supabase link --project-ref itcnukhlqkrsirrznuig
   ```

3. **Generate/update TypeScript types:**
   ```bash
   supabase gen types typescript --linked > src/integrations/supabase/types.ts
   ```

4. **Verify connection:**
   ```bash
   supabase status
   ```

For more information, visit the [Supabase CLI Documentation](https://supabase.com/docs/reference/cli/introduction).

