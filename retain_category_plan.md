# Implementation Plan: Retain Last Selected Category

## Problem

Every time the user sends a log, `selectedCategory` is cleared (`setSelectedCategory('')` at `app.js:752`). If the user logs multiple entries under the same category (e.g., "Work"), they must re-select it each time.

## Root Cause

- `selectedCategory` initializes as `''` (`app.js:481`) — no persistence.
- `post()` success callback resets it to `''` (`app.js:752`).

## Proposed Changes

### [MODIFY] `app.js` — Persist category to localStorage

**1. Initialize `selectedCategory` from localStorage (line 481)**
```js
const [selectedCategory, setSelectedCategory] = useState(localStorage.getItem('last_category') || '');
```

**2. Save to localStorage on change**
Add a wrapper setter that persists:
```js
const setSelectedCategory = (cat) => {
  setCategory(cat);
  localStorage.setItem('last_category', cat);
};
```
Rename internal state to `category` to avoid naming collision (or use a `useEffect`).

**Simpler approach — useEffect:**
```js
const [selectedCategory, setSelectedCategory] = useState(localStorage.getItem('last_category') || '');

useEffect(() => {
  localStorage.setItem('last_category', selectedCategory || '');
}, [selectedCategory]);
```

**3. Remove the reset after send (line 752)**
Remove this line from the `post()` success callback:
```diff
  setSelectedFile(null);
  setImagePreview(null);
- setSelectedCategory('');
```

This leaves `selectedCategory` untouched after a successful send.

## Summary

| File | Change |
|------|--------|
| `app.js:481` | Load `selectedCategory` from `localStorage.getItem('last_category')` |
| `app.js` (new) | `useEffect` that saves `selectedCategory` to localStorage on change |
| `app.js:752` | Remove `setSelectedCategory('')` from post-success callback |

## Verification

1. Select a category (e.g., "Work") and tap Log.
2. Select another category (e.g., "Personal") and tap Log.
3. Refresh the page — the last selected category ("Personal") should be pre-selected.
4. Clearing the category manually (selecting "None") should also persist.

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Deleted category still selected | Low | Categories tab already handles missing values gracefully — dropdown shows whatever value is set. |
| localStorage quota exceeded | Negligible | One string value (~50 bytes) vs 5 MB quota. |

## Effort: ~10 minutes (3-line change)
