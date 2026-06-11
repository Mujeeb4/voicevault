# VoiceVault Frontend

Modern Next.js 14 frontend for VoiceVault - Voice-powered AI memory preservation system.

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Runtime**: React 19
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand + React Query
- **Audio**: Web Audio API + FFmpeg.wasm
- **Streaming**: Server-Sent Events (SSE)
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Linting**: ESLint 9 (Flat Config)

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Update .env.local with your backend URL
```

## 🏃 Running Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages
│   │   ├── (user)/            # User dashboard & features
│   │   ├── (admin)/           # Admin pages
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Homepage
│   │   ├── providers.tsx      # React Query provider
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui base components
│   │   ├── auth/             # Auth components
│   │   ├── recording/        # Recording components
│   │   ├── chat/             # Chat components
│   │   ├── admin/            # Admin components
│   │   └── shared/           # Shared components
│   ├── lib/                   # Utilities
│   │   ├── api/              # API client
│   │   ├── audio/            # Audio utilities
│   │   ├── hooks/            # Custom hooks
│   │   ├── utils/            # Helper functions
│   │   └── validations/      # Zod schemas
│   ├── store/                 # Zustand stores
│   │   ├── auth.ts
│   │   ├── recording.ts
│   │   ├── chat.ts
│   │   └── admin.ts
│   └── types/                 # TypeScript types
│       └── index.ts
├── public/
│   ├── audio/
│   └── icons/
├── package.json
├── tsconfig.json              # TypeScript config (strict mode)
├── tailwind.config.ts         # Tailwind + Design System
├── next.config.js             # Next.js config
└── components.json            # shadcn/ui config
```

## 🎨 Design System

### Colors
- **Primary**: Blue (#3b82f6)
- **Success**: Green (#22c55e)
- **Warning**: Amber (#f59e0b)
- **Error**: Red (#ef4444)

### Spacing
Base unit: 4px (4, 8, 12, 16, 24, 32, 48, 64)

### Border Radius
- Small: 4px
- Medium: 8px
- Large: 12px

## 🧩 Adding shadcn/ui Components

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
# etc.
```

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🔧 Configuration Files

- **tsconfig.json**: TypeScript strict mode enabled
- **tailwind.config.ts**: Custom design system
- **next.config.js**: Next.js optimizations
- **components.json**: shadcn/ui configuration
- **.eslintrc.json**: ESLint rules
- **.prettierrc**: Code formatting

## 🌐 Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_MAX_RECORDING_DURATION=120
```

See `.env.local.example` for all options.

## 📚 Documentation

- [Frontend Plan](../FRONTEND_PLAN.md) - Complete feature specifications
- [Cursor Rules](../.cursorrules) - Coding standards & patterns
- [How to Use Cursor Rules](../HOW_TO_USE_CURSOR_RULES.md) - Prompt engineering guide

## 🎯 Key Features

### Phase 1: Foundation ✅
- ✅ Next.js 15 setup (latest)
- ✅ React 19 (latest)
- ✅ TypeScript strict mode
- ✅ ESLint 9 (flat config)
- ✅ Tailwind CSS + Design System
- ✅ Project structure
- ✅ API client with interceptors
- ✅ Zero deprecated packages
- ⏳ Authentication pages
- ⏳ Protected routes

### Phase 2: Recording System
- ⏳ AudioRecorder component
- ⏳ QuestionStepper component
- ⏳ Waveform visualization
- ⏳ IndexedDB persistence
- ⏳ Audio combining & compression
- ⏳ Upload with progress

### Phase 3: Processing Monitor
- ⏳ Real-time status polling
- ⏳ Timeline UI
- ⏳ Error handling

### Phase 4: Chat Interface
- ⏳ SSE streaming
- ⏳ Voice auto-play
- ⏳ Conversation history

### Phase 5: Family Management
- ⏳ Invitation system
- ⏳ Member management

### Phase 6: Admin Dashboard
- ⏳ Question CRUD
- ⏳ User management
- ⏳ Processing monitor

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables in Production

Set these in your hosting platform:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- All other env vars from `.env.local.example`

## 📖 Learning Resources

- [Next.js Docs](https://nextjs.org/docs)
- [React Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

## 🤝 Contributing

1. Follow the coding standards in `.cursorrules`
2. Use TypeScript strict mode
3. Follow the component structure pattern
4. Test on mobile devices
5. Ensure accessibility (ARIA labels, keyboard nav)
6. Run `npm run lint` before committing

## 📝 License

Private - VoiceVault Project

---

**Version**: 1.0.0  
**Last Updated**: January 15, 2026  
**Status**: Phase 1 Complete ✅

