# Multi-Tenant Customer Service Platform - Master Plan

**Last Updated**: 2025-10-25
**Status**: Backend authentication complete, frontend and features pending

---

## Vision Overview

A multi-tenant SaaS application where companies can manage customer service communications across multiple channels (initially voice/SMS via Twilio, expanding to email, WhatsApp, Facebook Messenger). The platform provides unified inbox management, intelligent call routing, and team collaboration features.

### Core Principles

1. **Multi-tenant isolation** - Every company's data is completely separated
2. **Modular architecture** - Features are self-contained and extensible
3. **Reusable components** - UI and logic shared between similar features
4. **Future-proof design** - Easy to add new channels, routing strategies, and features
5. **Minimal refactoring** - Build right the first time to avoid breaking changes

---

## Current Status

### ✅ Completed (Phase 0)

- **Backend Infrastructure**
  - Cloudflare Workers API deployed at `https://customer-service-platform-api.lilboo.workers.dev`
  - Neon Postgres database connected via Prisma
  - GitHub Actions auto-deployment configured
  - JWT authentication system (access + refresh tokens)
  - User registration endpoint working
  - User login endpoint working
  - Complete database schema with 19+ models

- **Database Schema**
  - Multi-tenant structure (Company, User, UserRole)
  - Provider abstraction (Twilio, Plivo, Gmail, Outlook, etc.)
  - Channel management (Voice, SMS, Email, WhatsApp, Facebook)
  - Inbox system with member assignments
  - Private line assignments for users
  - Routing strategies framework (RING_ALL, ROUND_ROBIN, etc.)
  - Conversation and message handling
  - User preferences (cell phone opt-in/out)
  - Company settings (force cell ringing, etc.)
  - Activity logging

### ❌ Not Built Yet

- Frontend (React application)
- Provider integration (Twilio connection)
- Inbox management UI and backend
- Call handling and routing
- Real-time WebSocket features
- All channel-specific features

---

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers (Hono framework)
- **Database**: Neon Serverless Postgres
- **ORM**: Prisma with driver adapters
- **Authentication**: JWT (15min access, 7-day refresh)
- **Real-time**: Cloudflare Durable Objects (Socket.IO over WebSocket)
- **Storage**: Cloudflare R2 (call recordings, attachments)
- **Cache**: Cloudflare KV (sessions, presence)

### Frontend (Planned)
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context + hooks (Zustand for complex state)
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors
- **WebSocket**: Socket.IO (for real-time features)
- **UI Components**: Custom components (not a heavy library)
- **Themes**: Light/Dark mode support

### Deployment
- **Backend**: Cloudflare Workers (auto-deploy via GitHub Actions)
- **Frontend**: Cloudflare Pages (auto-deploy via GitHub Actions)
- **Database**: Neon (serverless Postgres)

---

## User Roles & Permissions

### Role Hierarchy

1. **OWNER** (highest level)
   - Full access to everything
   - Can manage company settings
   - Can add/remove admins and agents
   - Can delete company
   - Can manage billing (future)

2. **ADMIN** (middle level)
   - Can manage inboxes
   - Can assign phone numbers
   - Can invite/remove agents
   - Can view all conversations
   - Cannot modify company settings
   - Cannot remove owners/admins

3. **AGENT** (base level)
   - Can access assigned inboxes only
   - Can handle calls/messages in those inboxes
   - Can use private line (if assigned)
   - Cannot manage users or settings
   - Cannot view unassigned conversations

### Permissions Framework (Future)

The database supports future granular permissions via:
- `UserPreference` model for user-level settings
- `CompanySetting` model for company-wide policies
- Role-based checks in middleware
- Future: Add `Permission` and `RolePermission` tables for fine-grained control

**For now**: Simple role checks (OWNER > ADMIN > AGENT)

**Later**: Granular permissions like:
- `inbox.view`, `inbox.manage`, `call.answer`, `settings.billing`, etc.

---

## Core Features Breakdown

### 1. Authentication & User Management

**Status**: ✅ Backend done, ❌ Frontend pending

**Backend Features**:
- Company registration (auto-creates owner user)
- User login with email/password
- JWT token generation and refresh
- Password hashing with bcrypt
- Token rotation on refresh

**Frontend Features** (to build):
- Registration page (company name, user name, email, password)
- Login page (email, password, remember me)
- Logout functionality
- Token refresh interceptor
- Protected routes
- Password strength indicator
- Form validation

**Future Enhancements**:
- Email verification
- Password reset flow
- Two-factor authentication
- OAuth (Google, Microsoft)

---

### 2. Company Settings

**Status**: ❌ Not started

**Features**:
- Company profile (name, logo, timezone)
- Force cell phone ringing (on/off)
  - If ON: All users must have cell phones ring
  - If OFF: Users can opt-in/opt-out individually
- Business hours (future)
- Notification preferences (future)
- Branding customization (future)

