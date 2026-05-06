# Admin API Quick Reference

## Setup

### 1. Install Dependencies
```bash
cd bhima_astra_frontend/admin
npm install
```

### 2. Set Environment Variable
Create `.env.local` in `bhima_astra_frontend/admin/`:
```
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Get JWT Token
Login via admin portal → token saved to `localStorage['bhima_admin_token']`

---

## Import API Functions

```javascript
import { 
  getAllPayouts, 
  getPayoutLogs,
  getAllFlags,
  getAnalyticsLossRatio,
  getFraudAlerts,
  verifyFlag,
  rejectFlag 
} from '../../lib/adminApi'
```

---

## Common API Calls

### Fetch Payouts & Logs
```javascript
useEffect(() => {
  const fetchData = async () => {
    try {
      const payouts = await getAllPayouts()
      const logs = await getPayoutLogs()
      setPayoutHistory(payouts)
      setPayoutLogs(logs)
    } catch (error) {
      console.warn('Failed to fetch payouts:', error)
      // Mock data fallback automatic
    }
  }
  fetchData()
}, [])
```

### Fetch Flags
```javascript
useEffect(() => {
  const fetchFlags = async () => {
    try {
      const data = await getAllFlags()
      // Transform and set state
    } catch (error) {
      console.warn('Failed to fetch flags:', error)
    }
  }
  fetchFlags()
}, [])
```

### Fetch Analytics
```javascript
useEffect(() => {
  const fetchAnalytics = async () => {
    try {
      const data = await getAnalyticsLossRatio()
      setKpis(prev => ({
        ...prev,
        lossRatio: { 
          value: data.loss_ratio || 54,
          delta: prev.lossRatio.delta
        }
      }))
    } catch (error) {
      console.warn('Failed to fetch analytics:', error)
    }
  }
  fetchAnalytics()
}, [])
```

### Verify/Reject Flag
```javascript
const handleVerifyFlag = async (flagId) => {
  try {
    const result = await verifyFlag(flagId)
    console.log('Flag verified:', result)
    // Refetch flags or update state
  } catch (error) {
    console.warn('Failed to verify flag:', error)
  }
}

const handleRejectFlag = async (flagId) => {
  try {
    const result = await rejectFlag(flagId)
    console.log('Flag rejected:', result)
  } catch (error) {
    console.warn('Failed to reject flag:', error)
  }
}
```

---

## API Endpoints Reference

| Function | Endpoint | Method | Used In |
|----------|----------|--------|---------|
| `getAllPayouts()` | `/api/v1/admin/claims` | GET | Payouts Page |
| `getPayoutLogs()` | `/api/v1/admin/claims` | GET | Payouts Page |
| `getAllFlags()` | `/api/v1/admin/flags` | GET | Disruptions Page |
| `verifyFlag(id)` | `/api/v1/admin/verify/{id}` | POST | Disruptions Page |
| `rejectFlag(id)` | `/api/v1/admin/reject/{id}` | POST | Disruptions Page |
| `getAnalyticsLossRatio()` | `/api/v1/admin/analytics/loss-ratio` | GET | Analytics Page |
| `getDashboardKpis()` | `/api/v1/admin/dashboard/kpis` | GET | Analytics Page |
| `getFraudAlerts()` | `/api/v1/admin/live/fraud-alerts` | GET | Optional |

---

## Error Handling Pattern

All API functions automatically:
1. Include JWT token from localStorage
2. Add `Authorization: Bearer {token}` header
3. Catch errors and log to console with `[adminApi]` prefix
4. Return fallback/default value on error
5. Never throw exceptions to components

**Console Output:**
```
[adminApi] Failed to fetch payouts: Network error
[adminApi] Failed to fetch flags: 401 Unauthorized
```

---

## Testing Locally

### Start Backend
```bash
cd bhima_astra_backend
python -m uvicorn app.main:app --reload --port 8000
```

### Start Frontend
```bash
cd bhima_astra_frontend/admin
npm run dev
```

### Check API Status
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for `[adminApi]` messages
4. Go to Network tab to see requests/responses

---

## Debugging

### Test Token
```javascript
// In console:
localStorage.getItem('bhima_admin_token')
```

### Test API Directly
```javascript
// In console:
fetch('http://localhost:8000/api/v1/admin/flags', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('bhima_admin_token')}`
  }
})
.then(r => r.json())
.then(console.log)
```

### Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Invalid/missing token | Login again, check localStorage |
| 404 Not Found | Wrong endpoint | Check adminApi.ts URL matches backend |
| Network error | Backend not running | Start backend on port 8000 |
| No data displayed | API failed silently | Check console for `[adminApi]` warnings |
| CORS error | Origin mismatch | Check VITE_API_BASE_URL env var |

---

## File Locations

- **API Functions:** `admin/src/lib/adminApi.ts`
- **Payouts Page:** `admin/src/pages/Payouts/PayoutsPage.jsx`
- **Disruptions Page:** `admin/src/pages/Disruptions/DisruptionsPage.jsx`
- **Analytics Page:** `admin/src/pages/Analytics/AnalyticsPage.jsx`
- **Backend Admin Routes:** `backend/app/api/v1/admin*.py`

---

## TypeScript Interfaces

### PayoutRecord
```typescript
{
  claim_id: number
  worker_id: number
  payout_amount: number
  payout_status: string
  payout_timestamp?: string
}
```

### AdminFlag
```typescript
{
  flag_id: number
  manager_id: number
  zone_id: string
  disruption_type: string
  flag_status: string
  payout_enabled: boolean
  created_at: string
}
```

### AnalyticsData
```typescript
{
  loss_ratio?: number
  premium_volume?: number
  payout_volume?: number
  fraud_rate?: number
  timestamp?: string
}
```

---

## Best Practices

✅ **DO:**
- Always add try/catch around API calls
- Check console for `[adminApi]` warnings
- Test with backend running
- Use mock data as fallback
- Keep useEffect dependencies minimal
- Add loading states if needed

❌ **DON'T:**
- Hardcode API URLs (use env var)
- Bypass error handling
- Assume token exists without checking
- Modify auth headers manually
- Call APIs outside useEffect/event handlers
- Ignore console warnings

---

## Quick Checklist

Before committing code:
- [ ] JWT token stored in localStorage
- [ ] Environment variable set: `VITE_API_BASE_URL`
- [ ] Backend running on port 8000
- [ ] No TypeScript errors
- [ ] Console shows no `[adminApi]` errors
- [ ] Mock data displays if API fails
- [ ] UI doesn't break with unexpected data

---

## Resources

- Full Details: See `API_INTEGRATION_SUMMARY.md`
- Manager Reference: `manager/src/services/managerApi.ts`
- Backend Routes: `backend/app/api/v1/admin*.py`
