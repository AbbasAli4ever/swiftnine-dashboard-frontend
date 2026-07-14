# Swiftnine Dashboard

Swiftnine is a team workspace platform that combines project management, team messaging, docs, and an AI assistant in a single Next.js app. This repository is the frontend — a multi-workspace dashboard built on Next.js App Router, React 19, TypeScript, and Tailwind CSS v4.

## Features

- **Projects & Tasks** — projects, task lists, kanban-style boards, statuses, tags, time tracking, and attachments.
- **Comments & Activity** — threaded comments, an inbox of replies/assigned comments, and per-task/project activity feeds.
- **Messaging** — direct messages and channels for team communication, backed by real-time updates via Socket.IO.
- **Docs** — a rich-text document workspace built with Tiptap (tables, task lists, images, text formatting, etc.).
- **SwiftBot** — an in-app AI assistant (OpenAI-powered) with streaming responses, markdown/code rendering, and persisted conversation history.
- **University (LMS)** — a separate learning portal with a course library, video lessons (HLS streaming via video.js), progress tracking, and certificates.
- **Notifications** — in-app notification center.
- **Multi-workspace** — users can belong to multiple workspaces and switch between them (and between the main dashboard and the University portal) via `/portal-select`.
- **Auth** — sign up/sign in, email/OTP verification, forgot/reset password, and workspace invites.
- **Dark mode**, calendar view (FullCalendar), and charting (ApexCharts).

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [TanStack Query](https://tanstack.com/query) for server state, [Zustand](https://zustand-demo.pmnd.rs/) for client/UI state
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) for forms and validation
- [Tiptap](https://tiptap.dev/) for the docs rich-text editor
- [Socket.IO client](https://socket.io/) for real-time messaging/notifications
- [video.js](https://videojs.com/) + `@videojs/http-streaming` for University course video playback
- [OpenAI SDK](https://github.com/openai/openai-node) for SwiftBot

## Getting Started

### Prerequisites

- Node.js 20.x or later

### Installation

```bash
npm install
```

> Use `--legacy-peer-deps` if you hit a peer-dependency error during install.

### Environment Variables

Create a `.env.local` file in the project root with:

```bash
NEXT_PUBLIC_API_URL=              # Base URL of the Swiftnine backend API
NEXT_PUBLIC_UNIVERSITY_API_URL=   # Base URL of the University/LMS API
OPENAI_API_KEY=                   # Required for SwiftBot (kept server-only, used in src/app/api/chat)
```

### Development

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000) by default.

### Other Scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint     # run ESLint
```

## Project Structure

```
src/
  app/
    (admin)/(others-pages)/   # Main dashboard routes: projects, tasks, docs, channels, messages, chat, calendar, settings...
    (full-width-pages)/       # Auth pages, invite, portal-select, error pages
    (university)/university/  # University/LMS portal routes
    api/                      # Server route handlers (SwiftBot chat, HLS/download proxies)
  components/                 # Feature UI components (projects, chatbot, channels, dm, docs, university, ...)
  context/                    # React context providers (auth, workspace, theme, sidebar, tasks, docs...)
  stores/                     # Zustand stores (auth, workspace, channel, dm, chatbot UI, ...)
  services/                   # API client modules (one per domain, wrapping the shared axios instance)
  queries/                    # TanStack Query key factories
  hooks/                      # Shared React hooks
  layout/                     # App shell, sidebar, header
  types/                      # Shared TypeScript types
```

## Documentation

Additional integration notes and API references for specific features live in [`documentation/`](./documentation).

## License

This project is based on the [TailAdmin](https://tailadmin.com) Next.js template and is released under the MIT License — see [LICENSE](./LICENSE).
