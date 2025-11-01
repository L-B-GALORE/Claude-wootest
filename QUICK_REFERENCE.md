# Quick Reference Guide - Claude-wootest Codebase

## Project at a Glance

**Type**: Multi-tenant SaaS platform  
**Status**: Phase 1 Complete (100%)  
**Tech**: React 18 + Cloudflare Workers + Neon Postgres  
**Deployment**: Global edge (Cloudflare)  

---

## File Structure

```
frontend/           - React app (Vite + Tailwind)
backend/            - Cloudflare Workers API
database/           - Prisma schema (18 models)
.github/workflows/  - GitHub Actions CI/CD
PLAN.md             - Roadmap & progress (READ THIS FIRST)
CODEBASE_ANALYSIS.md - Comprehensive analysis
DEPLOYMENT.md       - Deploy instructions
```

---

## Quick Commands

### Frontend
```bash
cd frontend
npm install
npm run dev         # Dev server at localhost:5173
npm run build       # Production build
npm run lint        # Check code quality
```

### Backend
```bash
cd backend
npm install
wrangler dev        # Dev server at localhost:8787
wrangler deploy     # Deploy to Cloudflare Workers
npm run test        # Run tests (Vitest)
```

### Database
```bash
npx prisma studio  # Open Prisma GUI
npx prisma db push # Push schema changes
npx prisma generate # Generate Prisma client
```

---

## Key Directories

| Path | Purpose |
|------|---------|
| `/frontend/src/pages` | Page components (routing targets) |
| `/frontend/src/components` | Reusable UI components |
| `/frontend/src/context` | Global state (Auth, Theme) |
| `/backend/src/api` | REST API routes (organized by domain) |
| `/backend/src/webhooks` | External service callbacks (Twilio) |
| `/backend/src/middleware` | Cross-cutting concerns (Auth, errors) |
| `/database/prisma` | Prisma ORM schema (18 models) |

---

## Architecture Highlights

### Multi-Tenant Isolation
Every query filters by `companyId` to prevent data leakage.

### Middleware Pipeline
```
Request → Logger → CORS → Auth → Validation → Handler → Response
```

### Authentication
- JWT tokens (access + refresh)
- Access token: 15 min duration
- Refresh token: 7 days duration
- Stored in localStorage on frontend

### Provider Integration
- Twilio (voice, SMS) - Implemented
- Plivo, Gmail, Outlook - Schema ready
- Credentials encrypted at rest (AES-256-GCM)

---

