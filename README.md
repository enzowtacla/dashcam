# Dashcam Integrity Verification System

This report describes the steps required to install the development environment, configure the required tools and dependencies, and run the application.

The project is composed of two independent React/Vite applications (`encoder/` and `decoder/`) that share a single Supabase project.

---

## 1. Install the Development Environment

### 1.1 Prerequisites

- Node.js (tested with 24.21.0)
- npm (tested with 11.19.0)
- Git
- Web browser
- A device with a camera
- A Supabase account and project

Verify the installation:

```bash
node --version
npm --version
git --version
```

### 1.2 Clone the Repository

```bash
git clone https://github.com/enzowtacla/dashcam.git
cd FinalProject
```

### 1.3 Install Dependencies

```bash
cd encoder
npm ci
cd ../decoder
npm ci
cd ..
```

---

## 2. Configure the Tools and Dependencies

### 2.1 Environment Variables

Both applications must point to the same Supabase project.

```bash
cd encoder
cp .env.example .env
cd ../decoder
cp .env.example .env
cd ..
```

Edit `encoder/.env` and `decoder/.env` with the values from the Supabase project settings:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### 2.2 Supabase Database

In the **Supabase SQL Editor**, run:

```sql
CREATE TABLE public.fingerprints (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL,
  sequence_number integer NOT NULL,
  timestamp timestamptz NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  driver_id text,
  frame_path text
);

ALTER TABLE public.fingerprints
ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encoder_can_insert_fingerprints"
ON public.fingerprints
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon read fingerprints"
ON public.fingerprints
FOR SELECT
TO anon
USING (true);
```

### 2.3 Supabase Storage

Create a Storage bucket named `dashcam-frames`, then run:

```sql
CREATE POLICY "Allow anon upload dashcam frames"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'dashcam-frames');

CREATE POLICY "Allow anon read dashcam frames"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'dashcam-frames');
```

> The anonymous policies above are intended for the academic MVP only.

### 2.4 Automatic Data Retention (Edge Function + Cron)

Frames and fingerprints are retained for 10 minutes and removed automatically.

**Create the Edge Function** named `cleanup-expired-frames` in the Supabase Dashboard with the following `index.ts`, then deploy it:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const RETENTION_MINUTES = 10
const BUCKET_NAME = 'dashcam-frames'

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')

    if (!supabaseUrl || !secretKeysRaw) {
      throw new Error('Supabase environment variables are missing.')
    }

    const secretKeys = JSON.parse(secretKeysRaw)

    const supabase = createClient(
      supabaseUrl,
      secretKeys.default,
    )

    const expirationDate = new Date(
      Date.now() - RETENTION_MINUTES * 60 * 1000,
    ).toISOString()

    const { data: expiredFrames, error: selectError } =
      await supabase
        .from('fingerprints')
        .select('id, frame_path, timestamp')
        .lt('timestamp', expirationDate)
        .not('frame_path', 'is', null)

    if (selectError) {
      throw selectError
    }

    if (!expiredFrames || expiredFrames.length === 0) {
      return Response.json({
        success: true,
        message: 'No expired frames found.',
        deletedFrames: 0,
      })
    }

    const framePaths = expiredFrames
      .map((frame) => frame.frame_path)
      .filter(
        (path): path is string =>
          typeof path === 'string' &&
          path.length > 0,
      )

    if (framePaths.length > 0) {
      const { error: storageError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .remove(framePaths)

      if (storageError) {
        throw storageError
      }
    }

    const expiredIds = expiredFrames.map(
      (frame) => frame.id,
    )

    const { error: deleteError } =
      await supabase
        .from('fingerprints')
        .delete()
        .in('id', expiredIds)

    if (deleteError) {
      throw deleteError
    }

    return Response.json({
      success: true,
      retentionMinutes: RETENTION_MINUTES,
      deletedFrames: expiredFrames.length,
      deletedFiles: framePaths.length,
    })
  } catch (error) {
    console.error('Cleanup failed:', error)

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown cleanup error',
      },
      {
        status: 500,
      },
    )
  }
})
```

**Grant the function's database permissions:**

```sql
GRANT SELECT, DELETE
ON TABLE public.fingerprints
TO service_role;
```

**Schedule it with Supabase Cron:**

```text
Job name: cleanup-expired-dashcam-frames
Type: Supabase Edge Function
Method: POST
Edge Function: cleanup-expired-frames
Schedule: * * * * *
```

- The `pg_net` extension must be enabled in the Supabase project.
- JWT verification for `cleanup-expired-frames` is disabled in the current MVP so the Cron invocation can reach the function.

---

## 3. Run the Application

The Encoder and Decoder run independently. Use two terminals.

**Encoder:**

```bash
cd encoder
npm run dev
```

**Decoder:**

```bash
cd decoder
npm run dev
```

Open the URL printed by Vite for each application in a modern browser. Vite picks an available port automatically, so both can run at the same time. The browser must be allowed to access the device camera to use the Encoder.
