# Implementation Plan: Configurable Telegram Notifications

## Goal Description

Add a Google Sheets configuration parameter (`ENABLE_NOTIFICATIONS`) that controls whether the bot sends a Telegram reply (random thought or "Message received" fallback) after each logged message. When disabled, the backend still processes and stores the log normally — it simply skips the Telegram `sendText` step.

**Why:** Eliminates notification noise during bulk logging or quiet hours without changing code or redeploying.

---

## User Review Required

> [!IMPORTANT]
> **Default value**: `ENABLE_NOTIFICATIONS` defaults to `true` when the config key is missing or empty — existing behavior is preserved for anyone who hasn't added the key yet.

> [!NOTE]
> **Scope**: This toggle only gates the *post-log Telegram reply* (the random thought / "Message received" message). It does **not** affect:
> - Drive file saves (photos, documents)
> - Markdown note appends
> - Messages sheet row logging
> - Telegram webhook inbound processing (messages from Telegram still trigger `handleLog` as before)

---

## Open Questions

> [!NOTE]
> None. The change is a single binary toggle with backward-compatible defaults.

---

## Proposed Changes

### Backend: `code.gs`

#### [MODIFY] `handleLog()` — wrap the notification block (lines 432–437)

**Before:**
```javascript
  let randomThought = getRandomThought()
  if (randomThought) {
    sendText(strBotToken, chatId, randomThought)
  } else {
    sendText(strBotToken, chatId, `Message received: ${TimeStamp()}`)
  }
```

**After:**
```javascript
  const notificationsEnabled = getConfig("ENABLE_NOTIFICATIONS")
  if (notificationsEnabled && !["false", "no", "0", "off"].includes(String(notificationsEnabled).toLowerCase())) {
    let randomThought = getRandomThought()
    if (randomThought) {
      sendText(strBotToken, chatId, randomThought)
    } else {
      sendText(strBotToken, chatId, `Message received: ${TimeStamp()}`)
    }
  }
```

**Design rationale:**
- `getConfig("ENABLE_NOTIFICATIONS")` reuses the existing config lookup — no new infrastructure.
- Truthy check rejects common falsy strings (`false`, `no`, `0`, `off`, case-insensitive).
- Empty/missing key → `getConfig` returns `""` → `!["false", …].includes("")` is `true` → notifications stay **enabled** (backward compatible).
- Any non-falsy value (`true`, `yes`, `1`, `on`, or anything else) → notifications **enabled**.

### Google Sheets: BOT sheet

Add a new row to the existing `BOT` configuration sheet:

| Column A (Key) | Column B (Value) |
|---------------|-----------------|
| `ENABLE_NOTIFICATIONS` | `true` (or `false` to disable) |

No other sheet changes required.

---

## Verification Plan

### 1. Notifications Enabled (default behavior preserved)
- Set `ENABLE_NOTIFICATIONS` = `true` (or leave the key absent entirely).
- Submit a log message via the Web App or Telegram.
- **Expected**: Backend processes the log normally AND sends a Telegram reply (random thought or fallback).

### 2. Notifications Disabled
- Set `ENABLE_NOTIFICATIONS` = `false` in the BOT sheet.
- Submit a log message.
- **Expected**:
  - ✅ Log row appears in the Messages sheet.
  - ✅ Markdown note appended to daily file in Drive.
  - ✅ Photos/files saved to Drive (if attached).
  - ❌ **No** Telegram message sent back.

### 3. Case-insensitive toggle values
Test each value to confirm correct behavior:

| Value | Expected |
|-------|----------|
| (key absent) | Enabled (backward compatible) |
| `true` | Enabled |
| `yes` | Enabled |
| `1` | Enabled |
| `false` | Disabled |
| `False` | Disabled |
| `FALSE` | Disabled |
| `no` | Disabled |
| `0` | Disabled |
| `off` | Disabled |
| `anything-else` | Enabled |

### 4. Telegram inbound messages
- Send a message directly to the bot on Telegram.
- **Expected**: Same toggle behavior — when disabled, the bot processes the message silently without replying.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Typo in config value breaks notifications | Low | Truthy default + permissive matching on disable values |
| `getConfig` throws on missing key | Low | Existing `getConfig` returns `""` for missing keys — safe |
| GAS cache delays config change | Low | GAS reads sheet live; may take up to 60s to reflect changes |

**Rollback:** Remove the `if` guard in `handleLog()` and revert to the original unconditional `sendText` block. One-line undo.
