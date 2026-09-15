# Hanzo Marketing

Lifecycle email for an organization: audiences, drip sequences and their steps,
enrollments, campaigns, a send calendar, promos and opt-outs. Everything it does
goes through `/v1/marketing` on api.hanzo.ai, signed in with Hanzo IAM.

## Web app

The screens people use. Built on @hanzo/gui; sign-in is Hanzo IAM
(`hanzo-marketing`).

```
pnpm install
pnpm dev        # http://localhost:3320, /v1 proxied to api.hanzo.ai
pnpm build      # dist/, served by ghcr.io/hanzoai/spa
```

`src/marketing.ts` names every operation the screens call.

## Go service

`cmd/marketing` is a small HTTP service that hands campaign creation to its
engines in `internal/engine`.

```
go build ./cmd/marketing
```

`Dockerfile.service` packages it on port 8002.

## License

MIT
