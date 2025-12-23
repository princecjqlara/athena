# AdVision AI (Athena) - System Documentation

> **AI-Powered Advertising Intelligence Platform**  
> A comprehensive Next.js application for analyzing, predicting, and optimizing video ad performance using machine learning and AI.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Core Features](#core-features)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Machine Learning System](#machine-learning-system)
8. [Facebook Integration (CAPI)](#facebook-integration-capi)
9. [Pages & Components](#pages--components)
10. [Environment Setup](#environment-setup)
11. [Development Guide](#development-guide)

---

## System Overview

AdVision AI (codename: **Athena**) is an AI-powered marketing insights platform that helps advertisers:

- **Upload & Analyze** video/photo ad creatives with AI-extracted metadata
- **Predict Success** using ML models trained on historical performance data
- **Visualize Patterns** via a 2D/3D interactive mind map
- **Track Performance** with comprehensive analytics and dashboards
- **Integrate with Facebook** via CAPI for real-time conversion tracking
- **Get AI Recommendations** through an intelligent chatbot assistant

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                    │
├─────────────────────────────────────────────────────────────────┤
│  Pages                    │  Components                         │
│  ├── Dashboard (/)        │  ├── Sidebar.tsx                   │
│  ├── Upload (/upload)     │  ├── ChatBot.tsx (Athena AI)       │
│  ├── Predict (/predict)   │  ├── FacebookLogin.tsx             │
│  ├── Analytics            │  └── UndoPanel.tsx                 │
│  ├── Mindmap (/mindmap)   │                                     │
│  ├── Videos (/videos)     │                                     │
│  ├── Settings (/settings) │                                     │
│  └── Pipeline (/pipeline) │                                     │
├─────────────────────────────────────────────────────────────────┤
│                          API ROUTES                             │
│  /api/ai        → NVIDIA LLM for predictions & chat             │
│  /api/capi/send → Facebook Conversions API                      │
│  /api/webhook   → Facebook webhook receiver                     │
├─────────────────────────────────────────────────────────────────┤
│                         LIBRARIES                               │
│  lib/supabase.ts   → Database operations                        │
│  lib/cloudinary.ts → Media upload/storage                       │
│  lib/capi.ts       → Facebook CAPI utilities                    │
│  lib/ai/           → NVIDIA AI integration                      │
│  lib/ml/           → Self-correcting ML system                  │
├─────────────────────────────────────────────────────────────────┤
│                      EXTERNAL SERVICES                          │
│  Supabase (PostgreSQL) │ Cloudinary (CDN) │ NVIDIA NIM (AI)    │
│  Facebook Graph API    │ Meta CAPI        │                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 16.1.1 | React-based full-stack framework |
| **Language** | TypeScript | Type-safe JavaScript |
| **UI** | React 19 | Component-based UI |
| **Styling** | CSS Modules | Scoped component styles |
| **Charts** | Recharts | Data visualization |
| **Database** | Supabase (PostgreSQL) | Cloud database & real-time |
| **Media Storage** | Cloudinary | Video/image CDN |
| **AI Backend** | NVIDIA NIM API | GPT-powered predictions |
| **ML Framework** | TensorFlow.js | Client-side ML |
| **Auth** | Facebook OAuth | Social login |
| **Tracking** | Meta CAPI | Conversion events |

---

## Core Features

### 1. 📹 Video/Photo Upload & AI Analysis
- Drag-and-drop media upload to Cloudinary
- AI document parsing extracts 50+ metadata fields
- Facebook Ad ID verification and creative fetching
- Automatic thumbnail generation

**Extracted Metadata Fields:**
- Hook type, content category, editing style
- Platform, placement, CTA type
- Visual analysis (colors, faces, text overlays)
- Audio analysis (BPM, voiceover style)
- Sentiment and emotional tone
- Brand consistency metrics

### 2. 🎯 AI-Powered Predictions
- Success probability calculation (0-100%)
- Confidence scoring based on data volume
- Key factor analysis (positive/negative impacts)
- Personalized recommendations
- Audience segment performance predictions

### 3. 🧠 Self-Correcting ML System
Located in `lib/ml/`:

| Module | Purpose |
|--------|---------|
| `index.ts` | Central ML pipeline orchestration |
| `model.ts` | Core prediction model |
| `features.ts` | Feature extraction & encoding |
| `weight-adjustment.ts` | Dynamic weight updates based on errors |
| `feedback-loop.ts` | Prediction vs reality comparison |
| `feature-discovery.ts` | Automatic new pattern detection |
| `time-decay.ts` | Recency weighting for fresh data |
| `exploration.ts` | Epsilon-greedy wildcard recommendations |
| `audience-segmentation.ts` | Segment-specific scoring |
| `history.ts` | Undo/redo for data management |

**Key ML Concepts:**
- **Surprise Success/Failure Detection**: When predictions are significantly wrong
- **Concept Drift Detection**: Tracks when patterns become stale
- **Wildcard Recommendations**: Suggests unconventional combinations

### 4. 🗺️ Interactive Mind Map
- 2D/3D visualization toggle
- Force-directed graph layout
- Node sizing by frequency
- Color coding by success rate
- Click-to-filter by trait
- Pattern co-occurrence visualization

**30+ Category Types:**
Platform, Hook, Category, Style, Color, Music, CTA, Face, Emotion, Trigger, Shot, Scene, Text, Audio, Brand, Logo, Talent, Custom, etc.

### 5. 📊 Analytics Dashboard
- Input performance results per video
- Calculate CTR, ROAS, conversion rates
- Track by platform, day, time slot
- Feed data back to ML model

### 6. 💬 Athena AI Chatbot
- Natural language interface
- Access to all application data
- Creative recommendations
- Performance analysis
- Quick prompt suggestions

### 7. 📡 Facebook CAPI Integration
- OAuth-based Facebook page connection
- Ad account selection
- CAPI credentials configuration
- Test connection validation
- Event sending with SHA-256 hashing

---

## Database Schema

### Table: `videos`
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `video_metadata`
```sql
CREATE TABLE video_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id),
  script TEXT,
  hook_type TEXT,
  content_category TEXT,
  editing_style TEXT,
  color_scheme TEXT,
  text_overlays BOOLEAN,
  subtitles BOOLEAN,
  character_codes TEXT[],
  number_of_actors INTEGER,
  influencer_used BOOLEAN,
  ugc_style BOOLEAN,
  music_type TEXT,
  voiceover BOOLEAN,
  custom_tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `ad_performance`
```sql
CREATE TABLE ad_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id),
  platform TEXT,
  launch_date DATE,
  launch_day TEXT,
  launch_time TEXT,
  ad_spend DECIMAL(10,2),
  impressions INTEGER,
  reach INTEGER,
  clicks INTEGER,
  ctr DECIMAL(5,4),
  conversions INTEGER,
  conversion_rate DECIMAL(5,4),
  revenue DECIMAL(10,2),
  roas DECIMAL(6,2),
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  success_rating INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Reference

### POST `/api/ai`
AI-powered document parsing and chat.

**Request Body:**
```json
{
  "action": "parse_document" | "chat",
  "data": {
    "content": "string",     // For parse_document
    "message": "string",     // For chat
    "context": {},           // Data context
    "history": []            // Chat history
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "extracted": {},         // For parse_document
    "response": "string"     // For chat
  }
}
```

---

### POST `/api/capi/send`
Send conversion events to Facebook CAPI.

**Request Body:**
```json
{
  "datasetId": "string",
  "accessToken": "string",
  "eventName": "Purchase | Lead | CompleteRegistration | ...",
  "eventTime": 1703000000,   // Unix timestamp (optional)
  "leadId": "string",        // Best for matching
  "email": "user@email.com", // Will be hashed
  "phone": "+1234567890",    // Will be hashed
  "firstName": "John",       // Optional, will be hashed
  "lastName": "Doe",         // Optional, will be hashed
  "value": 99.99,
  "currency": "USD"
}
```

**Available Event Names:**
- `Purchase`, `Lead`, `CompleteRegistration`
- `Subscribe`, `StartTrial`, `Schedule`, `Contact`
- `SubmitApplication`, `InitiateCheckout`, `AddToCart`
- `ViewContent`, `Search`, `Custom`

---

### GET/POST `/api/webhook/facebook`
Facebook webhook endpoint for receiving lead and message data.

**Webhook Events:**
- Leadgen (Lead Ads)
- Messages (Messenger/Instagram DMs)
- Feed (Page post updates)
- Conversations

---

## Machine Learning System

### Prediction Pipeline

```
User Input → Feature Extraction → Weight Calculation → Score Generation
                   ↓                     ↓
            Discovered Features    Audience Segments
                   ↓                     ↓
            Global Weights ←──── Feedback Loop ←── Actual Results
```

### Feature Weightsystem

Each feature has:
- **Weight**: Numeric impact (-1 to +1)
- **Confidence Level**: Based on sample size
- **Trend**: Rising, falling, or stable
- **Last Updated**: Timestamp for decay

### Time Decay Configuration
```typescript
{
  thisWeek: 1.0,      // Full weight
  lastMonth: 0.8,     // 80% weight
  threeMonths: 0.5,   // 50% weight
  sixMonths: 0.3,     // 30% weight
  older: 0.1          // 10% weight
}
```

### Exploration (Epsilon-Greedy)
- 10% of recommendations are "wildcards"
- Helps discover unexpected winning patterns
- Prevents local optimization traps

---

## Facebook Integration (CAPI)

### Setup Flow

1. **Connect Facebook** → OAuth login via FacebookLogin component
2. **Select Ad Account** → Fetch and choose from available accounts
3. **Configure CAPI** → Enter Dataset ID and Access Token
4. **Test Connection** → Validate credentials
5. **Activate** → Start sending conversion events

### Data Hashing
All PII is SHA-256 hashed before sending:
- Email (normalized: lowercase, trimmed)
- Phone (normalized: remove spaces, dashes, +)
- First/Last Name (lowercase, trimmed)

### Best Practice: Lead ID
When available, use `lead_id` from webhook - it provides 100% match rate vs ~40-60% for hashed email/phone.

---

## Pages & Components

### Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Main dashboard with stats, patterns, actions |
| `/upload` | `app/upload/page.tsx` | Video upload, AI parsing, Facebook Ad ID |
| `/predict` | `app/predict/page.tsx` | Configure ads and get AI predictions |
| `/analytics` | `app/analytics/page.tsx` | Input performance results |
| `/mindmap` | `app/mindmap/page.tsx` | 2D/3D pattern visualization |
| `/videos` | `app/videos/page.tsx` | Video library browser |
| `/settings` | `app/settings/page.tsx` | Config, CAPI, Facebook, ML settings |
| `/results` | `app/results/page.tsx` | Performance results viewer |
| `/pipeline` | `app/pipeline/page.tsx` | Ad processing pipeline |

### Key Components

| Component | Description |
|-----------|-------------|
| `Sidebar.tsx` | Navigation sidebar with icons and links |
| `ChatBot.tsx` | Athena AI floating chat assistant |
| `FacebookLogin.tsx` | Facebook OAuth button and flow |
| `UndoPanel.tsx` | Undo/redo history management |

---

## Environment Setup

### Required Environment Variables

Create `.env.local` in the project root:

```env
# NVIDIA AI API (GPT-Powered Predictions)
NVIDIA_API_KEY=your-nvidia-api-key

# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ads_algorithm

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Meta/Facebook Configuration
NEXT_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your-secret-verify-token
```

### External Service Setup

#### Cloudinary
1. Sign up at https://cloudinary.com
2. Go to Dashboard > Settings > Upload
3. Create unsigned upload preset named `ads_algorithm`
4. Copy Cloud Name from Dashboard

#### Supabase
1. Sign up at https://supabase.com
2. Create new project
3. Run the database schema SQL
4. Copy Project URL and anon key

#### NVIDIA NIM
1. Sign up at https://build.nvidia.com
2. Generate API key
3. Model used: `nvidia/llama-3.1-nemotron-70b-instruct`

#### Facebook Developer
1. Create app at https://developers.facebook.com
2. Add Facebook Login product
3. Configure OAuth redirect URLs
4. Set webhook callback: `https://your-domain.com/api/webhook/facebook`

---

## Development Guide

### Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Project Structure

```
ads-algorithm-app/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── analytics/         # Analytics page
│   ├── mindmap/           # Mind map visualization
│   ├── predict/           # Prediction page
│   ├── settings/          # Settings page
│   ├── upload/            # Upload page
│   └── videos/            # Video library
├── components/            # React components
│   ├── ChatBot.tsx       # AI chatbot
│   ├── Sidebar.tsx       # Navigation
│   └── FacebookLogin.tsx # OAuth component
├── lib/                   # Utility libraries
│   ├── ai/               # NVIDIA AI integration
│   ├── ml/               # Machine learning system
│   ├── capi.ts           # Facebook CAPI utilities
│   ├── cloudinary.ts     # Media upload
│   └── supabase.ts       # Database operations
├── types/                 # TypeScript type definitions
│   └── index.ts          # All application types
└── public/               # Static assets
```

### Key Type Definitions

Located in `types/index.ts`:

- `Video`, `VideoMetadata`, `AdPerformance` - Database models
- `ExtractedAdData` - 50+ AI-extracted fields
- `ExtractedResultsData` - Performance metrics
- `AdEntry` - Combined ad data structure
- `MindMapNode`, `MindMapConnection` - Graph data
- `PredictionRecord`, `FeatureWeight` - ML types
- `MLSystemState` - Full ML system configuration

### Adding New Features

1. **New Page**: Create folder in `app/` with `page.tsx` and `page.module.css`
2. **New API**: Create `route.ts` in `app/api/[endpoint]/`
3. **New Component**: Add to `components/` folder
4. **New ML Feature**: Extend `lib/ml/` modules
5. **New Type**: Add to `types/index.ts`

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables
Set all environment variables in Vercel dashboard under Project Settings > Environment Variables.

### Webhook URL
After deployment, your webhook URL will be:
```
https://your-app.vercel.app/api/webhook/facebook
```

---

## Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Cloudinary Docs**: https://cloudinary.com/documentation
- **NVIDIA NIM**: https://docs.nvidia.com/nim
- **Facebook CAPI**: https://developers.facebook.com/docs/marketing-api/conversions-api

---

*Documentation generated for AdVision AI v0.1.0*
