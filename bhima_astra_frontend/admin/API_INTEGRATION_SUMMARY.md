# Admin Frontend API Integration Summary

## Overview
This document outlines the API integration status for the BHIMA ASTRA Admin Portal frontend pages. The implementation follows a pattern of fetching live data from backend APIs while maintaining mock data as fallback values.

## Completed Integrations

### 1. **API Utility Layer** (`admin/src/lib/adminApi.ts`)
Created a centralized API client for authenticated requests with the following features:
- JWT token management (stored in `localStorage['bhima_admin_token']`)
- Automatic Bearer token authorization headers
- Base URL configuration via environment variable `VITE_API_BASE_URL` (defaults to `http://localhost:8000`)
- Error handling with console warnings for debugging
- TypeScript interfaces for all API responses
- Graceful fallback with cascading endpoint attempts

**Key Functions:**
- `getPendingPayouts()` - GET `/api/v1/admin/payouts/pending`
- `getAllPayouts()` - GET `/api/v1/admin/claims` (payout history)
- `getPayoutLogs()` - GET `/api/v1/admin/claims` (transaction logs)
- `getAnalyticsLossRatio()` - GET `/api/v1/admin/analytics/loss-ratio` (with fallback to `/api/v1/admin/dashboard/kpis`)
- `getDashboardKpis()` - GET `/api/v1/admin/dashboard/kpis`
- `getAllFlags()` - GET `/api/v1/admin/flags`
- `getFraudAlerts()` - GET `/api/v1/admin/live/fraud-alerts`
- `verifyFlag()`, `rejectFlag()` - POST endpoints for flag actions
- `approveClaim()`, `rejectClaim()`, `releasePayout()` - Claims management

### 2. **Payouts Page** (`admin/src/pages/Payouts/PayoutsPage.jsx`)
**Status:** ✅ Complete

**Changes Made:**
- Added `useEffect` to fetch payouts on component mount
- Added `useEffect` to fetch payout logs on component mount
- Integrated with `getAllPayouts()` and `getPayoutLogs()` from adminApi
- Keeps mock data as fallback if APIs fail
- Shows loading indicator when fetching: "(loading...)" → "(live)"
- Live simulation continues to append new rows during fetch

**Data Flow:**
- Mock data initialized in state
- API call on mount replaces mock data
- If API fails, mock data persists
- Live simulation continues to append new rows
- Displays both worker payout history and system payout logs

**API Endpoints Used:**
- `GET /api/v1/admin/claims` - All claims (transformed to payout history)
- `GET /api/v1/admin/payouts/pending` - Pending payouts (future integration)

**Data Transformation:**
Claims are mapped to PayoutLog format:
```javascript
{
  claim_id: number,
  worker_id: number,
  trigger_type: string,
  claim_timestamp: string,
  payout_status: 'approved' | 'rejected' | 'paid' | 'pending',
  payout_amount: number
}
```

### 3. **Disruptions Page** (`admin/src/pages/Disruptions/DisruptionsPage.jsx`)
**Status:** ✅ Complete

**Changes Made:**
- Added `useEffect` to fetch disruption flags from `GET /api/v1/admin/flags`
- Transforms API flag data to match zoneDisruptions format
- Merges API data with existing zones (API takes priority)
- Maintains mock data fallback
- No changes to UI, routing, or animation logic

**Data Transformation:**
API flags are mapped to zoneDisruptions structure:
```javascript
{
  zone: flag.zone_id || 'Zone A',
  severity: flag.flag_status === 'verified' ? 'L2' : 'L1',
  impact: flag.flag_status === 'verified' ? 'Medium' : 'Low',
  disruption_type: flag.disruption_type,
  manager_flag: flag.payout_enabled || false,
  manager_override: false
}
```

**API Endpoints Used:**
- `GET /api/v1/admin/flags` - All admin disruption flags (✅ exists in backend)

**Backend Implementation:**
Located in `app/api/v1/admin.py`:
```python
@router.get("/flags", response_model=List[AdminFlagResponse])
def fetch_all_flags(db: Session = Depends(get_db)):
    return get_all_flags(db)
```

### 4. **Analytics Page** (`admin/src/pages/Analytics/AnalyticsPage.jsx`)
**Status:** ✅ Complete

