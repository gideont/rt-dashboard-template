# Implementation Guide

## Quick Start

### For Users
Just run the dashboard - everything works transparently:
```bash
cd frontend
npm install
npm run dev
```

Data will be cached in localStorage automatically. On page reload, you'll see your historical data.

### For Developers

## Architecture at a Glance

```
┌─────────────────────────────────────────┐
│      React Component (App.jsx)          │
├─────────────────────────────────────────┤
│                                         │
│  useState(loadMetricsFromStorage) ──┐   │
│                                     │   │
│  updateMetricsWithNewData()  ──┐    │   │
│        ↓                       │    │   │
│    mergeMetrics()     ──────┐  │    │   │
│    filterExpiredData()  ────┤  │    │   │
│    saveMetricsToStorage()   │  │    │   │
│                             │  ↓    │   │
│  useEffect (polling) ───────┘  state ──→ Charts render
│      ↓                                   │
│  fetch() → mergeWithNew()                │
│                                         │
└─────────────────────────────────────────┘
        ↓
    localStorage (buffer)
```

## Data Flow Example

### Scenario: 5-second polling interval

**Time T=0s (Page Load)**:
```javascript
1. useState(() => loadMetricsFromStorage())
   → localStorage has no data → metrics = []

2. fetch() immediately
   → API returns [{ts: 1000, temp: 20}, ..., {ts: 2000, temp: 25}] (300 points)

3. updateMetricsWithNewData([300 points])
   → mergeMetrics([], [300]) = [300]
   → filterExpiredData([300]) = [300]
   → saveMetricsToStorage([300]) → localStorage
   → Return [300]

4. Charts render with 300 points
```

**Time T=5s (First Poll)**:
```javascript
1. fetch() again
   → API returns [200-300 points] (same + new)

2. updateMetricsWithNewData([200-300])
   → mergeMetrics([300], [200-300]) = [300] (deduplicated)
   → filterExpiredData([300]) = [300]
   → saveMetricsToStorage([300])
   → Return [300]

3. Charts render - but only NEW points trigger update
   → Chart stays smooth, responsive
```

**Time T=10s (Second Poll)**:
```javascript
1. fetch() again
   → API returns [200-310 points] (same + 10 new)

2. updateMetricsWithNewData([200-310])
   → mergeMetrics([300], [200-310]) = [310] (10 new added)
   → filterExpiredData([310]) = [310]
   → saveMetricsToStorage([310])
   → Return [310]

3. Charts update with 10 new points (smooth increment)
```

**Time T=100s (Page Reload)**:
```javascript
1. useState(() => loadMetricsFromStorage())
   → localStorage has [~1200 points]
   → metrics = [~1200] (instant load!)

2. Immediately: Charts render with 1200 points
   → User sees historical data instantly

3. Then fetch() runs
   → API returns [200-1300 points]
   → Merges with [1200] → [1300]
   → Charts update smoothly
```

## Key Functions

### 1. mergeMetrics(existing, incoming)
**Purpose**: Combine two datasets without duplicates

```javascript
const merged = mergeMetrics(
    [{ts: 100}, {ts: 200}],
    [{ts: 200}, {ts: 300}]
)
// Result: [{ts: 100}, {ts: 200}, {ts: 300}]
// ✅ No duplicates, timestamp-based deduplication
```

### 2. filterExpiredData(metrics, hoursToKeep)
**Purpose**: Remove data older than N hours

```javascript
const cleaned = filterExpiredData(
    [{ts: 1000}, {ts: 2000}, {ts: 3000}],
    1  // Keep only 1 hour of data
)
// Removes timestamps older than (now - 3600s)
```

### 3. saveMetricsToStorage(metrics)
**Purpose**: Persist to browser localStorage

```javascript
saveMetricsToStorage(cleaned)
// Stores JSON in localStorage['dashboard-metrics']
```

### 4. loadMetricsFromStorage()
**Purpose**: Recover from storage on page load

```javascript
const metrics = loadMetricsFromStorage()
// Loads from localStorage, cleans old data, returns array
```

### 5. updateMetricsWithNewData(newData)
**Purpose**: Orchestrate the entire append-only flow

```javascript
updateMetricsWithNewData(json.data)
// Step 1: Merge
// Step 2: Cleanup
// Step 3: Persist
// Step 4: Update state
```

## Important Concepts

### Append-Only Pattern
❌ **Don't do this**:
```javascript
setMetrics(json.data)  // Replaces everything
```

✅ **Do this**:
```javascript
updateMetricsWithNewData(json.data)  // Merges only
```

### Deduplication by Timestamp
The key to append-only updates is using **timestamp as unique key**:

```javascript
// API might return overlapping data
const poll1 = [{ts: 100}, {ts: 200}, {ts: 300}]
const poll2 = [{ts: 250}, {ts: 300}, {ts: 350}]

// But merging with timestamp as key prevents duplicates
const merged = mergeMetrics(poll1, poll2)
// Result: [{ts: 100}, {ts: 200}, {ts: 250}, {ts: 300}, {ts: 350}]
// ✅ No duplicate at ts: 300
```

### Bounded Memory
Always clean up old data:

```javascript
// ❌ Bad - memory grows forever
setMetrics(allData)

// ✅ Good - memory bounded to 60 minutes
const cleaned = filterExpiredData(allData, 1)  // 1 hour
setMetrics(cleaned)
```

### Lazy Hydration
Initialize state from storage:

```javascript
// ❌ Starts empty, waits for fetch
const [metrics, setMetrics] = useState([])

// ✅ Starts with cached data
const [metrics, setMetrics] = useState(() => loadMetricsFromStorage())
```

## Testing

### Manual Testing

**Test 1: Data Persistence**
```
1. Open dashboard
2. Wait for some data (~20 points)
3. Press F5 (reload)
4. Expected: See data immediately (not empty)
```

**Test 2: Append-Only Behavior**
```
1. Open DevTools Console
2. Add: window.debugMetrics = true
3. Watch console logs for merge counts
4. Expected: See "Added X new points" not full count
```

**Test 3: localStorage Inspection**
```
1. Open DevTools → Application → localStorage
2. Find 'dashboard-metrics'
3. Should see JSON array of timestamps
4. After page reload, should be identical or merged
```

**Test 4: Memory Cleanup**
```
1. Run dashboard for 90 minutes
2. Check DevTools memory profiler
3. Expected: Memory stable (~constant size)
4. ❌ If memory grows, cleanup isn't working
```

**Test 5: Chart Responsiveness**
```
1. Set polling to 5 seconds (fast)
2. Hover/interact with chart
3. Expected: Smooth interaction
4. ❌ If sluggish, re-renders might be too frequent
```

## Debugging

### Check Merging
```javascript
// In browser console
localStorage.getItem('dashboard-metrics')
// Should see JSON array of data
```

### Monitor Data Flow
```javascript
// Add to dataManager.js temporarily
console.log(`Merged: ${merged.length} points, New: ${newPoints.length}`)

// Watch for logs showing incremental growth
// T=0: "Merged: 300 points, New: 0"
// T=5: "Merged: 300 points, New: 0" (duplicates removed)
// T=10: "Merged: 310 points, New: 10"
```

### Check localStorage Limits
```javascript
// In console
const data = localStorage.getItem('dashboard-metrics')
data.length / 1024 / 1024  // Size in MB
// Should be < 5MB for 60 minutes of data
```

## Troubleshooting

### Problem: Data not persisting across reload
**Solution**: Check if localStorage is enabled
```javascript
// In console
localStorage.setItem('test', 'value')
localStorage.getItem('test')  // Should return 'value'
```

### Problem: Charts still sluggish
**Solution**: Check if chart component is memoized
```javascript
// In RealtimeChart.jsx, should be:
export default memo(RealtimeChart)

// If not, add memo wrapper
```

### Problem: Memory still growing
**Solution**: Check filterExpiredData is being called
```javascript
// Add console log in filterExpiredData
console.log(`Before: ${metrics.length}, After: ${filtered.length}`)
```

### Problem: Duplicates in data
**Solution**: Verify mergeMetrics is using timestamp as key
```javascript
// Check that Map is used with timestamp
metricsMap.set(metric.timestamp, metric)  // Correct
metricsMap.set(metric.id, metric)         // Wrong
```

## Performance Tips

1. **Keep polling interval consistent**: Changes cause full re-fetches
2. **Monitor localStorage size**: Limit data to 60 minutes
3. **Use memoization**: Charts should use React.memo()
4. **Batch updates**: Avoid frequent small updates
5. **Lazy load old data**: Only fetch when needed

## Future Enhancements

Possible improvements (not required):

1. **Incremental fetch**: Only fetch data since last timestamp
   ```javascript
   const lastTimestamp = metrics[metrics.length - 1]?.timestamp
   fetch(`/api/metrics?since=${lastTimestamp}`)
   ```

2. **Data compression**: Reduce localStorage size
3. **Indexed storage**: IndexedDB for large datasets
4. **Sync state**: Redux DevTools for debugging
5. **Smart cleanup**: Archive old data instead of deleting

## Summary

The refactored data flow is:

1. **Load**: Initialize from localStorage (fast)
2. **Poll**: Fetch new data from API
3. **Merge**: Combine with existing (append-only)
4. **Clean**: Remove old data (bounded memory)
5. **Save**: Persist to localStorage
6. **Render**: Charts update from buffered state (smooth)

This pattern is simple, maintainable, and production-ready.
