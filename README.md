# Dashcam Integrity Verification System

Cloud-based dashcam fingerprinting and integrity verification system, composed of two independent React/Vite applications sharing one Supabase PostgreSQL backend:

- **Encoder** – captures camera frames, generates SHA-256 fingerprints and a hash chain, and sends them to the cloud.
- **Decoder** – retrieves sessions from the cloud and verifies fingerprint integrity and continuity.

This guide covers only how to install and run the project on a new machine.

---

## 1. Prerequisites

- Node.js (tested with 24.21.0)
- npm (tested with 11.19.0)
- Git
- A modern web browser
- A device with a camera (for the Encoder)
- A Supabase account and project

```bash
node --version
npm --version
git --version
```

---

## 2. Clone and Install

```bash
git clone https://github.com/enzowtacla/dashcam.git
cd dashcam

cd encoder && npm ci && cd ..
cd decoder && npm ci && cd ..
```

---

## 3. Configure Supabase

Open the **Supabase SQL Editor** and run:

```sql
CREATE TABLE public.fingerprints (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL,
  sequence_number integer NOT NULL,
  timestamp timestamptz NOT NULL,
  hash text NOT NULL,
  chain_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  driver_id text
);

ALTER TABLE public.fingerprints ENABLE ROW LEVEL SECURITY;

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
---

## 4. Configure Environment Variables

Both applications must use the same Supabase project.

```bash
cp encoder/.env.example encoder/.env
cp decoder/.env.example decoder/.env
```

Edit `encoder/.env` and `decoder/.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Both values are in the Supabase project settings.

---

## 5. Run

Use two terminals.

**Encoder**

```bash
cd encoder
npm run dev
```

Open the URL printed by Vite and allow camera access. Enter a Driver ID, start the camera, then start recording.

**Decoder**

```bash
cd decoder
npm run dev
```

Open the URL printed by Vite, enter the same Driver ID used in the Encoder, and select a session to verify it.
