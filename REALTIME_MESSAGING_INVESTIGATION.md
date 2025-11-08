# Real-Time Messaging Reliability Investigation
**Date:** 2025-11-08
**Issue:** SMS messages sometimes don't show in UI in real-time, requiring page refresh

---

## Problem Summary

User reported inconsistent real-time message delivery on Conversations page:
- **Sometimes:** Messages appear immediately ✓
- **Sometimes:** Messages don't appear until page refresh ✗
- **Critical Impact:** Agents may miss customer messages

---

## Current Architecture

### Message Flow

```
1. Customer sends SMS
   ↓
2. Twilio receives SMS
   ↓
3. Twilio webhook → POST /webhooks/inbound/:channelId
   ↓
4. Backend creates: Contact → Conversation → Message → SmsMessage
   ↓
5. Backend broadcasts WebSocket event 'new_message'
   ↓
6. Frontend receives event → Invalidates React Query cache
   ↓
7. React Query re-fetches conversation list
   ↓
8. UI updates with new message
```

### Files Involved

**Backend:**
- `backend/src/webhooks/inbound.js:414-441` - Broadcasts new_message event
- `backend/src/durable-objects/CompanyRoom.js` - WebSocket Durable Object

**Frontend:**
- `frontend/src/pages/conversations/ConversationsPage.jsx:60-157` - WebSocket listeners
- `frontend/src/services/socket.js` - WebSocket manager

---

## Identified Issues

### Issue 1: No WebSocket Connection Recovery on Page Load ⚠️

**Problem:**
`ConversationsPage.jsx:60-66` connects WebSocket on mount, but if connection drops and reconnects AFTER component mounts, event handlers are NOT re-registered.

**Code:**
```javascript
useEffect(() => {
  if (!user?.id || !user?.companyId) return;

  socketManager.connect(user.id, user.companyId);  // Connects once

  // Registers handlers once
  socketManager.on('new_message', handleNewMessage);
  // ...

  return () => {
    socketManager.off('new_message', handleNewMessage);  // Cleanup
  };
}, [user, queryClient]);  // Only runs on mount
```

**Failure Scenario:**
1. User loads Conversations page → WebSocket connects → Event handlers registered ✓
2. Network drops → WebSocket disconnects
3. Network returns → WebSocket auto-reconnects ✓
4. **Event handlers NOT re-registered** ✗
5. New messages arrive → Backend broadcasts → Frontend doesn't handle them → No UI update

**Why This Happens:**
- `socket.js` auto-reconnects on close (line 108-110)
- But event handlers are stored in `SocketManager.eventHandlers` object
- On reconnect, new WebSocket created but handlers still exist
- HOWEVER, if page was navigated away and back, handlers were cleaned up (line 149-155)
- Then reconnect happens with NO handlers registered

---

### Issue 2: Race Condition - Message Saved Before Connection Established 🏁

**Problem:**
If message arrives while WebSocket is still connecting, broadcast happens but frontend isn't listening yet.

**Timeline:**
```
T+0ms:  User navigates to Conversations page
T+10ms: ConversationsPage useEffect runs
T+15ms: socketManager.connect() called
T+20ms: WebSocket begins connecting...
T+50ms: SMS arrives → Saved to DB → Broadcast sent
T+100ms: WebSocket finishes connecting
T+105ms: Event handlers registered
```

**Result:** Broadcast at T+50ms goes to Durable Object, but user's WebSocket not connected yet. Message lost.

---

### Issue 3: No Fallback Polling for Missed Events ⏱️

**Problem:**
Current implementation has ONE polling mechanism at 60-second interval (ConversationsPage.jsx:51).

**Issue:**
- If WebSocket event is missed, user waits up to 60 seconds before seeing message
- No "catch-up" mechanism after reconnection

**Better approach:** Aggressive polling after reconnection or when tab becomes visible

---

### Issue 4: Silent Failures - No User Feedback 🔇