**Changes Made:**
- Added `useEffect` to fetch analytics/loss-ratio data from API
- Updates KPI card values with API data (especially loss_ratio)
- Optionally updates series data if premium/payout volumes provided
- Mock data acts as fallback
- Implements cascading fallback: tries `/admin/analytics/loss-ratio`, then `/admin/dashboard/kpis`

**Data Integration:**
- API response updates `lossRatio` KPI card with live data
- If premium and payout volumes in response, updates latest series entry
- All calculations (profit margin, risk exposure, etc.) work with updated data
- Chart animations continue with real or mock data

**API Endpoints Used (Priority Order):**
1. `GET /api/v1/admin/analytics/loss-ratio` - ⚠️ May need creation
2. `GET /api/v1/admin/dashboard/kpis` - ✅ Fallback endpoint (exists in backend)

**Expected Response Format (Loss Ratio):**
```json
{
  "loss_ratio": 54,
  "premium_volume": 420000,
  "payout_volume": 210000,
  "fraud_rate": 0.08,
  "timestamp": "2024-..."
}
```

**Backend Implementation (KPIs):**
Located in `app/api/v1/admin_dashboard.py`:
```python
@router.get("/kpis", response_model=KPIResponse)
def fetch_kpis(db: Session = Depends(get_db)):
    return get_kpis(db)
```

## TODO: Fraud Page

### **Fraud Page** (`admin/src/pages/Fraud/AstraThinks.tsx`)
**Status:** ⏳ Not Yet Updated

**Analysis:**
This page uses complex fraud detection pipeline with components for:
- Worker card display
- Fraud scoring and graph analysis
- Decision modal with feature importance
- Injected trigger context from parent components

**Recommended Approach:**
1. The page can work with existing mock data or inject fraud alerts
2. Available endpoint: `GET /api/v1/admin/live/fraud-alerts` (exists in `admin_live.py`)
3. Could fetch fraud data on mount and inject into simulation
4. No UI changes needed - only data source integration

**Optional Integration Points:**
- Fetch fraud alerts to populate worker fraud scores
- Update decision results based on live fraud model
- Inject alert worker_id to auto-select workers with fraud holds

## Backend Endpoints Status

### ✅ Fully Implemented & Ready
- `GET /api/v1/admin/flags` - AdminFlagResponse list
- `GET /api/v1/admin/dashboard/kpis` - KPIResponse object
- `GET /api/v1/admin/dashboard/heatmap` - HeatmapZone list
- `GET /api/v1/admin/dashboard/agents` - AgentStatusResponse
- `GET /api/v1/admin/live/fraud-alerts` - FraudAlert list
- `GET /api/v1/admin/live/triggers` - TriggerEvent list
- `GET /api/v1/admin/live/recent-activity` - AuditEvent list
- `POST /api/v1/admin/verify/{flag_id}` - Verify flag
- `POST /api/v1/admin/reject/{flag_id}` - Reject flag
- `GET /api/v1/admin/claims` - ClaimResponse list
- `POST /api/v1/admin/claims/{claim_id}/approve` - Approve claim
- `POST /api/v1/admin/claims/{claim_id}/reject` - Reject claim
- `GET /api/v1/admin/payouts/pending` - Pending payouts
- `POST /api/v1/admin/payouts/{claim_id}/release` - Release payout

### ⚠️ Needs Verification / May Need Creation
- `GET /api/v1/admin/analytics/loss-ratio` - Analytics-specific loss ratio
  - Fallback: Use `GET /api/v1/admin/dashboard/kpis` instead
  - Creates a more specialized analytics endpoint if needed

### ❌ Not Currently Needed
- `/api/v1/admin/payout-logs` - Replaced by using `/admin/claims` endpoint
- Individual payout lookup endpoints - Not currently used in frontend

## Error Handling Pattern

All API functions follow this pattern:
```javascript
export const getYourData = (): Promise<Type[]> =>
  apiReq<Type[]>('/api/v1/endpoint', { headers: authHeaders() })
    .catch((err) => {
      console.warn('[adminApi] Failed to fetch:', err.message);
      return defaultValue; // Mock data or empty array
    });
```

**Cascading Fallback Pattern (for Analytics):**
```javascript
export const getAnalyticsLossRatio = (): Promise<AnalyticsData> =>
  apiReq<AnalyticsData>('/api/v1/admin/analytics/loss-ratio', {
    headers: authHeaders(),
  })
    .catch(() => apiReq<AnalyticsData>('/api/v1/admin/dashboard/kpis', ...))
    .catch(() => ({ loss_ratio: 54, ... })); // Final fallback
```