## Frontend Routes

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/login` | User login | No |
| `/register` | User registration | No |
| `/verify-email` | Email verification | No |
| `/dashboard` | Main app hub | Yes |
| `/conversations` | Message threads | Yes |
| `/contacts` | Customer database | Yes |
| `/calls` | Call history | Yes |
| `/settings/*` | Configuration pages | Yes |
| `/admin` | Admin panel | Yes |

---

## Backend API Routes

All routes prefixed with `/api/v1/`

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `POST /auth/register` | Create account | No |
| `POST /auth/login` | Login | No |
| `POST /auth/refresh` | Refresh token | No |
| `POST /providers` | Connect provider | Yes |
| `GET /channels` | List channels | Yes |
| `POST /inboxes` | Create inbox | Yes |
| `POST /voice/token` | Get voice token | Yes |
| `GET /conversations` | List conversations | Yes |
| `GET /calls` | Call history | Yes |
| `POST /webhooks/inbound` | Twilio callback | No |

---

## Database Models (18 total)

**Core**: Company, User, UserPreference  
**Provider**: Provider, Channel  
**Inbox**: Inbox, InboxChannel, InboxMember, PrivateChannel, RoutingStrategy  
**Contact**: Contact, Conversation, Message  
**Metadata**: VoiceCall, SmsMessage, EmailMessage, ChatMessage  
**Audit**: CompanySetting, ActivityLog  

---

## Key Technologies

### Frontend
- **React 18.3**: UI framework
- **Vite 5.4**: Build tool
- **React Router 6.26**: Client-side routing
- **Axios**: HTTP client with interceptors
- **React Query 5.56**: Server state management
- **Tailwind CSS 3.4**: Styling
- **Twilio Voice SDK 2.12**: Voice calls
- **Zod 3.23**: Schema validation

### Backend
- **Cloudflare Workers**: Serverless runtime
- **Hono 4.6**: Web framework
- **Prisma 5.20**: ORM
- **Neon Postgres**: Database
- **Twilio SDK**: Voice/SMS
- **Jose 5.10**: JWT handling
- **bcryptjs**: Password hashing

### Infrastructure
- **Cloudflare Workers**: API host
- **Cloudflare Pages**: Frontend host
- **Cloudflare KV**: Caching
- **Cloudflare R2**: File storage
- **Durable Objects**: WebSockets
- **Neon Postgres**: Database
- **GitHub Actions**: CI/CD

---

## Development Tips

### Add a New Frontend Page
1. Create file in `/frontend/src/pages/`
2. Add route to `/frontend/src/App.jsx`
3. Use `useAuth()` for authentication context
4. Use `api` service for HTTP calls

### Add a Backend API Endpoint
1. Create route file in `/backend/src/api/`
2. Use Hono router pattern
3. Add auth middleware if needed
4. Use Prisma for database access
5. Return standardized JSON response

### Add Database Model
1. Update `/database/prisma/schema.prisma`
2. Run `npx prisma migrate` to create migration
3. Run `npx prisma generate` to regenerate client
4. Update backend code to use new model

### Debugging
- Frontend: Browser DevTools (Console, Network)
- Backend: `wrangler dev` with console logs
- Database: `npx prisma studio` for GUI exploration

---

## Common Patterns

### API Call with Authentication
```javascript
import api from '@/services/api';

const response = await api.get('/api/v1/conversations', {
  params: { limit: 10 }
});
```

### Protected Route
```javascript
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}
```

### Create Database Record
```javascript
const contact = await prisma.contact.create({
  data: {
    companyId,
    phoneNumber,
    name,
  }
});
```

### Error Response
```javascript
throw new APIError(
  'ERROR_CODE',
  'Human readable message',
  400,
  { optional: 'details' }
);
```

---

## Deployment

### Automatic (via GitHub)
1. Push to `staging` branch → deploys to staging
2. Push to `main` branch → deploys to production

### Manual
```bash
# Frontend
cd frontend && npm run build && wrangler pages deploy dist

# Backend
cd backend && wrangler deploy
```

### Secrets Required
- `CLOUDFLARE_API_TOKEN` (GitHub Secrets)
- `DATABASE_URL` (GitHub Secrets)
- `JWT_SECRET` (environment variable)
- `ENCRYPTION_KEY` (environment variable)

---

## Troubleshooting

**Frontend can't connect to backend**
- Check `VITE_API_URL` environment variable
- Ensure backend is running and CORS is configured

**Database connection fails**
- Verify `DATABASE_URL` is set correctly
- Check Neon connection limits
- Run `npx prisma db push` to sync schema

**Twilio webhooks not working**
- Verify webhook URL in Twilio console
- Check that Worker is deployed and accessible
- Look for logs in Cloudflare dashboard

**Authentication fails**
- Clear localStorage: `localStorage.clear()`
- Check JWT_SECRET is set in environment
- Verify token expiration times

---

## Documentation

- **PLAN.md**: Project roadmap and progress tracking
- **CODEBASE_ANALYSIS.md**: Comprehensive architecture analysis
- **DEPLOYMENT.md**: Detailed deployment instructions
- **README.md**: Initial setup guide
- **EMAIL_TESTING.md**: Email provider testing

---

## Next Steps

1. Read `/PLAN.md` for project status
2. Review `/CODEBASE_ANALYSIS.md` for architecture
3. Run frontend locally: `cd frontend && npm run dev`
4. Run backend locally: `cd backend && wrangler dev`
5. Explore database: `npx prisma studio`
6. Pick a feature to work on
7. Create a branch and start coding!

---

**Last Updated**: 2025-11-01  
**Analysis Completeness**: Very Thorough
