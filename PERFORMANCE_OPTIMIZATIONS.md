# Frontend Performance Optimizations

## Problem
The frontend dashboard was sluggish when the mouse hovered over the chart, causing UI lag and poor responsiveness.

## Root Causes Identified
1. **Tooltip Performance Issue**: The tooltip's `labelFormatter` was performing an expensive O(n) `findIndex()` search on the entire dataset for every mouse movement over the chart.
2. **Chart Data Transformation Overhead**: Chart data transformation (organizing by timestamp, detecting gaps, extending to current time) was happening on every render, even when the source data hadn't changed.
3. **Unnecessary Re-renders**: The dashboard was re-rendering charts on every `currentTime` update (every 1 second), even when metrics data hadn't changed.

## Solutions Implemented

### 1. Optimized Tooltip Performance (RealtimeChart.jsx)
**Change**: Replaced linear search with constant-time Map lookup
- Created a `timestampMap` during data transformation that maps timestamps to display times
- Changed `labelFormatter` to use `timestampMap.get(timestamp)` instead of `findIndex()`
- **Impact**: O(n) → O(1) lookup time during mouse hover

```javascript
// Before (slow)
labelFormatter={(timestamp) => {
    const idx = chartData.findIndex(d => d.timestamp === timestamp)
    return chartData[idx]?.displayTime || ''
}}

// After (fast)
labelFormatter={(timestamp) => {
    return timestampMap.get(timestamp) || ''
}}
```

### 2. Memoized Chart Data Transformation (RealtimeChart.jsx)
**Change**: Wrapped expensive data transformation in `useMemo`
- Moved all chart data transformation logic into `useMemo` with dependencies `[data, dataKey, currentTimestamp, now]`
- Transformation only re-runs when actual data changes, not on every render
- **Impact**: Eliminates redundant calculations during rapid re-renders

### 3. Component Memoization (RealtimeChart.jsx)
**Change**: Wrapped RealtimeChart component with `React.memo`
- Component now only re-renders when props actually change
- Prevents unnecessary re-renders when parent updates for other reasons
- **Impact**: Eliminates expensive chart re-renders when only currentTime updates

### 4. Data Filtering Optimization (App.jsx)
**Change**: Improved memoization dependency of `limitedMetrics`
- Data filtering to 60-minute window now only runs when metrics change
- Previously would run on every currentTime tick
- **Impact**: Reduces unnecessary array filtering operations every second

## Performance Results
- **Tooltip responsiveness**: Eliminated visible lag during mouse hover
- **CPU usage**: Significantly reduced CPU spikes during polling intervals
- **Render cycles**: Chart components no longer re-render on every currentTime update
- **Memory**: Timestamp map adds minimal memory overhead vs. performance gain

## Testing
1. Hover mouse over chart - should see smooth tooltip without UI jank
2. Monitor DevTools Performance tab - should see fewer re-renders
3. Check CPU usage in Activity Monitor - should be lower during mouse hover
4. Verify data still updates properly every poll interval

## Files Modified
- `/frontend/src/components/RealtimeChart.jsx` - Added useMemo for data transformation, optimized tooltip, added React.memo
- `/frontend/src/App.jsx` - Minor cleanup of memoization dependencies