**Console Output:**
- All failures logged with `[adminApi]` prefix for debugging
- Visible in browser DevTools Console → Console tab
- Helps identify API issues during development/testing

## Environment Configuration

### Required Environment Variables
```bash
VITE_API_BASE_URL=http://localhost:8000
```

### Default Values
- Base URL: `http://localhost:8000/api/v1`
- Token storage key: `bhima_admin_token`
- Token header: `Authorization: Bearer {token}`

### Development Testing
```bash
# Terminal 1: Start backend
cd bhima_astra_backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Start frontend
cd bhima_astra_frontend/admin
npm run dev

# Check DevTools Console for API warnings
# Check Network tab to verify requests
```

## Testing Checklist

- [ ] Verify JWT token exists in localStorage before API calls
- [ ] Check all endpoints return correct data format
- [ ] Test with valid JWT token in localStorage
- [ ] Test with expired/invalid token (should use fallback)
- [ ] Verify fallback behavior when APIs are down
- [ ] Check console for warning messages with `[adminApi]` prefix
- [ ] Test loading states on slow networks
- [ ] Verify mock simulation continues during API fetch
- [ ] Check that UI doesn't break if API returns unexpected format
- [ ] Test cascading fallback (analytics tries loss-ratio, then KPIs)
- [ ] Verify payout table displays both history and logs
- [ ] Verify disruptions page merges API flags with mock zones

## Implementation Summary by Page

| Page | Status | API Call | Fallback | Notes |
|------|--------|----------|----------|-------|
| Payouts | ✅ Complete | `/admin/claims` | Mock history | Uses claims as payout logs |
| Disruptions | ✅ Complete | `/admin/flags` | Mock zones | Merges API and mock data |
| Analytics | ✅ Complete | `/admin/analytics/loss-ratio` | Mock KPIs | Cascading fallback to `/admin/dashboard/kpis` |
| Fraud | ⏳ Optional | `/admin/live/fraud-alerts` | Mock workers | No UI changes needed |

## Next Steps

1. **Test all page integrations** with backend running
2. **Verify endpoint responses** match expected TypeScript interfaces
3. **Check console for warnings** during development
4. **Optional: Create `/api/v1/admin/analytics/loss-ratio`** for more specialized analytics
5. **Optional: Integrate Fraud page** with fraud alerts endpoint
6. **Optional: Add loading states** with skeleton screens
7. **Optional: Add retry logic** with exponential backoff
8. **Optional: Cache responses** with time-to-live (TTL)

## Reference Implementation

The manager frontend (`manager/src/services/managerApi.ts`) provides an excellent reference for this pattern:
- Centralized API client
- JWT token management
- Error handling with fallback
- TypeScript interfaces for all types
- Reusable header construction
- Detailed JSDoc comments

This admin implementation follows the same best practices and patterns.

## Debugging Guide

### Common Issues & Solutions

**Issue: API returns 401 Unauthorized**
- Solution: Check if `bhima_admin_token` exists in localStorage
- Check token validity and expiration
- Verify Authorization header is being sent

**Issue: API returns 404 Not Found**
- Solution: Verify endpoint URL in adminApi.ts matches backend routes
- Check if backend router is registered in `app/main.py`
- Review backend `admin.py`, `admin_dashboard.py`, `admin_live.py`

**Issue: No data appears but no console errors**
- Solution: Check Network tab in DevTools for actual API response
- Look for `[adminApi]` warnings in console
- Verify mock fallback data is being displayed

**Issue: UI breaks with unexpected data format**
- Solution: Add type checking in components
- Check actual API response vs expected TypeScript interface
- Use optional chaining and default values

### Developer Tools Commands

```javascript
// Check token
localStorage.getItem('bhima_admin_token')

// Set token for testing (get from login first)
localStorage.setItem('bhima_admin_token', 'your-token')

// Clear all admin storage
localStorage.removeItem('bhima_admin_token')
localStorage.removeItem('bhima_admin_id')
localStorage.removeItem('bhima_admin_name')

// Test API directly
fetch('http://localhost:8000/api/v1/admin/flags', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('bhima_admin_token')}`
  }
}).then(r => r.json()).then(console.log)
```
