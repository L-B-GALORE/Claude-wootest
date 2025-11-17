# Conversations Page - Issues Quick Reference Guide

## Critical Issues Summary (Fix These First)

### Issue #9: Race Condition - Rapid Conversation Switching
**Severity**: HIGH  
**Files**:
- `/home/user/Claude-wootest/frontend/src/pages/conversations/ConversationsPage.jsx` (Lines 23-32, 59-169)

**Problem**: WebSocket events might update wrong conversation if user switches quickly  
**Root Cause**: selectedConversationIdRef updated asynchronously via useEffect  
**Fix**: Use AbortController to cancel previous queries on conversation change

---

### Issue #15: No Handler for 'message_retried' Event
**Severity**: HIGH  
**Files**:
- Backend: `/home/user/Claude-wootest/backend/src/api/messages/retry.js` (Line 167)
- Frontend: `/home/user/Claude-wootest/frontend/src/pages/conversations/ConversationsPage.jsx` (Missing handler at lines 59-169)

**Problem**: Message retry succeeds but UI doesn't update in real-time  
**Current Behavior**: Broadcast sent but no handler = must wait for polling  
**Fix**: Add event handler similar to message_sent handler (around line 92)

```javascript
// Add this handler after message_sent handler:
const handleMessageRetried = (data) => {
  console.log('[ConversationsPage] Received message_retried event:', data);
  queryClient.invalidateQueries(['conversation', data.conversationId]);
  queryClient.invalidateQueries(['conversations']);
};

// Subscribe:
socketManager.on('message_retried', handleMessageRetried);

// Unsubscribe in cleanup:
socketManager.off('message_retried', handleMessageRetried);
```

---

### Issue #8: QueryKey Inconsistency  
**Severity**: HIGH  
**Files**:
- `/home/user/Claude-wootest/frontend/src/pages/conversations/ConversationsPage.jsx` (Lines 71, 88, 97, 105, 119, 128, 142, 147, 176, 179, 438, 439, 470, 482, 483, 771, 772)

**Problem**: Using both `['query']` and `{ queryKey: ['query'] }` formats  
**Example Inconsistencies**:
- Line 71: `queryClient.invalidateQueries(['conversations'])`
- Line 128: `queryClient.invalidateQueries({ queryKey: ['conversations'] })`

**Fix**: Use only array format consistently (React Query v4+ standard)
```javascript
// Use this everywhere:
queryClient.invalidateQueries(['conversations']);
// Not this:
queryClient.invalidateQueries({ queryKey: ['conversations'] });
```

---

### Issue #5: Aggressive Polling Stops Too Early
**Severity**: MEDIUM-HIGH  
**Files**:
- `/home/user/Claude-wootest/frontend/src/pages/conversations/ConversationsPage.jsx` (Lines 408-423)

**Problem**: Polling reverts to 5s after 30s, but Twilio updates can take >60s  
**Timeline**:
- t=0s: Message sent, polling = 2s
- t=30s: Polling reverts to 5s
- t=45s: Twilio updates status
- Gap: User sees stale status from t=30-45s

**Fix**: Continue aggressive polling until message reaches final state
```javascript
// Instead of 30s timeout, poll until status is SENT/DELIVERED/FAILED
// Check message status and disable polling when: DELIVERED, FAILED, or 2+ minutes passed
```

---

## Medium Priority Issues

### Issue #7: Message Status Initial State Wrong
**Severity**: MEDIUM  
**File**: `/home/user/Claude-wootest/backend/src/api/conversations/index.js` (Line 284)

**Problem**: Message created with `status: 'SENT'` before Twilio responds  
**Better UX**: Create with `status: 'PENDING'` until Twilio confirms

```javascript
// Line 284 - Change:
// FROM:
status: 'SENT',
// TO:
status: 'PENDING',
```

---

### Issue #13: No Connection Health Check
**Severity**: MEDIUM  
**File**: `/home/user/Claude-wootest/frontend/src/services/socket.js` (Lines 87-99)

**Problem**: WebSocket can be "open" but not delivering messages (Hibernation API issue)  
**Current**: Only checks `readyState === WebSocket.OPEN`

**Fix**: Implement heartbeat mechanism
```javascript
// Add heartbeat timeout check:
// Send heartbeat every 10s
// If no response in 5s, consider disconnected and reconnect
```

---

### Issue #10: Pagination + Real-time Updates
**Severity**: MEDIUM  
**File**: `/home/user/Claude-wootest/frontend/src/pages/conversations/ConversationsPage.jsx` (Lines 35-57)

**Problem**: New messages in conversations beyond first page don't appear until user pagination  
**Scenario**:
1. User viewing page 1 (conversations 1-20)
2. New message arrives in conversation #21
3. Event broadcasts but frontend only shows page 1
4. Conversation #21 not visible

**Fix**: Keep all cached pages valid or implement real-time pagination update

---

### Issue #3: Hibernation API Wake-up Delays
**Severity**: MEDIUM  
**File**: `/home/user/Claude-wootest/backend/src/durable-objects/CompanyRoom.js` (Line 92)

**Problem**: Durable Objects only wake when messages arrive, could cause broadcast delays  
**Current**: Uses `ctx.acceptWebSocket(server)` with hibernation

**Consider**: 
- Monitor logs for wake-up latency
- Implement explicit wake-up for server-side broadcasts
- Or implement heartbeat requirement

---

### Issue #12: Media Tokens Expire After 1 Hour
**Severity**: LOW-MEDIUM  
**File**: `/home/user/Claude-wootest/backend/src/api/messages/retry.js` (Line 124)

