# نظام إدارة الوثائق وعلاقات الجهات — قسم الاحتياجات (إدارة المدفعية)

> Artillery — Requirements Department · Document Management & CRM System

A production-grade, Arabic-only (RTL) web application that replaces the
department's Google-Drive-based workflow with a secure, auditable, folder-based
document management system, styled after modern government/enterprise portals
(Microsoft 365 Admin / SharePoint).

The **user interface is entirely Arabic and right-to-left**; the **codebase is
English**.

---

## Table of contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Default credentials](#default-credentials)
- [Roles & permissions](#roles--permissions)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Moving to PostgreSQL](#moving-to-postgresql)
- [Available scripts](#available-scripts)

---

## Features

- **Folder-based document management** mirroring the department's real business
  entities (الممارسات، التعاقدات، الشركات، المالية، المشروعات …), with unlimited
  nesting — familiar to employees migrating from Google Drive.
- **Document uploads** (PDF-first, plus Office formats and images) with
  **version history** and rollback.
- **Recycle bin** — soft delete with full-subtree restore; permanent deletion is
  restricted to administrators.
- **Role-based access control** layered with **per-folder permissions** that are
  inherited down the tree.
- **Complete audit trail** — every meaningful action (login, upload, delete,
  permission change …) is recorded with actor, IP and timestamp.
- **Admin console** — user management (create/edit/roles/activation) and an
  audit-log viewer.
- **Secure by design** — httpOnly signed session cookies, edge middleware
  gating, server-side authorization on every action, path-traversal-safe file
  storage served only through authorized routes.

## Technology stack

| Layer         | Choice                                             |
| ------------- | -------------------------------------------------- |
| Framework     | Next.js 14 (App Router) + React 18 + TypeScript    |
| Styling       | Tailwind CSS (RTL), Cairo Arabic web font          |
| Data access   | Prisma ORM                                         |
| Database      | SQLite (dev) → PostgreSQL (production)             |
| Auth          | Signed JWT session cookies (`jose`) + bcrypt       |
| Validation    | Zod                                                |
| Icons         | lucide-react                                       |

## Architecture

```
Browser (Arabic RTL UI)
        │
        ▼
Next.js App Router
 ├── middleware.ts ............ fast edge session gate
 ├── Server Components ........ read models via services
 ├── Server Actions ........... all mutations (auth + validation + audit)
 └── Route Handler ............ authorized document streaming
        │
        ▼
Service layer (src/lib/services)  ── folders, documents, users, trash, views
        │
        ├── authz.ts ......... role baseline + inherited folder permissions
        ├── audit.ts ......... append-only audit trail
        ├── storage.ts ....... filesystem document store (S3-swappable)
        └── prisma ........... typed data access
        │
        ▼
Database  +  ./storage (uploaded files, outside web root & VCS)
```

Key design decisions:

- **Materialized-path folder tree** (`Folder.path`) enables efficient
  breadcrumbs, subtree deletes/restores and permission inheritance without
  recursive queries.
- **Authorization is never trusted from the JWT alone** — the user is re-read
  from the database on every request so deactivations and role changes take
  effect immediately.
- **Every mutation goes through a Server Action** that authenticates, authorizes,
  validates (Zod), executes via a service, and writes an audit entry.
- **Files are never public assets** — they are streamed only through
  `/api/documents/[id]/content` after an authorization check.

## Getting started

Prerequisites: **Node.js 20+** and npm.

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env        # then set a strong AUTH_SECRET

# 3. Create the database schema
npm run db:push

# 4. Seed the admin user + core business folders
npm run db:seed

# 5. Start the development server
npm run dev
# → http://localhost:3000
```

For a production build:

```bash
npm run build
npm run start
```

## Default credentials

Created by `npm run db:seed` (configurable in `.env`). **Change the password
immediately in production.**

| Field | Value                    |
| ----- | ------------------------ |
| Email | `admin@artillery.local`  |
| Pass  | `Admin@12345`            |
| Role  | مدير النظام (ADMIN)       |

## Roles & permissions

| Role      | Arabic       | Baseline folder access                     |
| --------- | ------------ | ------------------------------------------ |
| `ADMIN`   | مدير النظام  | Full system + user management + audit      |
| `MANAGER` | مدير         | Manage all folders/documents & permissions |
| `EDITOR`  | محرِّر        | Add/edit folders & documents               |
| `VIEWER`  | مطالع        | View & download only                       |

Per-folder `FolderPermission` grants (VIEW / EDIT / MANAGE) can **elevate** a
specific user on a specific subtree; grants are inherited by descendant folders.

## Project structure

```
prisma/
  schema.prisma            # portable data model (SQLite / PostgreSQL)
  seed.ts                  # admin + core business folders
src/
  app/
    (auth)/login/          # login page + action
    (app)/                 # authenticated area (shell layout)
      page.tsx             # dashboard
      folders/             # document browser (root + [id]) + actions
      trash/               # recycle bin
      admin/users/         # user management
      admin/audit/         # audit log viewer
    api/documents/[id]/content/  # authorized file streaming
  components/
    layout/                # sidebar, top bar, app shell
    explorer/              # folder/document explorer + dialogs
    ui/                    # reusable primitives (modal, buttons, …)
  lib/
    auth/                  # password, session, current-user
    services/              # folders, documents, users, trash, views
    authz.ts, audit.ts, storage.ts, validators.ts, constants.ts, …
storage/                   # uploaded files (gitignored)
```

## Environment variables

See [`.env.example`](./.env.example). Notable values:

- `AUTH_SECRET` — 32+ char secret used to sign session tokens (**required**).
- `SESSION_MAX_AGE` — session lifetime in seconds (default 8h).
- `STORAGE_ROOT` — directory for uploaded files (default `./storage`).
- `MAX_UPLOAD_MB` — per-file upload limit (default 50).

## Moving to PostgreSQL

The schema uses no SQLite-only features. To switch:

1. In `prisma/schema.prisma`, set `datasource db { provider = "postgresql" }`.
2. Set `DATABASE_URL` to your PostgreSQL connection string.
3. Run `npm run db:push` (or `npx prisma migrate deploy` with migrations) then
   `npm run db:seed`.

## Available scripts

| Script              | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the development server             |
| `npm run build`     | Generate Prisma client + production build |
| `npm run start`     | Run the production server                |
| `npm run lint`      | ESLint                                   |
| `npm run typecheck` | TypeScript type checking                 |
| `npm run db:push`   | Sync schema to the database              |
| `npm run db:seed`   | Seed admin + core folders                |
| `npm run db:studio` | Open Prisma Studio                       |

---

© إدارة المدفعية — قسم الاحتياجات. نظام داخلي.