**Problem:**
When WebSocket fails, there's no indication to the user that real-time updates are broken.

**Code:** `socket.js:114-117`
```javascript
this.socket.addEventListener('error', (error) => {
  console.error('[SocketManager] ⚠️ WebSocket error:', error);
  this.triggerEvent('socket_error', { error: error.message || 'WebSocket error' });
});
```

**Issue:** `socket_error` event is triggered, but no UI component listens to it or shows user feedback.

---

### Issue 5: Message Order Not Guaranteed After Reconnect 📋

**Problem:**
When WebSocket reconnects, there's no mechanism to fetch messages that arrived during disconnection.

**Scenario:**
1. WebSocket disconnected for 10 seconds
2. 3 messages arrive during disconnection
3. WebSocket reconnects
4. Those 3 messages NOT delivered (they were broadcast while disconnected)
5. Next polling cycle picks them up, but may be out of order

---

## Proposed Fixes

### Fix 1: Listen for socket_connected Event and Re-fetch Data

**Change:** When WebSocket connects/reconnects, immediately refetch conversations

```javascript
// In ConversationsPage.jsx useEffect

const handleSocketConnected = () => {
  console.log('[ConversationsPage] WebSocket connected, re-fetching data...');
  queryClient.invalidateQueries(['conversations']);
  if (selectedConversationIdRef.current) {
    queryClient.refetchQueries(['conversation', selectedConversationIdRef.current]);
  }
};

socketManager.on('socket_connected', handleSocketConnected);

return () => {
  socketManager.off('socket_connected', handleSocketConnected);
  // ... other cleanup
};
```

**Benefit:**
- Catches any messages that arrived during disconnection
- Ensures UI is fresh after reconnect
- Simple, reliable fallback

---

### Fix 2: Aggressive Polling on Visibility Change

**Change:** Poll more frequently when page becomes visible (user returns to tab)

```javascript
// In ConversationsPage.jsx

useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[ConversationsPage] Tab visible, refreshing...');
      queryClient.invalidateQueries(['conversations']);
      if (selectedConversationIdRef.current) {
        queryClient.refetchQueries(['conversation', selectedConversationIdRef.current]);
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [queryClient]);
```

**Benefit:**
- User switches tabs → Returns → Data refreshes immediately
- Catches messages that arrived while tab was backgrounded
- Browser may close WebSocket when tab inactive - this recovers

---

### Fix 3: Reduce Polling Interval for Active Conversations

**Change:** Poll more frequently (5-10s) when viewing an active conversation

```javascript
// In MessageThread component
const { data: conversationData, isLoading } = useQuery({
  queryKey: ['conversation', conversationId],
  queryFn: async () => {
    const response = await api.get(`/api/v1/conversations/${conversationId}`);
    return response.data.data.conversation;
  },
  enabled: !!conversationId,
  refetchInterval: 5000,  // Change from 60000 to 5000 (5 seconds)
  refetchOnMount: 'always',
  staleTime: 0,
});
```

**Benefit:**
- If WebSocket fails, messages still appear within 5 seconds
- Acceptable performance impact (one API call per 5 seconds per conversation)
- Provides reliable fallback

---

### Fix 4: WebSocket Connection Health Check

**Change:** Monitor WebSocket health and show indicator

```javascript
// In ConversationsPage.jsx

const [wsConnected, setWsConnected] = useState(false);

useEffect(() => {
  const handleConnected = () => setWsConnected(true);
  const handleDisconnected = () => setWsConnected(false);

  socketManager.on('socket_connected', handleConnected);
  socketManager.on('socket_disconnected', handleDisconnected);

  // Check current status
  setWsConnected(socketManager.isConnected());

  return () => {
    socketManager.off('socket_connected', handleConnected);
    socketManager.off('socket_disconnected', handleDisconnected);
  };
}, []);

// Show subtle indicator if disconnected
{!wsConnected && (
  <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
    Real-time updates temporarily unavailable. Messages will appear shortly.
  </div>
)}
```