**Problem**: User retries message after 1 hour = token expired  
**Current**: `generateMediaToken(..., 3600)` = 1 hour validity

**Fix Options**:
1. Extend to 24 hours: `3600 * 24`
2. Regenerate tokens on-demand
3. Use permanent signed URLs instead of tokens

---

## Low Priority Issues

### Issue #1: Ref/State Sync Pattern
**Severity**: LOW  
**File**: `/home/user/Claude-wootest/frontend/src/pages/conversations/ConversationsPage.jsx` (Lines 23-32)

**Problem**: Unusual pattern using both state and ref for same value  
**Could be simplified**: Use state-only approach in event handlers via useCallback

---

### Issue #2: Duplicate URL Parameters
**Severity**: LOW  
**File**: `/home/user/Claude-wootest/frontend/src/services/socket.js` (Line 62)

**Problem**: companyId passed twice (path + query string)  
**Current**: `wss://api/ws/company/{companyId}?userId={userId}&companyId={companyId}`  
**Fix**: Remove one (either path or query)

---

### Issue #6: Message Status Initial State (Duplicate of #7)
Already covered above

---

## Data Flow - Critical Code Paths

### WebSocket Connection Establishment
```
Frontend: socketManager.connect(userId, companyId)
  ↓
socket.js:47-67
  - Build URL: wss://api/ws/company/{companyId}?userId={userId}&companyId={companyId}
  - Create WebSocket (line 75)
  - Setup listeners (line 77)
  ↓
Backend: CompanyRoom.js:74-145
  - Accept WebSocket with hibernation (line 92)
  - Store metadata (line 96)
  - Send 'connected' event
  - Broadcast 'user_joined' to others
  - Send 'presence_snapshot'
```

### Message Send Flow
```
Frontend: User clicks Send
  ↓
ConversationsPage.jsx:510
  - Call sendMessageMutation.mutate({ body, media })
  ↓
API: POST /api/v1/conversations/{id}/messages
  ↓
Backend: /api/conversations/index.js:277-349
  - Create message (status: SENT)
  - Create media records
  - Send via Twilio
  - Create smsMessage record
  - Broadcast 'message_sent' event (line 382)
  ↓
Frontend: WebSocket receives 'message_sent'
  - Call invalidateQueries (line 88)
  - Refetch conversation data
  ↓
Meanwhile: Twilio status callback
  ↓
Backend: /webhooks/status.js:302-329
  - Update message status
  - Broadcast 'message_status_updated' event
  ↓
Frontend: WebSocket receives 'message_status_updated'
  - Call refetchQueries (line 119)
  - Refetch conversation data again
```

### Inbound Message Flow
```
Twilio: Incoming SMS
  ↓
Backend: /webhooks/inbound.js:197-648
  - Find/create contact (line 277)
  - Find/create conversation (line 304)
  - Create message (line 319)
  - Create smsMessage (line 331)
  - Broadcast 'new_message' event (line 425)
  - If conversation reopened, broadcast 'conversation_reopened' (line 460)
  ↓
Frontend: WebSocket receives 'new_message'
  - Call invalidateQueries (line 83)
  - Refetch conversations and current conversation
```

---

## Testing Checklist for Fixes

### Test #1: Message Retry Updates in Real-Time
- [ ] Send message
- [ ] Wait for it to fail (or manually set to FAILED in DB)
- [ ] Click "Retry"
- [ ] UI updates immediately (NOT waiting for polling)
- [ ] Verify 'message_retried' handler is called

### Test #2: Rapid Conversation Switching
- [ ] Open conversation A
- [ ] Click conversation B immediately
- [ ] While loading B, click conversation C
- [ ] Verify correct conversation shows (C)
- [ ] No flickering or stale data visible

### Test #3: Polling Duration
- [ ] Send message
- [ ] Wait 35 seconds
- [ ] Verify polling still at 2s intervals
- [ ] Wait until message reaches DELIVERED state
- [ ] Check browser DevTools → Network for polling frequency

### Test #4: New Message in Pagination
- [ ] View conversations page 1 (first 20)
- [ ] Send inbound SMS to conversation beyond page 1
- [ ] Verify it appears in conversation list (might need to refetch)
- [ ] Verify it moves to top if it's already in view

---

## File Locations Reference

### Frontend Files
- Main component: `/home/user/Claude-wootest/frontend/src/pages/conversations/ConversationsPage.jsx`
- WebSocket service: `/home/user/Claude-wootest/frontend/src/services/socket.js`
- API service: `/home/user/Claude-wootest/frontend/src/services/api.js`

### Backend Files
- Durable Object: `/home/user/Claude-wootest/backend/src/durable-objects/CompanyRoom.js`
- Inbound webhook: `/home/user/Claude-wootest/backend/src/webhooks/inbound.js`
- Status webhook: `/home/user/Claude-wootest/backend/src/webhooks/status.js`
- Conversations API: `/home/user/Claude-wootest/backend/src/api/conversations/index.js`
- Message retry API: `/home/user/Claude-wootest/backend/src/api/messages/retry.js`

---

## Notes

1. **Aggressive Polling**: The system relies heavily on polling as fallback because developer doesn't fully trust WebSocket delivery (Hibernation API uncertainty)

2. **Multiple Event Broadcasting**: Single action (send message) triggers multiple broadcasts (message_sent + message_status_updated), causing redundant refetches

3. **Status Management**: Consider implementing Redux or Jotai for cleaner state management, current approach with scattered invalidateQueries calls is hard to trace

4. **Missing Features**:
   - No read/unread status
   - No typing indicators
   - No connection status display
   - No message search
   - No archive functionality

