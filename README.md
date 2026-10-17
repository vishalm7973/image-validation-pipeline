# Image Validation

A full-stack image upload and validation app: React + TypeScript frontend, Express REST API, PostgreSQL/Prisma metadata, Redis + BullMQ asynchronous processing, local durable image storage, HEIC conversion, blur/size/duplicate checks, and face detection with BlazeFace. Docker Compose runs PostgreSQL, Redis, API, worker, and frontend.

## Run with Docker (recommended)

Requirements: Docker Engine and Docker Compose v2.

```bash
docker compose up --build
```

Open http://localhost:5173. API health: http://localhost:4000/api/health. Compose runs Prisma migrations before starting the API. First build may take a while because TensorFlow's Node runtime is a native dependency.

Stop with `Ctrl+C`; `docker compose down` keeps data. To remove database, Redis and uploaded files too, use `docker compose down -v`.

## Run services locally

Requirements: Node.js 20+ and Docker Compose.

```bash
cp .env.example backend/.env
docker compose up -d postgres redis
npm install
npm --prefix backend install
npm --prefix frontend install
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:5173. If your local environment has issues installing `@tensorflow/tfjs-node`, use Docker Compose, which builds the same native dependency in Linux.

## What it does

- Client-side accepts only JPEG/JPG, PNG, and HEIC/HEIF extensions/MIME types. Server checks file signatures and decodes the image independently.
- Upload endpoint immediately records a `PENDING` image, enqueues a BullMQ job, and returns `202`; frontend polls until `ACCEPTED` or `REJECTED`.
- Worker converts HEIC to JPEG, validates dimensions, calculates a Laplacian-variance blur score, computes a 64-bit average perceptual hash and compares it to prior uploads, and runs face detection. Exactly one face is required and its bounding-box area must meet a configurable minimum.
- Images are served through a controlled API route; uploaded filenames are replaced with UUIDs. File size and accepted formats are limited.
- Metadata and validation results are persisted in PostgreSQL. Redis backs the durable queue.
- The default storage backend is a persistent Docker volume (`uploads_data`). S3-compatible storage credentials are documented in `.env.example` for future adapter implementation; this build intentionally uses local persistent storage so it works without cloud credentials. BlazeFace model weights are fetched by TensorFlow.js on first face-detection use, so the worker needs outbound network access on first run.

## API

- `GET /api/health`
- `POST /api/images` (multipart field `image`)
- `GET /api/images?status=ACCEPTED|REJECTED|PENDING|PROCESSING|FAILED`
- `GET /api/images/:id`
- `GET /api/images/:id/file`
- `DELETE /api/images/:id`

## Validation configuration

Set `MIN_WIDTH`, `MIN_HEIGHT`, `BLUR_THRESHOLD`, `MIN_FACE_RATIO`, and `PHASH_DISTANCE_THRESHOLD`. Blur thresholds vary by image size and content; tune against a representative sample set. Near-duplicate matching uses a average hash and Hamming distance, not semantic image similarity. Face detection quality is model-dependent.

## QA checklist

1. Upload a valid clear portrait with one face.
2. Upload a tiny image; expect a resolution rejection.
3. Upload a blurry image; expect a blur rejection (threshold is configurable).
4. Upload a portrait with multiple faces; expect rejection.
5. Upload the same or resized/recompressed image; expect duplicate rejection if pHash distance is within threshold.
6. Upload a PNG and HEIC file; confirm processing and HEIC conversion.
7. Try a PDF or renamed non-image file; browser and server should reject it.
8. Check a pending job transitions to a final state and refresh the page; records should persist.
9. Delete an image and confirm metadata and stored file are removed.

## Honest limitations / production follow-ups

This is a challenge-sized MVP, not a production identity-verification service. Local volume storage is used by default instead of S3; production should use private S3 objects and short-lived signed URLs. Add authentication/authorization, rate limiting, malware scanning, stricter per-user quotas, lifecycle cleanup, observability, and durable failure/dead-letter handling before public deployment. The face-size ratio and blur threshold should be tuned on real test images.
