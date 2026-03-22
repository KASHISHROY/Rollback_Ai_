## Setup
```bash
# Install dependencies in each folder
cd proxy && npm install
cd ../backend-stable && npm install
cd ../backend-test && npm install
```

## Running the System

Start in 3 separate terminals:

**Terminal 1 - Proxy**
```bash
cd proxy
npm start
```
Runs on port 4000

**Terminal 2 - Stable Backend**
```bash
cd backend-stable
npm start
```
Runs on port 5001 (0% failure rate)

**Terminal 3 - Test Backend**
```bash
cd backend-test
npm start
```
Runs on port 5002 (40% failure rate)

## Testing

### Test 1: Check System Status
```bash
curl http://127.0.0.1:4000/api/stats
```

### Test 2: Make Requests (Stable Mode)
```bash
for i in {1..5}; do
  curl http://127.0.0.1:4000/api
  sleep 0.2
done
```

### Test 3: View Logs
```bash
curl http://127.0.0.1:4000/api/logs
```

### Test 4: Trigger Auto-Rollback
1. Edit `proxy/config.json`: change `"mode": "stable"` to `"mode": "test"`
2. Make 50 requests:
```bash
for i in {1..50}; do
  curl http://127.0.0.1:4000/api 2>/dev/null
  sleep 0.1
done
```
3. Watch Terminal 1 for auto-rollback message
4. Check config was auto-updated: `curl http://127.0.0.1:4000/api/config`

### Test 5: Check Rollback History
```bash
curl http://127.0.0.1:4000/api/rollback-history
```

## Configuration

Edit `proxy/config.json`:
```json
{
  "mode": "stable",           // stable, test, or canary
  "stable_url": "http://127.0.0.1:5001",
  "test_url": "http://127.0.0.1:5002",
  "canary_percent": 10        // % of traffic to test in canary mode
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stats | Current error rate and metrics |
| GET | /api/logs | Today's request logs |
| GET | /api/config | Current configuration |
| POST | /api/config | Change mode (send `{"mode":"stable"}`) |
| GET | /api/health | System health status |
| GET | /api/rollback-history | Past rollback events |
| POST | /api/rollback | Manual rollback trigger |
| POST | /api/reset-stats | Reset statistics |

## Modes

**Stable** - All traffic to production backend (port 5001)
**Test** - All traffic to test backend (port 5002, 40% failures)
**Canary** - 90% to stable, 10% to test (configurable percentage)

## Auto-Rollback

System automatically switches to stable mode when error rate exceeds 20%.

Threshold can be changed in `proxy/server.js`:
```javascript
const autoRollback = new AutoRollback(20);  // Change 20 to desired threshold
## Features

- Real-time error rate tracking (last 100 requests)
- Automatic failover when errors exceed threshold
- JSON-based request logging with daily rotation
- RESTful API for monitoring and control
- Professional logging with [INFO], [ERROR], [SUCCESS], [ALERT] tags

## Files

- `proxy/server.js` - Main proxy server
- `proxy/enhanced-logger.js` - Request logging system
- `proxy/error-tracker.js` - Error rate tracking
- `proxy/auto-rollback.js` - Automatic failover logic
- `proxy/config.json` - Configuration file
- `backend-stable/server.js` - Stable backend
- `backend-test/server.js` - Test backend