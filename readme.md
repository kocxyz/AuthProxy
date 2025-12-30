# KOCity Stats Watcher

Monitors the KOCity game server database for match completions and sends webhooks to MetArena and Trophy platforms.

## How It Works

1. Connects to the **game server's PostgreSQL database** (port 5434)
2. Polls the `skill` table every 5 seconds for stat changes
3. When `total_games_played` increases, a match was completed
4. Calculates win/loss, MVP status, MMR changes
5. Sends webhook events to configured endpoints
6. Checks for achievement unlocks (milestones)

## Prerequisites

- Node.js 18+ installed
- KOCity game server running (provides database on port 5434)
- AuthProxy running (optional, for authentication)

## Installation

```bash
# Navigate to the stats watcher directory
cd kocity-stats-watcher

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Copy and configure environment
copy .env.example .env
notepad .env
```

## Configuration

Edit `.env`:

```env
# Game server database (default is correct for local setup)
GAME_DB_URL="postgres://viper:viper@127.0.0.1:5434/viper"

# Webhook endpoints (optional - events are logged regardless)
METARENA_WEBHOOK="https://your-metarena.com/api/webhooks/kocity"
TROPHY_WEBHOOK="https://your-trophy.com/api/webhooks/kocity"

# Secret for signing webhooks
WEBHOOK_SECRET="your-shared-secret"
```

## Running

```bash
# Development mode (with ts-node)
npm run dev

# Or build and run
npm run build
npm start
```

## Webhook Events

### `match.completed`

Sent when a player finishes a match.

```json
{
  "event": "match.completed",
  "data": {
    "player": {
      "id": "12345",
      "username": "Esports",
      "display_name": "Esports"
    },
    "playlist": {
      "guid": "30bf6eb0-90ec0d29-4fabd3dc-01d8eaec",
      "match_flow": 0
    },
    "match": {
      "won": true,
      "mvp": false,
      "mmr_change": 25
    },
    "stats": {
      "total_wins": 10,
      "total_mvps": 3,
      "total_games": 15,
      "current_mmr": 2750,
      "win_streak": 2
    },
    "server": {
      "timestamp": "2025-12-24T00:15:30.000Z"
    }
  },
  "timestamp": "2025-12-24T00:15:30.000Z"
}
```

### `achievement.unlocked`

Sent when a player unlocks an achievement milestone.

```json
{
  "event": "achievement.unlocked",
  "data": {
    "player": {
      "id": "12345",
      "username": "Esports"
    },
    "achievement": {
      "id": "first_win",
      "name": "First Victory",
      "description": "Win your first match"
    },
    "stats": {
      "total_wins": 1,
      "total_mvps": 0,
      "total_games": 3,
      "current_mmr": 2525
    }
  },
  "timestamp": "2025-12-24T00:15:30.000Z"
}
```

## Achievement Milestones

| Category | Milestones |
|----------|------------|
| Games Played | 10, 50, 100, 500, 1000 |
| Wins | 10, 25, 50, 100, 250, 500, 1000 |
| MVPs | 1, 10, 25, 50, 100 |
| Win Streaks | 3, 5, 10, 20 |
| MMR | 3000, 3500, 4000, 4500, 5000 |

## Webhook Security

Webhooks are signed with HMAC-SHA256. Verify like this:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
    const signatureBase = `${timestamp}.${payload}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signatureBase)
        .digest('hex');
    return signature === expectedSignature;
}

// In your endpoint:
app.post('/api/webhooks/kocity', (req, res) => {
    const signature = req.headers['x-kocity-signature'];
    const timestamp = req.headers['x-kocity-timestamp'];
    
    if (!verifyWebhook(JSON.stringify(req.body), signature, timestamp, WEBHOOK_SECRET)) {
        return res.status(401).send('Invalid signature');
    }
    
    // Process webhook...
});
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Game Server    │────▶│  PostgreSQL     │
│  (port 23500)   │     │  (port 5434)    │
└─────────────────┘     └────────┬────────┘
                                 │
                                 │ Poll every 5s
                                 ▼
                        ┌─────────────────┐
                        │  Stats Watcher  │
                        │  (this service) │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │  MetArena │ │  Trophy   │ │  Console  │
            │  Webhook  │ │  Webhook  │ │  Logs     │
            └───────────┘ └───────────┘ └───────────┘
```

## Troubleshooting

### "Failed to connect to database"

Make sure the KOCity game server is running. The game server starts its own PostgreSQL instance on port 5434.

### No events showing

- Play a **complete** match (not just start one)
- The match must end with a result (win/loss)
- Check the console for any error messages

### Webhooks failing

- Verify your endpoint URLs are correct
- Check that your server is accepting POST requests
- Verify the signature validation on your end
