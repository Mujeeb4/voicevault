# VoiceVault - AI Voice Memory System

<div align="center">

**Preserve your voice, personality, and memories forever**

Create an AI version of yourself that your family and friends can chat with, powered by advanced voice cloning and personality analysis.

[![Django](https://img.shields.io/badge/Django-5.0+-green.svg)](https://www.djangoproject.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.14+-blue.svg)](https://www.python.org/)

</div>

---

## 🎯 Project Overview

VoiceVault is a full-stack AI-powered platform that allows users to:

1. **Record** 30 audio answers to life story questions
2. **Process** recordings using AI to extract personality, transcribe voice, and clone voice
3. **Share** with family members who can chat with the AI using the user's voice and personality
4. **Preserve** memories and stories for future generations

### Key Features

- 🎤 **Voice Recording**: Record answers to 30 guided questions about life, memories, and wisdom
- 🧠 **AI Processing**: Advanced AI analyzes voice patterns, personality traits, and speech patterns
- 🎭 **Voice Cloning**: Create a realistic voice clone using ElevenLabs
- 💬 **Chat Interface**: Family members can have natural conversations with the AI
- 🎙️ **Voice Input**: Family members can ask questions using voice (transcribed automatically)
- 👨‍👩‍👧‍👦 **Family Management**: Invite and manage family member access
- 💳 **Payment Integration**: Stripe integration for package tiers (Lite, Premium, Family)
- 📊 **Admin Dashboard**: Complete admin interface for managing users, questions, and processing
- ⚡ **Real-time Streaming**: Sub-1 second perceived response time with SSE streaming
- 🔊 **Audio Responses**: AI responds with cloned voice audio

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────┐
│   Frontend      │  Next.js 14 (App Router)
│   (Next.js)     │  TypeScript + Tailwind CSS
└────────┬────────┘  Zustand + React Query
         │
         │ HTTPS/REST API
         │
┌────────▼────────┐
│   Backend       │  Django 5.1 + DRF
│   (Django)      │  PostgreSQL (Supabase)
└────────┬────────┘  Celery + Redis
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───▼───┐ ┌──▼───┐ ┌────▼────┐ ┌───▼────┐
│OpenAI │ │Eleven│ │Supabase │ │ Stripe │
│Whisper│ │Labs  │ │Storage  │ │Payment │
│GPT-4o │ │Voice │ │Postgres │ │        │
└───────┘ └──────┘ └─────────┘ └────────┘
```

### Data Flow

1. **Recording Flow**: User records → Uploads to Supabase → Backend stores metadata
2. **Processing Flow**: Celery tasks → Transcription → Personality Analysis → Voice Cloning
3. **Chat Flow**: Family member asks question → RAG context → GPT-4o response → ElevenLabs voice → Return to frontend

---

## 🛠️ Tech Stack

### Backend

- **Framework**: Django 5.1+ with Django REST Framework 3.14+
- **Database**: PostgreSQL (via Supabase)
- **Storage**: Supabase Storage (audio files)
- **Authentication**: Supabase Auth (JWT tokens)
- **Task Queue**: Celery 5.3+ with Redis 5.0+
- **AI Services**:
  - OpenAI Whisper (transcription)
  - OpenAI GPT-4o (personality analysis & chat)
  - ElevenLabs (voice cloning & TTS)
- **Payments**: Stripe API
- **Email**: Django email backend (SMTP/Gmail)

### Frontend

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5.0+
- **Styling**: Tailwind CSS 3.4+
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand 4.4+
- **Server State**: React Query (@tanstack/react-query) 5.0+
- **Forms**: React Hook Form + Zod validation
- **Audio**: Web Audio API, MediaRecorder API, FFmpeg.wasm
- **Animations**: Framer Motion 10.0+
- **Notifications**: Sonner (toast notifications)

### Infrastructure

- **Database**: Supabase PostgreSQL (with connection pooling)
- **File Storage**: Supabase Storage buckets
- **Cache**: Redis (for Celery broker & result backend)
- **Deployment**: Ready for Vercel (frontend) + Railway/Render (backend)

---

## 📁 Project Structure

```
voice_vault/
├── backend/                    # Django backend
│   ├── apps/
│   │   ├── users/            # User & family management
│   │   ├── recordings/       # Audio upload & questions
│   │   ├── ai_processing/    # AI tasks (transcription, personality, voice)
│   │   ├── chat/             # Chat system & RAG
│   │   └── payments/        # Stripe integration
│   ├── config/               # Django settings
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── celery.py        # Celery configuration
│   ├── utils/                # Utilities
│   │   ├── supabase_client.py
│   │   ├── supabase_auth.py
│   │   └── exceptions.py
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/                  # Next.js frontend
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── (auth)/       # Auth pages (login, signup)
│   │   │   ├── (user)/       # User pages (dashboard, record, chat)
│   │   │   └── (admin)/      # Admin pages
│   │   ├── components/       # React components
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   ├── recording/    # Recording components
│   │   │   ├── chat/         # Chat components
│   │   │   ├── processing/   # Processing status components
│   │   │   └── admin/        # Admin components
│   │   ├── lib/              # Utilities & API clients
│   │   │   ├── api/          # API client functions
│   │   │   ├── audio/        # Audio utilities
│   │   │   └── hooks/        # Custom React hooks
│   │   ├── store/            # Zustand stores
│   │   └── types/            # TypeScript types
│   ├── public/               # Static assets
│   ├── package.json
│   └── next.config.js
│
├── docs/                      # Documentation
│   └── API_DOCUMENTATION.md
│
├── .env.example              # Environment variables template
├── README.md                 # This file
└── setup.md                 # Detailed setup guide
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.14+** (or 3.10+)
- **Node.js 18+** and npm
- **Redis** (for Celery)
- **Supabase Account** (free tier works)
- **OpenAI API Key**
- **ElevenLabs API Key**
- **Stripe Account** (for payments)

### Backend Setup

1. **Clone repository**
```bash
git clone <repository-url>
cd voice_vault
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

**Required Environment Variables:**
```bash
# Django
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:port/db
# OR individual variables:
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=db.xxx.supabase.co
DB_PORT=5432

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# AI Services
OPENAI_API_KEY=sk-xxx
ELEVENLABS_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

5. **Run migrations**
```bash
python manage.py migrate
```

6. **Create superuser**
```bash
python manage.py createsuperuser
```

7. **Seed questions** (optional)
```bash
python seed_questions.py
```

8. **Start development server**
```bash
python manage.py runserver
# Server runs on http://localhost:8000
```

9. **Start Celery worker** (in separate terminal)
```bash
celery -A config worker -l info -Q default,transcription,voice,analysis
```

10. **Start Celery beat** (optional, for scheduled tasks)
```bash
celery -A config beat -l info
```

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
# Edit .env.local
```

**Required Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. **Run development server**
```bash
npm run dev
# Frontend runs on http://localhost:3000
```

5. **Build for production** (optional)
```bash
npm run build
npm start
```

---

## 📚 API Documentation

### Authentication

All API endpoints (except public ones) require Supabase JWT token:

```http
Authorization: Bearer {supabase_jwt_token}
```

### Main Endpoints

#### Users
- `GET /api/users/profile/` - Get current user profile
- `POST /api/users/signup/` - Sign up new user
- `POST /api/users/login/` - Login user
- `POST /api/users/refresh/` - Refresh token

#### Recordings
- `POST /api/recordings/upload/` - Upload audio file
- `GET /api/recordings/` - List recordings
- `DELETE /api/recordings/{id}/` - Delete recording
- `GET /api/recordings/questions/` - Get all questions

#### AI Processing
- `GET /api/admin/process/status/{user_id}/` - Get processing status
- `POST /api/admin/process/transcribe/{user_id}/` - Trigger transcription
- `POST /api/admin/process/personality/{user_id}/` - Trigger personality analysis
- `POST /api/admin/process/voice-clone/{user_id}/` - Trigger voice cloning
- `POST /api/admin/process/full-pipeline/{user_id}/` - Run full pipeline

#### Chat
- `GET /api/chat/stream/?ai_owner_id=xxx&message=xxx` - Streaming chat (SSE)
- `POST /api/chat/transcribe-voice/` - Transcribe voice input
- `GET /api/chat/conversations/` - Get conversation history
- `POST /api/chat/conversations/{id}/rate/` - Rate conversation

#### Family Management
- `POST /api/family/invite/` - Invite family member
- `POST /api/family/accept-invite/{token}/` - Accept invitation
- `GET /api/family/members/` - List family members
- `DELETE /api/family/members/{id}/` - Remove member

**📖 See `docs/API_DOCUMENTATION.md` for complete API reference**

---

## 🎨 Frontend Features

### User Pages

- **Dashboard**: Overview of recording progress, AI status, and quick actions
- **Recording**: Step-by-step recording interface with 30 questions
- **Processing**: Real-time status monitoring with manual trigger buttons
- **Chat**: Chat interface with voice input and audio responses
- **Family**: Manage family member invitations and access
- **Settings**: User profile and preferences

### Admin Pages

- **Dashboard**: System statistics and overview
- **Users**: User management table with filters
- **Questions**: Question management with drag-and-drop reordering
- **Processing**: Monitor all AI processing tasks

### Key Components

- **AudioRecorder**: Real-time waveform visualization
- **ChatInterface**: SSE streaming with voice playback
- **ProcessingTimeline**: Step-by-step processing status
- **VoiceInput**: Voice recording with transcription
- **AdminRoute**: Protected admin routes

---

## 🔄 Development Workflow

### Running Both Servers

**Terminal 1 - Backend:**
```bash
cd voice_vault
source venv/bin/activate
python manage.py runserver
```

**Terminal 2 - Celery Worker:**
```bash
cd voice_vault
source venv/bin/activate
celery -A config worker -l info -Q default,transcription,voice,analysis
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

### Testing

**Backend Tests:**
```bash
python manage.py test
python manage.py test apps.recordings
```

**Frontend Tests:**
```bash
cd frontend
npm test
```

**End-to-End Flow:**
Use the backend and frontend test suites above. Avoid running ad hoc scripts that call live AI/payment providers unless they are isolated and reviewed.

---

## 🗄️ Database Models

### Core Models

- **User**: Main user model (AI owners and family members)
- **FamilyMember**: Tracks family member access and relationships
- **AudioRecording**: Metadata for uploaded audio files
- **RecordingQuestion**: 30 life story questions
- **Transcript**: Full transcript of all recordings
- **AIConfiguration**: AI personality and voice configuration
- **ProcessingQueue**: Tracks async Celery tasks
- **Conversation**: Chat conversations between family and AI
- **Payment**: Stripe payment tracking

**See `apps/*/models.py` for detailed model definitions**

---

## 🔐 Security

- **Authentication**: Supabase JWT tokens verified via middleware
- **Authorization**: User-scoped data access (users can only access their own data)
- **File Uploads**: Validated for size, type, and content
- **API Keys**: Stored in environment variables (never committed)
- **HTTPS**: Required in production
- **CORS**: Configured for frontend domain only
- **SQL Injection**: Protected by Django ORM
- **XSS**: React automatically escapes content

---

## 📦 Deployment

### Backend Deployment

**Recommended Platforms:**
- Railway
- Render
- Heroku
- DigitalOcean App Platform

**Steps:**
1. Set all environment variables
2. Run migrations: `python manage.py migrate`
3. Collect static files: `python manage.py collectstatic`
4. Start Celery worker as background process
5. Configure Redis for Celery

### Frontend Deployment

**Recommended Platform:**
- Vercel (optimized for Next.js)

**Steps:**
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

**See `setup.md` for detailed deployment guide**

---

## 🧪 Testing Status

- ✅ **Module 1**: Foundation, Auth & Database (100% complete)
- ✅ **Module 2**: Async AI Pipeline (100% complete)
- ✅ **Module 3**: Chat System & RAG (100% complete)
- ✅ **Module 4**: Family Management (100% complete)
- ✅ **Frontend**: All phases complete (Phases 1-7)

**Total Tests**: 66/66 Passed (100%) 🎉

---

## 📖 Documentation

- **README.md** (this file) - Project overview and quick start
- **setup.md** - Detailed setup and implementation guide
- **docs/API_DOCUMENTATION.md** - Complete API reference
- **frontend/README.md** - Frontend-specific documentation

---

## 🛣️ Roadmap

### Completed ✅
- [x] User authentication and profile management
- [x] Audio recording and upload system
- [x] AI processing pipeline (transcription, personality, voice cloning)
- [x] Chat system with streaming responses
- [x] Voice input for family members
- [x] Family invitation system
- [x] Admin dashboard
- [x] Payment integration
- [x] Processing status monitoring
- [x] Voice cloning with ElevenLabs

### Future Enhancements 🚀
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Video recording option
- [ ] Advanced personality customization
- [ ] Conversation analytics
- [ ] Export conversations
- [ ] Voice quality improvements
- [ ] Batch processing optimizations

---

## 🤝 Contributing

This is a proprietary project. For questions or issues:

- **Email**: support@voicevault.com
- **Documentation**: See `setup.md` for detailed guides

---

## 📄 License

Proprietary - All rights reserved

---

## 🙏 Acknowledgments

- **OpenAI** - Whisper transcription and GPT-4o
- **ElevenLabs** - Voice cloning and TTS
- **Supabase** - Database and storage
- **Django** - Backend framework
- **Next.js** - Frontend framework
- **shadcn/ui** - UI component library

---

## 📞 Support

For technical support or questions:
- Check `setup.md` for detailed implementation guides
- Review `docs/API_DOCUMENTATION.md` for API details
- Email: support@voicevault.com

---

**Status**: ✅ **PRODUCTION READY**  
**Last Updated**: January 21, 2026  
**Version**: 1.0.0
