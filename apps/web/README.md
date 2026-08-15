# Akiba Web (React Router v8)

This workspace is a TypeScript React frontend powered by Vite and React Router v8.

## Scripts

```bash
pnpm dev       # Start dev server
pnpm build     # Type-check and production build
pnpm preview   # Preview production build
pnpm lint      # Run ESLint
pnpm typecheck # Run TypeScript checks only
```

## API Configuration

The frontend expects the NestJS API to be available at:

```text
http://localhost:4000/api
```

You can override this with an environment variable:

```bash
VITE_API_BASE_URL=http://localhost:4000/api
```