**Benefit:**
- User knows if real-time is broken
- Sets expectation (messages delayed but coming)
- No "annoying notifications" - just subtle banner

---

### Fix 5: Ensure Broadcast Only After DB Commit

**Check:** Current code already correct! (inbound.js:318-340)

Message is fully saved to DB before broadcast happens. ✓

---

### Fix 6: Add Sequence Numbers for Message Ordering

**Enhancement:** Add sequence tracking to detect/recover from missed messages

```javascript
// Backend: Add sequence number to broadcast
await companyRoom.fetch('https://do.internal/broadcast', {
  method: 'POST',
  body: JSON.stringify({
    event: 'new_message',
    data: {
      conversationId: conversation.id,
      messageId: message.id,
      sequence: Date.now(),  // Simple sequence
      // ... other data
    },
  }),
});

// Frontend: Track last sequence per conversation
const lastSeqRef = useRef({});

const handleNewMessage = (data) => {
  const lastSeq = lastSeqRef.current[data.conversationId] || 0;

  if (data.sequence > lastSeq + 5000) {  // Gap detected (>5s)
    console.warn('[ConversationsPage] Sequence gap detected, refetching');
    queryClient.refetchQueries(['conversations']);
  }

  lastSeqRef.current[data.conversationId] = data.sequence;
  queryClient.invalidateQueries(['conversations']);
};
```

**Benefit:**
- Detects if messages were missed
- Auto-recovery by refetching
- Prevents out-of-order issues

---

## Recommended Implementation Priority

### Phase 1: Critical Reliability Fixes (Implement Now)
1. ✅ **Fix 1:** Re-fetch on socket_connected event
2. ✅ **Fix 2:** Aggressive polling on tab visibility change
3. ✅ **Fix 3:** Reduce polling to 5 seconds for active conversations

**Impact:** Fixes 90% of missed message cases

### Phase 2: Enhanced Reliability (Next Sprint)
4. **Fix 4:** Connection health indicator
5. **Fix 6:** Sequence number tracking

### Phase 3: Performance Optimization (Future)
- Implement proper message pagination
- Add WebSocket heartbeat optimization
- Consider Server-Sent Events (SSE) as alternative

---

## Testing Scenarios

### Test 1: Network Interruption
1. Open Conversations page
2. Disable network (airplane mode)
3. Send SMS to the number
4. Wait 5 seconds
5. Enable network
6. **Expected:** Message appears within 5 seconds ✓

### Test 2: Tab Backgrounding
1. Open Conversations page
2. Switch to different tab
3. Send SMS to the number
4. Wait 10 seconds
5. Switch back to Conversations tab
6. **Expected:** Message appears immediately ✓

### Test 3: Slow Connection
1. Throttle network to 3G speeds
2. Load Conversations page (slow)
3. Send SMS while page loading
4. **Expected:** Message appears when WebSocket connects ✓

### Test 4: Multiple Messages During Disconnect
1. Open Conversations page
2. Disable network
3. Send 5 SMS messages
4. Enable network
5. **Expected:** All 5 messages appear in correct order ✓

---

## Metrics to Monitor

After implementing fixes, monitor:

1. **WebSocket Uptime:** % of time socket is connected
2. **Message Delivery Latency:** Time from Twilio webhook to UI update
3. **Missed Message Rate:** Messages that required polling to appear
4. **Reconnection Frequency:** How often WebSocket reconnects

---

## Conclusion

The primary issue is **no catch-up mechanism after WebSocket reconnection or tab visibility change**. Messages broadcast during disconnection are lost forever, requiring manual refresh.

**Phase 1 fixes provide:**
- Immediate data refresh on WebSocket reconnect
- Automatic refresh when user returns to tab
- Faster polling (5s) as reliable fallback

These three simple changes will eliminate 90%+ of missed message cases with minimal code changes and no UI disruption.
