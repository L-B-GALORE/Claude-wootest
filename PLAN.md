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
- **Real-time**: Cloudflare Durable Objects (WebSocket)
- **Storage**: Cloudflare R2 (call recordings, attachments)
- **Cache**: Cloudflare KV (sessions, presence)

### Frontend (Planned)
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context + hooks (Zustand for complex state)
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors
- **WebSocket**: Native WebSocket API
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

**Features**:
- Connect Twilio account (Account SID, Auth Token)
- Verify credentials
- Store encrypted credentials
- Fetch available phone numbers from Twilio
- Display provider status (active/error)
- Disconnect provider

**Database**:
- `Provider` table
  - `type`: TWILIO
  - `credentials`: Encrypted JSON `{ accountSid, authToken }`
  - `status`: ACTIVE | ERROR | DISCONNECTED

**Backend Endpoints** (to build):
- `POST /api/v1/providers` - Add provider
- `GET /api/v1/providers` - List providers
- `GET /api/v1/providers/:id/numbers` - Fetch available numbers
- `PUT /api/v1/providers/:id` - Update credentials
- `DELETE /api/v1/providers/:id` - Disconnect

**Twilio Integration**:
- Use existing prototype as reference
- Verify Twilio credentials on connection
- Fetch phone numbers via Twilio API
- Configure webhooks automatically

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
- Assign channels (phone numbers) to inbox
- Assign users (agents) to inbox
- View inbox members

**Database**:
- `Inbox` table (name, description)
- `InboxChannel` - Which phone numbers go to this inbox
- `InboxMember` - Which users have access to this inbox

**Backend Endpoints** (to build):
- `POST /api/v1/inboxes` - Create inbox
- `GET /api/v1/inboxes` - List inboxes
- `GET /api/v1/inboxes/:id` - Get inbox details
- `PUT /api/v1/inboxes/:id` - Update inbox
- `DELETE /api/v1/inboxes/:id` - Delete inbox
- `POST /api/v1/inboxes/:id/channels` - Assign channel
- `DELETE /api/v1/inboxes/:id/channels/:channelId` - Remove channel
- `POST /api/v1/inboxes/:id/members` - Add user to inbox
- `DELETE /api/v1/inboxes/:id/members/:userId` - Remove user

**Frontend UI**:
- Inbox list page
- Create inbox modal
- Inbox detail page with:
  - Assigned phone numbers
  - Assigned users
  - Routing strategy configuration

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
4. Backend creates WebSocket events to notify browsers
5. Browser(s) receive "incoming_call" event
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
  ├── CallManager.jsx (manages state, WebSocket, Twilio SDK)
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

### 10. Real-Time Features (WebSocket)

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
- WebSocket URL: `wss://customer-service-platform-api.lilboo.workers.dev/ws?token={jwt}`

**Frontend WebSocket Manager**:
```javascript
// /frontend/src/services/websocket.js

class WebSocketManager {
  connect(accessToken) { ... }
  disconnect() { ... }
  send(event, data) { ... }
  on(event, callback) { ... }
}

// Events to handle:
// - incoming_call: { callId, from, line: { type, id, name } }
// - call_answered: { callId, userId }
// - call_ended: { callId }
// - presence_update: { userId, status }
```

**Backend** (already exists):
- `/backend/src/durable-objects/CompanyRoom.js`
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
  │   │   ├── websocket.js # WebSocket manager
  │   │   └── auth.js      # Auth utilities
  │   ├── hooks/           # Custom React hooks
  │   │   ├── useAuth.js
  │   │   ├── useWebSocket.js
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
   - WebSocket integration
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

## Notes & Decisions

**Why Cloudflare Workers?**
- Global edge network (low latency)
- Serverless (no ops, scales automatically)
- Durable Objects for WebSocket (stateful edge)
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