**Database**:
- `CompanySetting` table with key-value JSON storage
- Example: `{ key: "force_cell_ringing", value: { enabled: true } }`

---

### 3. User Invitation & Management

**Status**: ❌ Not started

**Features**:
- Invite users by email (Owner/Admin only)
- Assign roles during invitation
- User list with search/filter
- Edit user details (name, role, cell phone)
- Delete/deactivate users
- User profile page

**Database**:
- `User` table with role field
- `cellPhone` field for mobile number
- `UserPreference` for individual settings

**User Preferences**:
- `cell_phone_enabled`: true/false (can be overridden by company setting)
- `desktop_notifications`: true/false
- `theme`: "light" / "dark"

---

### 4. Provider Management (Twilio)

**Status**: ❌ Not started

**User provides ONLY**: Account SID + Auth Token
**App handles EVERYTHING else automatically**

#### Auto-Provisioning Flow

When a company connects their Twilio account:

1. **User Input** (only these 2 fields):
   - Account SID
   - Auth Token

2. **App Validates Credentials**:
   - Make test API call to Twilio
   - Verify credentials are valid
   - Store encrypted credentials

3. **App Auto-Provisions Resources** (user doesn't do anything):
   - Creates TwiML App in user's Twilio account via API
   - Generates REST API Key (for server-to-server calls)
   - Generates Access Token API Key (for browser SDK)
   - Configures webhook URLs automatically
   - Stores all SIDs and encrypted secrets

4. **App Fetches Phone Numbers**:
   - Retrieves all phone numbers from Twilio account
   - Displays them in UI for user to "import"

5. **User Imports Numbers**:
   - User clicks "Import" on numbers they want to use
   - App creates Channel records
   - Numbers are now available for inbox/private line assignment

#### What Gets Stored

**Provider Table**:
```json
{
  "id": "uuid",
  "companyId": "uuid",
  "type": "TWILIO",
  "credentials": "encrypted_json",  // Encrypted: { accountSid, authToken, restApiKeySid, restApiKeySecret, accessTokenKeySid, accessTokenKeySecret, twimlAppSid }
  "status": "ACTIVE",
  "createdAt": "timestamp"
}
```

**TwiML App Details** (stored in credentials JSON):
- `twimlAppSid`: Created automatically
- `restApiKeySid`: For server API calls (SMS, validation, etc.)
- `restApiKeySecret`: Encrypted secret
- `accessTokenKeySid`: For generating browser tokens
- `accessTokenKeySecret`: Encrypted secret
- `voiceUrl`: Auto-configured to our webhook
- `statusCallback`: Auto-configured
- `smsUrl`: Auto-configured

**Why TWO API Keys?**
- **REST API Key**: For backend operations (send SMS, update numbers, etc.)
- **Access Token Key**: For generating browser SDK tokens (voice calls)
- Separation allows independent key rotation and follows security best practices

#### Backend Endpoints (to build)

**Provider Connection**:
- `POST /api/v1/providers` - Connect provider
  - Input: `{ accountSid, authToken }`
  - Process:
    1. Validate credentials
    2. Auto-provision TwiML app + API keys
    3. Store encrypted credentials
    4. Return provider ID
  - Output: `{ providerId, status }`

**Phone Number Fetching**:
- `GET /api/v1/providers/:id/available-numbers` - Fetch from Twilio
  - Calls Twilio API to get all numbers
  - Returns: `[{ sid, phoneNumber, friendlyName, capabilities }]`

**Phone Number Importing**:
- `POST /api/v1/providers/:id/import-number` - Import into our system
  - Input: `{ numberSid }`
  - Process:
    1. Verify number exists in Twilio account
    2. Create Channel record
    3. Configure webhooks on Twilio number (voice + SMS)
  - Output: `{ channelId }`

**Provider Management**:
- `GET /api/v1/providers` - List all providers
- `GET /api/v1/providers/:id` - Get provider details
- `DELETE /api/v1/providers/:id` - Disconnect provider

#### Reference Implementation

See `/reference-prototype/api/index.js`:
- `autoProvision()` function (lines 402-443)
- `POST /api/setup/voice/complete` (lines 783-887)
- `getTwilioRestClient()` (lines 455-497)

#### Important Notes

- **User NEVER configures anything in Twilio dashboard**
- **App handles ALL webhook configuration via API**
- **API Keys are preferred over Auth Token** (security best practice)
- **All secrets are encrypted** before storing in database
- **Credentials are scoped per company** (multi-tenant)

---

### 5. Channel Management (Phone Numbers)

**Status**: ❌ Not started

**Features**:
- Import phone numbers from Twilio
- Display all available channels
- Assign channel to inbox OR user (private line)
- Unassign channels
- View channel capabilities (voice, SMS, or both)

**Database**:
- `Channel` table
  - `type`: VOICE | SMS
  - `identifier`: Phone number (e.g., +14155551234)
  - `capabilities`: JSON array `["voice", "sms"]`
- `InboxChannel` - Junction table (channel assigned to inbox)
- `PrivateChannel` - Direct assignment (channel assigned to user)

**Business Rules**:
- A channel can be assigned to EITHER:
  - One inbox (multiple users), OR
  - One user (private line)
- A channel CANNOT be in both an inbox and a private line simultaneously
- When assigning to inbox, remove any private assignment (and vice versa)

**Backend Endpoints** (to build):
- `GET /api/v1/channels` - List all channels
- `POST /api/v1/channels/:id/assign-inbox` - Assign to inbox
- `POST /api/v1/channels/:id/assign-private` - Assign to user
- `DELETE /api/v1/channels/:id/assign` - Unassign

---

### 6. Inbox Management

**Status**: ❌ Not started

**Features**:
- Create inbox with name and description
- Edit inbox details
- Delete inbox
- Assign phone numbers to inbox
- Assign users (agents) to inbox
- View inbox members
- Configure routing strategy per inbox

**Database**:
- `Inbox` table (name, description)
- `InboxChannel` - Which phone numbers go to this inbox
- `InboxMember` - Which users have access to this inbox
- `RoutingStrategy` - How calls are distributed for each inbox

#### Complete Inbox Flow

**1. Owner/Admin Creates Inbox**:
```
POST /api/v1/inboxes
{ name: "Customer Service", description: "Main support line" }
→ Creates inbox with ID
```

**2. Assign Phone Numbers to Inbox**:
```
POST /api/v1/inboxes/{inboxId}/channels
{ channelId: "uuid-of-phone-number" }
→ Links phone number to inbox
→ Configures Twilio webhook to point to our app
```

**3. Assign Users to Inbox**:
```
POST /api/v1/inboxes/{inboxId}/members
{ userId: "uuid-of-agent" }
→ Grants user access to this inbox
→ User can now see conversations for numbers in this inbox
```

**4. Configure Routing Strategy**:
```
PUT /api/v1/inboxes/{inboxId}/routing
{ strategyType: "RING_ALL", config: { ringCellPhones: true } }
→ Determines how incoming calls are handled
```

#### Conversation Access Control

**CRITICAL RULE**: Users can ONLY access conversations for inboxes they're assigned to.

**Backend Query Logic**:
```javascript
// Get conversations for current user
function getUserConversations(userId) {
  // 1. Find all inboxes this user is a member of
  const userInboxes = await InboxMember.findAll({ where: { userId } })
  const inboxIds = userInboxes.map(m => m.inboxId)

  // 2. Find all channels assigned to those inboxes
  const inboxChannels = await InboxChannel.findAll({ where: { inboxId: inboxIds } })
  const channelIds = inboxChannels.map(c => c.channelId)

  // 3. Return conversations ONLY for those channels
  return await Conversation.findAll({ where: { channelId: channelIds, companyId } })
}
```

**Access Control Middleware**:
- Every conversation endpoint checks: Is user assigned to the inbox that owns this conversation's channel?
- If NOT assigned: Return 403 Forbidden
- If assigned: Allow access

**Example**:
- Inbox A has phone number +1-555-0001
- Inbox B has phone number +1-555-0002
- Agent 1 is assigned to Inbox A only
- Agent 2 is assigned to Inbox B only
- Call comes in to +1-555-0001
- Result: Only Agent 1 can see/access this conversation

#### Multiple Phone Numbers Per Inbox

**Supported**: One inbox can have multiple phone numbers assigned.

**Example**:
- Inbox: "Sales Team"
- Phone Numbers:
  - +1-555-1000 (Main sales line)
  - +1-555-1001 (West coast line)
  - +1-555-1002 (East coast line)
- All 3 numbers route to the same inbox
- All assigned agents can answer calls/messages from any of these numbers

#### Backend Endpoints (to build)

**Inbox CRUD**:
- `POST /api/v1/inboxes` - Create inbox
- `GET /api/v1/inboxes` - List inboxes (only ones user has access to)
- `GET /api/v1/inboxes/:id` - Get inbox details
- `PUT /api/v1/inboxes/:id` - Update inbox
- `DELETE /api/v1/inboxes/:id` - Delete inbox

**Channel Assignment**:
- `POST /api/v1/inboxes/:id/channels` - Assign phone number to inbox
  - Removes from private line if was assigned there
  - Configures Twilio webhook
- `DELETE /api/v1/inboxes/:id/channels/:channelId` - Remove phone number
- `GET /api/v1/inboxes/:id/channels` - List assigned phone numbers

**User Assignment**:
- `POST /api/v1/inboxes/:id/members` - Add user to inbox
- `DELETE /api/v1/inboxes/:id/members/:userId` - Remove user
- `GET /api/v1/inboxes/:id/members` - List inbox members

**Frontend UI**:
- Inbox list page
- Create inbox modal
- Inbox detail page with:
  - Assigned phone numbers (with Add/Remove buttons)
  - Assigned users (with Add/Remove buttons)
  - Routing strategy configuration
  - Recent conversations count

---

### 7. Call Routing Strategies

**Status**: ❌ Not started (Phase 1 only implements RING_ALL)

**Phase 1 Strategy: RING_ALL**

When a call comes to an inbox phone number:
1. Check which users are assigned to that inbox (`InboxMember`)
2. Ring ALL assigned users simultaneously:
   - If user is **logged in** (browser connected): Ring browser
   - If user **opted-in** to cell ringing: Ring cell phone too
   - If user is **not logged in**: Only ring cell phone (if opted-in)
3. Whoever answers first gets the call
4. Other rings are cancelled

**Cell Phone Ringing Logic**:
- Check `CompanySetting.force_cell_ringing`:
  - If `true`: Ignore user preference, ring all cells
  - If `false`: Check `UserPreference.cell_phone_enabled`
    - If `true`: Ring cell
    - If `false`: Don't ring cell

**Database**:
- `RoutingStrategy` table
  - `inboxId`: Which inbox this applies to
  - `channelType`: VOICE (different strategies for SMS)
  - `strategyType`: RING_ALL
  - `config`: JSON `{ ringCellPhones: true }`

**Future Strategies** (Phase 2+):
- `ROUND_ROBIN`: Distribute calls evenly across agents
- `PRIORITY_QUEUE`: Route to available agent with highest priority
- `NOTIFY_ALL`: Don't ring, just notify (for SMS/chat)

**Backend Endpoints** (to build):
- `GET /api/v1/inboxes/:id/routing` - Get routing strategy
- `PUT /api/v1/inboxes/:id/routing` - Update routing strategy

**Implementation Notes**:
- Each routing strategy should be a separate module/file
- Strategy selector picks the right module based on `strategyType`
- Easy to add new strategies without modifying existing code
- Example structure:
  ```
  /backend/src/routing-strategies/
    ├── ring-all.js
    ├── round-robin.js (future)
    ├── priority-queue.js (future)
    └── index.js (strategy selector)
  ```

---

### 8. Private Lines

**Status**: ❌ Not started

**Features**:
- Owner/Admin can assign a phone number to a specific user
- User sees "Private Line" in their interface
- Calls to private line only ring that user (not shared)
- User can make outbound calls from private line
- Private line badge/indicator in UI

**Database**:
- `PrivateChannel` table (userId, channelId)
- Unique constraint: One user per channel, one channel per user

**Backend Endpoints** (to build):
- `POST /api/v1/users/:id/private-line` - Assign private line
- `DELETE /api/v1/users/:id/private-line` - Remove private line
- `GET /api/v1/me/private-line` - Get my private line

**Frontend UI**:
- User profile page shows assigned private line
- Phone UI shows "Private Line: +14155551234"
- Badge/indicator when receiving call to private line vs inbox

---

### 9. Call Handling (Voice)

**Status**: ❌ Not started - **HIGHEST PRIORITY FEATURE**

This is the core functionality that makes the app useful.

#### 9.1 Incoming Call Flow

**Browser Call (User Logged In)**:
1. Incoming call arrives at Twilio number
2. Twilio webhook hits `/api/v1/webhooks/twilio/voice-incoming`
3. Backend determines routing:
   - Is it a private line? → Ring that user only
   - Is it an inbox? → Get routing strategy, ring assigned users
4. Backend emits Socket.IO events to notify connected browsers
5. Browser(s) receive "incoming_call" event via Socket.IO
6. IncomingCall UI component renders
7. User clicks "Accept" or "Reject"
8. On accept: Twilio connects call to browser via WebRTC

**Cell Phone Call (User Not Logged In or Opted-In)**:
1. Same flow as above, but Twilio also dials user's cell phone
2. Uses TwiML `<Dial>` with multiple `<Number>` elements
3. Whoever picks up first gets the call

**Shared Call UI Component**:
- `<IncomingCallCard />` shows:
  - Caller ID (phone number or contact name)
  - Which line is ringing:
    - "Private Line" badge, OR
    - "Customer Service Inbox" badge (inbox name)
  - Accept button
  - Reject button
  - Timer (ringing duration)

#### 9.2 Outbound Call Flow

**User-Initiated Call**:
1. User enters phone number in dial pad
2. Selects which line to call from:
   - Private line (if assigned)
   - Inbox line (if has access to any)
3. Frontend requests access token from backend
4. Backend generates Twilio access token
5. Browser initiates WebRTC call via Twilio SDK
6. Call connects

**Shared Call UI Component**:
- `<ActiveCallCard />` shows:
  - Contact name or number
  - Call duration timer
  - Mute button
  - Hold button (future)
  - Hang up button
  - Dialpad button (for DTMF tones)
  - Transfer button (future)

#### 9.3 Call State Management

**States**:
- `idle` - No call
- `ringing` - Incoming call, not answered yet
- `connecting` - Outbound call, dialing
- `active` - Call in progress
- `ended` - Call finished (show for 2 seconds, then back to idle)

**Reusable Call Manager**:
```
/frontend/src/features/calls/
  ├── CallManager.jsx (manages state, Socket.IO, Twilio SDK)
  ├── IncomingCallCard.jsx (UI for incoming)
  ├── ActiveCallCard.jsx (UI for active call)
  ├── DialPad.jsx (number entry + DTMF)
  └── useCall.js (React hook for call operations)
```

**Usage**:
- Private Line page uses `<CallManager lineType="private" />`
- Inbox page uses `<CallManager lineType="inbox" inboxId={id} />`
- Both share the same call handling logic and UI

#### 9.4 Database Records

Every call creates:
1. `Contact` record (if new caller)
2. `Conversation` record (type: TRANSACTIONAL)
3. `Message` record (body: "Call from...")
4. `VoiceCall` record (duration, recording, status)

**Backend Endpoints** (to build):
- `POST /api/v1/calls/token` - Get Twilio access token
- `POST /api/v1/calls/dial` - Initiate outbound call
- `POST /api/v1/webhooks/twilio/voice-incoming` - Incoming call webhook
- `POST /api/v1/webhooks/twilio/call-status` - Call status updates

---

### 10. Real-Time Features (Socket.IO)

**Status**: ⚠️ Code exists (Durable Objects), not connected

**Features**:
- Incoming call notifications
- Call status updates (answered, ended)
- User presence (online/offline)
- Typing indicators (future - for SMS/chat)
- New message notifications (future)

**Architecture**:
- One Durable Object (CompanyRoom) per company
- All users in a company connect to the same room
- Socket.IO connection with JWT authentication
- Connection URL: `wss://customer-service-platform-api.lilboo.workers.dev`

**Frontend Socket.IO Client**:
```javascript
// /frontend/src/services/socket.js
import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    this.socket = null;
  }

  connect(accessToken) {
    this.socket = io('wss://customer-service-platform-api.lilboo.workers.dev', {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => console.log('Connected to Socket.IO'));
    this.socket.on('disconnect', () => console.log('Disconnected from Socket.IO'));
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
  }

  emit(event, data) {
    if (this.socket) this.socket.emit(event, data);
  }

  on(event, callback) {
    if (this.socket) this.socket.on(event, callback);
  }

  off(event, callback) {
    if (this.socket) this.socket.off(event, callback);
  }
}

// Events to handle:
// - incoming_call: { callId, from, line: { type, id, name } }
// - call_answered: { callId, userId }
// - call_ended: { callId }
// - presence_update: { userId, status }
```

**Backend** (already exists):
- `/backend/src/durable-objects/CompanyRoom.js`
- Needs to be updated to use Socket.IO protocol
- Needs to be connected to call routing system

---

### 11. Frontend Application Structure

**Status**: ❌ Not started

**File Structure**:
```
/frontend/
  ├── public/
  ├── src/
  │   ├── assets/          # Images, fonts
  │   ├── components/      # Shared UI components
  │   │   ├── Button.jsx
  │   │   ├── Input.jsx
  │   │   ├── Modal.jsx
  │   │   ├── Sidebar.jsx
  │   │   └── ...
  │   ├── layouts/         # Page layouts
  │   │   ├── AuthLayout.jsx      # For login/register
  │   │   ├── DashboardLayout.jsx # For authenticated pages
  │   │   └── ...
  │   ├── pages/           # Route pages
  │   │   ├── auth/
  │   │   │   ├── LoginPage.jsx
  │   │   │   └── RegisterPage.jsx
  │   │   ├── dashboard/
  │   │   │   └── DashboardPage.jsx
  │   │   ├── inboxes/
  │   │   │   ├── InboxListPage.jsx
  │   │   │   └── InboxDetailPage.jsx
  │   │   ├── settings/
  │   │   │   ├── CompanySettingsPage.jsx
  │   │   │   └── UserSettingsPage.jsx
  │   │   └── ...
  │   ├── features/        # Feature-specific code
  │   │   ├── calls/       # Call handling (as described above)
  │   │   ├── contacts/
  │   │   ├── messages/
  │   │   └── ...
  │   ├── services/        # API and external services
  │   │   ├── api.js       # Axios instance with interceptors
  │   │   ├── socket.js    # Socket.IO manager
  │   │   └── auth.js      # Auth utilities
  │   ├── hooks/           # Custom React hooks
  │   │   ├── useAuth.js
  │   │   ├── useSocket.js
  │   │   └── ...
  │   ├── context/         # React Context providers
  │   │   ├── AuthContext.jsx
  │   │   ├── ThemeContext.jsx
  │   │   └── ...
  │   ├── utils/           # Utility functions
  │   ├── App.jsx          # Root component
  │   ├── main.jsx         # Entry point
  │   └── index.css        # Global styles + Tailwind imports
  ├── package.json
  ├── vite.config.js
  └── tailwind.config.js
```

**Key Files to Create**:

1. **API Service** (`/frontend/src/services/api.js`):
   - Axios instance with base URL
   - Request interceptor: Add JWT token to headers
   - Response interceptor: Handle 401, refresh token, retry

2. **Auth Context** (`/frontend/src/context/AuthContext.jsx`):
   - Manage user state, company info, tokens
   - Login, logout, register functions
   - Check if user is authenticated

3. **Protected Route** (`/frontend/src/components/ProtectedRoute.jsx`):
   - Redirect to login if not authenticated
   - Check role-based access

4. **Theme Provider** (`/frontend/src/context/ThemeContext.jsx`):
   - Light/dark mode toggle
   - Save preference to localStorage

---

### 12. UI/UX Design Principles

**Visual Style**:
- Modern, clean, minimal
- Lots of whitespace
- Clear typography hierarchy
- Subtle shadows and borders
- Smooth transitions and animations

**Color Palette** (suggested):
- **Light Mode**:
  - Background: White, Gray-50
  - Text: Gray-900, Gray-700
  - Primary: Blue-600 (buttons, links)
  - Success: Green-600
  - Error: Red-600
  - Border: Gray-200

- **Dark Mode**:
  - Background: Gray-900, Gray-800
  - Text: Gray-100, Gray-300
  - Primary: Blue-500
  - Success: Green-500
  - Error: Red-500
  - Border: Gray-700

**Component Guidelines**:
- Buttons should have hover states
- Form inputs should have focus rings
- Loading states for all async actions
- Error states with clear messages
- Empty states with helpful guidance
- Confirmation dialogs for destructive actions

**Reusable Components**:
- `<Button variant="primary|secondary|danger" />`
- `<Input type="text|email|tel" />`
- `<Select options={[]} />`
- `<Modal title="..." onClose={} />`
- `<Card />`
- `<Badge color="..." />`
- `<Avatar src="..." name="..." />`
- `<Table data={[]} columns={[]} />`

---

## Implementation Phases

### Phase 1: Foundation (CURRENT PRIORITY)

**Goal**: Get basic call handling working with one inbox

**Steps**:
1. ✅ Backend auth (DONE)
2. Build frontend shell (React + Vite + Tailwind)
3. Authentication UI (login, register)
4. Dashboard layout (sidebar, header)
5. Connect Twilio provider
6. Create one inbox
7. Assign one phone number to inbox
8. Implement RING_ALL routing strategy
9. Build call UI (incoming, outbound, active)
10. Test end-to-end call flow

**Deliverable**: One working inbox where calls ring all assigned users

---

### Phase 2: Multi-User & Preferences

**Goal**: Add user management and cell phone preferences

**Steps**:
1. User invitation system
2. User list and management UI
3. User profile page (edit name, cell phone)
4. User preference: Cell phone ringing opt-in/out
5. Company setting: Force cell phone ringing
6. Private line assignment
7. Private line UI and call handling

**Deliverable**: Multiple users can be invited, assigned to inboxes, with cell phone preferences

---

### Phase 3: Advanced Routing

**Goal**: Add more routing strategies

**Steps**:
1. Round-robin routing strategy
2. Priority queue strategy
3. Routing strategy UI (configure per inbox)
4. Agent availability status (online/away/busy)
5. Call queue (when all agents busy)

**Deliverable**: Flexible call routing with multiple strategies

---

### Phase 4: SMS & Messaging

**Goal**: Add SMS support to existing phone numbers

**Steps**:
1. SMS incoming webhook handling
2. Conversation list UI
3. Message thread UI
4. Send SMS from inbox
5. Contact management
6. Message search

**Deliverable**: Full SMS support alongside voice

---

### Phase 5: Multi-Channel (Email)

**Goal**: Add email channel support

**Steps**:
1. Email provider integration (Gmail, Outlook)
2. Email channel type
3. Threaded conversation handling
4. Rich text email composer
5. Email inbox UI

**Deliverable**: Email integrated into unified inbox

---

### Phase 6: Chat Channels (WhatsApp, Facebook)

**Goal**: Add chat platform support

**Steps**:
1. WhatsApp Business API integration
2. Facebook Messenger integration
3. Chat message handling
4. Rich media support (images, videos)
5. Quick replies and templates

**Deliverable**: WhatsApp and Facebook Messenger in unified inbox

---

## Code Quality Guidelines

### File Comments

Every file should start with:
```javascript
/**
 * [Component/Module Name]
 *
 * Purpose: [What this file does]
 *
 * Used by: [Which other components/pages use this]
 *
 * BEFORE MODIFYING:
 * - Should this change be in a separate file?
 * - Will this change break existing functionality?
 * - Is this change actually necessary for the current task?
 * - Have I tested the current working code before making changes?
 *
 * Dependencies: [Key imports]
 */
```

### Function Comments

```javascript
/**
 * Brief description of what function does
 *
 * @param {Type} paramName - Description
 * @returns {Type} - Description
 *
 * Example:
 *   functionName(example) // returns example result
 */
```

### Modularity Checklist

Before creating a new component/module, ask:
1. **Does this already exist?** - Check for similar functionality
2. **Can this be reused?** - Design for multiple use cases
3. **Is it self-contained?** - Minimize external dependencies
4. **Is it testable?** - Can it be tested in isolation?
5. **Is it documented?** - Clear comments and examples?

### Extensibility Checklist

When building features, ensure:
1. **Strategy pattern for options** - e.g., routing strategies in separate files
2. **Configuration over hardcoding** - Use database config, not code
3. **Interface contracts** - Define clear inputs/outputs
4. **Version compatibility** - Don't break existing API contracts
5. **Migration path** - How to upgrade existing data?

---

## Next Immediate Steps

**Priority Order**:

1. **Set up frontend project**
   - Initialize Vite + React
   - Configure Tailwind CSS
   - Set up routing
   - Create basic folder structure

2. **Build authentication UI**
   - Login page
   - Register page
   - Auth context and token management
   - Protected routes

3. **Create dashboard layout**
   - Sidebar navigation
   - Header with user menu
   - Theme toggle
   - Basic pages (dashboard, inboxes, settings)

4. **Provider integration (Twilio)**
   - Backend: Connect Twilio account endpoint
   - Frontend: Provider connection page
   - Fetch and display available phone numbers

5. **Inbox management**
   - Backend: CRUD endpoints for inboxes
   - Frontend: Inbox list and create modal
   - Assign phone numbers to inbox
   - Assign users to inbox

6. **Call handling (Phase 1)**
   - Backend: Incoming call webhook
   - Backend: RING_ALL routing strategy
   - Frontend: Call UI components
   - Socket.IO integration
   - Test complete call flow

---

## Success Criteria

**Phase 1 Complete When**:
- User can register and login
- User can connect Twilio account
- User can create an inbox
- User can assign a phone number to inbox
- User can assign themselves to inbox
- Incoming calls ring the user's browser
- User can answer calls in browser
- User can make outbound calls
- Calls are logged in database

**Overall Success When**:
- All channels work (voice, SMS, email, WhatsApp, Facebook)
- Multiple routing strategies available
- Multiple users collaborating in inboxes
- Private lines working
- Cell phone ringing with user preferences
- Company settings enforced
- Beautiful, responsive UI with light/dark themes
- Zero downtime deployments
- Fast and reliable

---

## Reference Materials

**Existing Prototype**:
- Location: `/reference-prototype/` (to be moved)
- What it does: Single-user Twilio browser phone
- What to copy: Twilio SDK integration, call handling logic
- What NOT to copy: Single-user approach, lack of multi-tenancy

**Database Schema**:
- Location: `/backend/prisma/schema.prisma`
- This is the source of truth for data structure

**API Documentation**:
- Backend base URL: `https://customer-service-platform-api.lilboo.workers.dev`
- Auth endpoints: `/api/v1/auth/*`
- Future docs: Generate OpenAPI spec from Hono routes

---

### 13. Twilio Configuration Validator (Future Feature)

**Status**: ❌ Not started - Added 2025-10-28

**Purpose**: Validate and auto-fix Twilio webhook configurations for providers and phone numbers

**Why This Matters**:
- Webhook URLs may become outdated if backend domain changes
- TwiML App SIDs can get misconfigured
- Phone numbers might be deleted from Twilio but still in our database
- API credentials may expire or be revoked
- Manual configuration drift between Twilio and our database

**Features**:

#### Validation Checks

**Provider-Level**:
1. **Credentials Validation** - Test Account SID + Auth Token with Twilio API
2. **TwiML App Webhook URLs** - Verify voice webhook points to correct backend domain
3. **API Keys** - Confirm REST API key and Access Token key still valid

**Channel-Level** (Per Phone Number):
1. **Phone Number Exists** - Verify number still exists in Twilio account
2. **Voice Webhook** - Check URL matches expected (only if "voice" in capabilities)
3. **SMS Webhook** - Check URL matches expected (only if "sms" in capabilities)
4. **Status Callback** - Verify status webhook URL is correct
5. **TwiML App SID** - Confirm matches provider's app (only if voice enabled)

**Important**: Validation respects channel capabilities
- If channel has `capabilities: ["sms"]` (no voice), voice webhook validation is SKIPPED
- If channel has `capabilities: ["voice"]` (no SMS), SMS webhook validation is SKIPPED
- Only validate webhooks for enabled capabilities to avoid false errors

#### User Interface

**Location**: Settings → Providers page, next to "Import numbers" link

**Flow**:
1. User clicks "Check Configuration" button
2. Modal opens: "Twilio Configuration Validator"
3. Shows progress: "Validating configuration... 75%"
4. Displays results:
   - ✅ Valid checks (green)
   - ❌ Invalid/misconfigured (red with expected vs actual)
   - ⊘ Skipped (grayed out - not applicable based on capabilities)
5. If issues found: "Fix All Issues" button appears
6. User clicks Fix → All issues auto-corrected
7. Success message + re-validation to confirm

**Example UI**:
```
Twilio Configuration Validator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Provider Credentials
  ✅ Account SID & Auth Token
  ❌ TwiML App webhook URL
     Expected: https://...new-domain.com/webhooks/twiml/voice
     Actual: https://...old-domain.com/webhooks/twiml/voice

Phone Numbers (3 total)

+12345678900
  ✅ Exists in Twilio
  ❌ Voice webhook (URL mismatch)
  ✅ SMS webhook
  ❌ Status callback (URL mismatch)
  ✅ TwiML App SID

+19876543210 (SMS only)
  ✅ Exists in Twilio
  ⊘ Voice webhook (not enabled)
  ✅ SMS webhook
  ✅ Status callback
  ⊘ TwiML App SID (not needed)

Summary: 4 issues found

[Fix All Issues] [Close]
```

#### Backend Implementation

**New Endpoints**:
1. `POST /api/v1/providers/:providerId/validate-config`
   - Validates all provider and channel configurations
   - Returns detailed report with passed/failed checks
   - Response includes expected vs actual values for failed checks

2. `POST /api/v1/providers/:providerId/fix-config`
   - Auto-fixes all detected issues
   - Updates TwiML App webhooks
   - Updates phone number webhooks (respecting capabilities)
   - Returns summary of fixes applied

**Files to Create**:
- `backend/src/api/providers/validate-config.js`
- `backend/src/api/providers/fix-config.js`
- `frontend/src/components/modals/ValidateTwilioConfigModal.jsx`

**Fix Logic**:
```javascript
// Only update webhooks for enabled capabilities
const updates = {};

if (capabilities.includes('voice')) {
  updates.voiceUrl = `${API_URL}/webhooks/inbound/${channelId}`;
  updates.voiceMethod = 'POST';
  updates.voiceApplicationSid = appSid;
}

if (capabilities.includes('sms')) {
  updates.smsUrl = `${API_URL}/webhooks/inbound/${channelId}`;
  updates.smsMethod = 'POST';
}

// Status callback applies to all
updates.statusCallback = `${API_URL}/webhooks/status/${channelId}`;
updates.statusCallbackMethod = 'POST';

await twilioClient.incomingPhoneNumbers(phoneNumberSid).update(updates);
```

#### Edge Cases Handled

1. **Channel has no voice** → Skip voice webhook validation ✅
2. **Channel has no SMS** → Skip SMS webhook validation ✅
3. **Phone deleted from Twilio** → Flag as error (can't auto-fix) ❌
4. **TwiML App deleted** → Flag as error (requires manual recreation) ❌
5. **Invalid credentials** → Show error, skip channel checks
6. **API rate limits** → Retry with exponential backoff
7. **Partial failures** → Show which fixes succeeded and which failed

#### Use Cases

1. **Domain Migration**: Backend moves to new domain → Run validator → Fix all webhooks
2. **Manual Changes**: User manually modifies Twilio settings → Validator detects drift
3. **Phone Deletion**: User deletes number from Twilio → Validator detects orphaned channel
4. **Credential Rotation**: Auth token renewed → Validator confirms new credentials work
5. **Debugging**: User reports calls not working → Validator identifies misconfigured webhook

#### Future Enhancements

- **Scheduled Validation**: Auto-run validation daily, alert on failures
- **Webhook Health Monitoring**: Track webhook delivery success rates
- **Configuration History**: Log all validation runs and fixes applied
- **Bulk Operations**: Validate/fix multiple providers at once

---

## Notes & Decisions

**Why Cloudflare Workers?**
- Global edge network (low latency)
- Serverless (no ops, scales automatically)
- Durable Objects for Socket.IO/WebSocket (stateful edge)
- R2 and KV for storage (cheap, fast)
- Great free tier, affordable paid tiers

**Why Neon Postgres?**
- Serverless Postgres (pay per usage)
- Fast cold starts
- Works great with Prisma
- Connection pooling built-in

**Why not use [heavy UI library]?**
- Custom components give full control
- Smaller bundle size
- Easier to theme and customize
- Learn by building

**Why save the plan?**
- Context window limits in AI conversations
- Easy reference for anyone joining project
- Living document that evolves with project
- Single source of truth

---

**End of Plan**

This document will be updated as the project progresses. All major architectural decisions and feature additions should be reflected here.
