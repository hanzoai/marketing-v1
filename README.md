<p align="center"><img src=".github/hero.svg" alt="marketing" width="880"></p>

# Hanzo Marketing

AI-powered marketing automation platform with genetic algorithm optimization.

> **The GTM engine's canonical home is Hanzo Cloud — `clients/marketing` in
> `hanzoai/cloud`.** The go-to-market subsystems (campaigns, email drip
> sequences on the embedded tasks engine, audiences, the launch promo, the
> content calendar, and the per-org suppression/opt-out gate) run natively in
> the unified cloud binary at `/v1/marketing`, org-scoped and pure Go. This repo
> is the **content system** — the strategy, promo spec, playbook, curriculum,
> ads, and analyses below — which stays here as data the engine acts on. The
> Python service and Go scaffold here are the historical prototype; new engine
> work lands in cloud.

## Features

### 🧬 Genetic Algorithm Optimization
- Multi-platform budget allocation
- Bid strategy optimization
- Audience targeting optimization
- A/B test variant exploration

### 📊 ML/AI Intelligence
- **Forecasting**: Time-series predictions for metrics (Prophet)
- **Pattern Detection**: Audience segmentation, conversion path analysis
- **Content Generation**: AI-powered ad copy, emails, social posts (via LLM)
- **Anomaly Detection**: Automatic alert on metric deviations

### 📣 Ad Platform Integrations
- Meta (Facebook/Instagram)
- Google Ads
- TikTok Ads
- Twitter/X
- LinkedIn
- Programmatic (coming soon)

### 💬 Communication Channels
- Email (SendGrid)
- SMS (Twilio)
- Social media automation
- Live chat integration

## Quick Start

```bash
# Install dependencies
uv sync

# Run development server
uv run python -m marketing.api

# Or use the CLI
uv run marketing
```

## Docker

```bash
# Build
docker build -t hanzo-marketing .

# Run
docker run -p 8001:8001 \
  -e MARKETING_ROUTER_URL=http://router:4000/v1 \
  -e MARKETING_DATASTORE_URL=http://datastore:8123 \
  hanzo-marketing
```

## API Endpoints

### Optimization
- `POST /api/v1/optimize/budget` - Optimize budget across platforms

### Forecasting
- `POST /api/v1/forecast` - Forecast a metric
- `GET /api/v1/forecast/anomalies` - Detect anomalies

### Patterns
- `GET /api/v1/patterns/segments` - Audience segmentation
- `GET /api/v1/patterns/high-value` - High-value user patterns
- `GET /api/v1/patterns/conversion-paths` - Conversion path analysis
- `GET /api/v1/patterns/fatigue/{campaign_id}` - Creative fatigue detection

### Content Generation
- `POST /api/v1/generate/ad-copy` - Generate ad copy variants
- `POST /api/v1/generate/social` - Generate social posts

### Channels
- `POST /api/v1/channels/email/send` - Send email
- `POST /api/v1/channels/sms/send` - Send SMS
- `POST /api/v1/channels/social/post` - Post to social

## Environment Variables

```bash
# Hanzo Stack
MARKETING_ROUTER_URL=http://router:4000/v1
MARKETING_ROUTER_API_KEY=sk-router-master-hanzo
MARKETING_DATASTORE_URL=http://datastore:8123
MARKETING_REDIS_URL=redis://:hanzo123@redis:6379
MARKETING_NATS_URL=nats://nats:4222

# Ad Platforms
MARKETING_META_ACCESS_TOKEN=...
MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN=...
MARKETING_TIKTOK_ACCESS_TOKEN=...

# Communication
MARKETING_SENDGRID_API_KEY=...
MARKETING_TWILIO_ACCOUNT_SID=...
MARKETING_TWILIO_AUTH_TOKEN=...

# Social
MARKETING_TWITTER_API_KEY=...
MARKETING_LINKEDIN_CLIENT_ID=...
```

## Architecture

```
marketing/
├── src/marketing/
│   ├── core/           # Config, models
│   ├── optimizer/      # Genetic algorithm
│   ├── ml/             # Forecasting, patterns, generation
│   ├── platforms/      # Ad platform integrations
│   ├── channels/       # Email, SMS, social
│   └── api.py          # FastAPI service
├── tests/
├── Dockerfile
└── pyproject.toml
```

## Go-to-Market content

Alongside the automation service, this repo holds the GTM content system — the
strategy, promo spec, playbook, and the machine-readable founder curriculum the
`/v1/guide` engine consumes. **Governing rule: every number is measured-and-sourced
or clearly labeled a target — nothing invented.**

| Path | What it is |
|---|---|
| `GTM.md` | 4-phase plan (waitlist → paid+promo → node expansion → OSS flywheel); each phase has entry/exit gates and a kill criterion. |
| `discounts.md` | Launch promo spec vs. the real plans: eligibility, stacking, abuse guards, revenue math. |
| `GUIDE.md` | The Guide&trade; 2.0 — the classic direct-response agency playbook rebuilt on Hanzo tooling. |
| `CHECKLIST.md` | Human rendering **and schema docs** for the founder curriculum. |
| `checklist.yaml` | Machine-readable curriculum — the contract the `/v1/guide` engine consumes. IDs are stable + kebab-case. |
| `tools/validate_checklist.py` | Validates `checklist.yaml` against the contract (ids, fields, DAG). Run: `python3 tools/validate_checklist.py`. |
| `analysis/` | Templates + filled what-worked analyses (cohort, channel, CAC/LTV) reading from `/v1/analytics`. |
| `ads/` | Concept briefs, honest-claims-only. |

The curriculum schema is documented in `CHECKLIST.md` → **Schema**.

## License

MIT
