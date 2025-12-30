# AdVision AI (Athena) - Complete System Documentation

> **AI-Powered Advertising Intelligence Platform**  
> A comprehensive Next.js application for analyzing, predicting, and optimizing video ad performance using machine learning and advanced AI.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack & Dependencies](#technology-stack--dependencies)
4. [Core Application Flow](#core-application-flow)
5. [Feature Deep Dive](#feature-deep-dive)
6. [Database Schema & Data Models](#database-schema--data-models)
7. [API Reference](#api-reference)
8. [Machine Learning System](#machine-learning-system)
9. [AI Integration (NVIDIA NIM)](#ai-integration-nvidia-nim)
10. [Facebook CAPI Integration](#facebook-capi-integration)
11. [Components Architecture](#components-architecture)
12. [Type System](#type-system)
13. [File Structure](#file-structure)
14. [Environment Setup](#environment-setup)
15. [Development Guide](#development-guide)
16. [Deployment](#deployment)
17. [Athena AI Upgrade System](#athena-ai-upgrade-system)
18. [**Athena Agent System**](#athena-agent-system) ⭐ NEW
19. [**Campaign Builder & Templates**](#campaign-builder--templates) ⭐ NEW
20. [**Ad Quality Scoring System**](#ad-quality-scoring-system) ⭐ NEW
21. [**Pipeline CRM System**](#pipeline-crm-system) ⭐ NEW
22. [**Advanced ML Modules**](#advanced-ml-modules) ⭐ NEW
23. [**Advanced AI Modules**](#advanced-ai-modules) ⭐ NEW
24. [**Background Sync System**](#background-sync-system) ⭐ NEW
25. [**Collective Intelligence**](#collective-intelligence) ⭐ NEW
26. [**Marketplace & Data Pools**](#marketplace--data-pools) ⭐ NEW
27. [**Admin & RBAC**](#admin--rbac) ⭐ NEW
28. [Troubleshooting](#troubleshooting)


---

## System Overview

### What is AdVision AI (Athena)?

AdVision AI, codenamed **Athena**, is an AI-powered marketing insights platform designed to help advertisers make data-driven decisions about their video and photo ad creatives. The platform combines:

- **AI-Powered Document Parsing**: Uses NVIDIA NIM API (LLaMA 3.1 70B) to extract 80+ metadata fields from natural language descriptions
- **Self-Correcting ML System**: A client-side machine learning pipeline that learns from prediction errors
- **Interactive Visualizations**: 2D/3D force-directed mind maps showing pattern correlations
- **Facebook CAPI Integration**: Real-time conversion tracking with proper SHA-256 hashing
- **Athena Agent System**: 40+ agentic actions for executing tasks via natural language commands
- **Campaign Builder**: Multi ad set campaign creation with templates and AI recommendations
- **Pipeline CRM**: Lead management with stage-based workflows and conversion tracking
- **Collective Intelligence**: Privacy-preserving shared learning across the user community

### Key Capabilities

| Capability | Description |
|------------|-------------|
| **Upload & Analyze** | Drag-and-drop media upload with AI metadata extraction |
| **Predict Success** | ML-based success probability calculation (0-100%) |
| **Visualize Patterns** | Interactive mind map showing trait correlations |
| **Track Performance** | Input results and feed back to ML for continuous learning |
| **Facebook Integration** | OAuth connection, CAPI event sending, webhook receiving |
| **AI Chat Assistant** | Natural language interface for data analysis and recommendations |
| **Athena Agent** | Execute 40+ actions via natural language (pause/resume ads, update budgets, create campaigns) |
| **Campaign Builder** | Create multi-adset campaigns with templates and AI-powered recommendations |
| **Quality Scoring** | Chess-style ad analysis with blunders, mistakes, and victory chance |
| **Pipeline CRM** | Manage leads through customizable stage workflows |
| **Background Sync** | Automatic Facebook ad synchronization with configurable intervals |
| **Collective Intelligence** | Shared learning across users while preserving privacy |
| **Marketplace** | Access Galaxy Orbs data pools for AI-enhanced targeting |


---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (Browser)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  Dashboard   │ │   Upload     │ │   Predict    │ │   Analytics  │       │
│  │   (/)        │ │  (/upload)   │ │  (/predict)  │ │ (/analytics) │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   Mindmap    │ │   Videos     │ │  Settings    │ │   Pipeline   │       │
│  │ (/mindmap)   │ │  (/videos)   │ │ (/settings)  │ │ (/pipeline)  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    COMPONENTS                                        │   │
│  │  Sidebar.tsx │ ChatBot.tsx │ FacebookLogin.tsx │ UndoPanel.tsx      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               CLIENT-SIDE ML SYSTEM (lib/ml/)                        │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐         │   │
│  │  │   model.ts  │  │ weight-adjust.ts│  │ feedback-loop.ts │         │   │
│  │  │ TensorFlow  │  │ Dynamic Weights │  │ Error Detection  │         │   │
│  │  └─────────────┘  └─────────────────┘  └──────────────────┘         │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐         │   │
│  │  │features.ts  │  │ exploration.ts  │  │ time-decay.ts    │         │   │
│  │  │ Encoding    │  │ Epsilon-Greedy  │  │ Recency Weights  │         │   │
│  │  └─────────────┘  └─────────────────┘  └──────────────────┘         │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐         │   │
│  │  │ discovery.ts│  │ segmentation.ts │  │   history.ts     │         │   │
│  │  │ New Patterns│  │ Audience Scores │  │   Undo/Redo      │         │   │
│  │  └─────────────┘  └─────────────────┘  └──────────────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                        localStorage (ML State Persistence)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS API ROUTES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /api/ai                                                               │
│  ├── action: 'predict'         → AI prediction generation                  │
│  ├── action: 'parse-content'   → Extract 80+ ad metadata fields            │
│  ├── action: 'parse-results'   → Extract performance metrics               │
│  ├── action: 'analyze-mindmap' → Generate pattern correlations             │
│  ├── action: 'discover-features'→ Find hidden patterns in surprise ads     │
│  └── action: 'chat'            → Athena AI chatbot responses               │
│                                                                             │
│  POST /api/capi/send           → Send conversion events to Facebook        │
│  GET  /api/capi/send           → Get available CAPI event types            │
│                                                                             │
│  GET/POST /api/webhook/facebook→ Receive Facebook webhook events           │
│                                                                             │
│  GET /api/categories           → Get trait categories for mindmap          │
│  GET /api/facebook/...         → Facebook OAuth and ad account APIs        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   SUPABASE       │  │    CLOUDINARY    │  │     NVIDIA NIM API       │  │
│  │                  │  │                  │  │                          │  │
│  │  PostgreSQL DB   │  │  Video/Image     │  │  LLaMA 3.1 Nemotron      │  │
│  │  - videos        │  │  CDN Storage     │  │  70B Instruct            │  │
│  │  - video_metadata│  │  - Thumbnails    │  │                          │  │
│  │  - ad_performance│  │  - Transcoding   │  │  Endpoint:               │  │
│  │                  │  │                  │  │  integrate.api.nvidia.com│  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     FACEBOOK / META                                   │  │
│  │                                                                       │  │
│  │  Graph API v24.0                                                      │  │
│  │  ├── OAuth Authentication                                             │  │
│  │  ├── Page Management                                                  │  │
│  │  ├── Ad Account Access                                                │  │
│  │  └── Creative Fetching                                                │  │
│  │                                                                       │  │
│  │  Conversions API (CAPI)                                               │  │
│  │  ├── Event Sending (Purchase, Lead, etc.)                             │  │
│  │  ├── SHA-256 User Data Hashing                                        │  │
│  │  └── Deduplication via event_id                                       │  │
│  │                                                                       │  │
│  │  Webhooks                                                              │  │
│  │  ├── Leadgen events                                                   │  │
│  │  ├── Messaging events                                                 │  │
│  │  └── Page feed updates                                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (natural language) 
    → AI Parsing (NVIDIA NIM)
    → Structured ExtractedAdData (80+ fields)
    → Unified Prediction Pipeline (see below)
    → Prediction with Confidence + 4-Section Explanation
    
User Inputs Results
    → AI Results Parsing
    → Compare Prediction vs Reality
    → Store for future RAG retrieval
```

### Unified Prediction Pipeline (NEW)

The system uses a **single decision spine** for all predictions, reducing complexity and improving explainability:

```
INPUT AD
   ↓
1. Retrieve Similar Ads (RAG)
   ↓
2. Estimate Outcome from Neighbors
   ↓
3. Adjust via Contrast (trait differences)
   ↓
4. Measure Confidence
   ↓
5. If Confidence Low → Fallback + Data Suggestions
   ↓
OUTPUT: Prediction + 4-Section Explanation
```

#### 4-Section Explanation Format

Every prediction includes:
1. **"Here's what similar ads did"** - Evidence from neighbor ads
2. **"Here's how your differences matter"** - Contrastive trait analysis
3. **"Here's our confidence"** - Confidence level with reasons
4. **"Here's what data would help"** - Data gap suggestions (when confidence is low)

#### Advisory Systems (OFF by default)

The following systems are disabled by default to reduce noise:
- **Exploration**: Random wildcard recommendations → trigger only on low confidence
- **Feature Discovery**: Auto-trait discovery → manual trigger only
- **Weight Learning**: Continuous weight updates → fallback-only mode

Enable via `setAdvisoryEnabled()` in `lib/rag/decision-config.ts`.

---

## Technology Stack & Dependencies

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.1 | React-based full-stack framework with App Router |
| **React** | 19.2.3 | Component-based UI library |
| **TypeScript** | ^5 | Type-safe JavaScript |

### Dependencies (package.json)

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.89.0",   // Database client
    "@tensorflow/tfjs": "^4.22.0",         // Client-side neural network
    "next": "16.1.1",                       // Framework
    "next-cloudinary": "^6.17.5",           // Media upload
    "react": "19.2.3",                      // UI
    "react-dom": "19.2.3",                  // DOM bindings
    "recharts": "^3.6.0",                   // Data visualization
    "uuid": "^13.0.0"                       // Unique ID generation
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/uuid": "^10.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.1.1",
    "typescript": "^5"
  }
}
```

### External Services

| Service | Purpose | Authentication |
|---------|---------|----------------|
| **Supabase** | PostgreSQL database + real-time | anon key (public) |
| **Cloudinary** | Video/image CDN with transformations | unsigned upload preset |
| **NVIDIA NIM** | LLM API (LLaMA 3.1 70B) | Bearer API key |
| **Facebook** | OAuth, Graph API, CAPI | OAuth + access tokens |

### Styling

- **CSS Modules**: Scoped component styles (`*.module.css`)
- **Global CSS**: Design tokens and responsive system (`globals.css`)
- **No CSS Framework**: Pure CSS for maximum control

---

## Core Application Flow

### 1. Ad Upload Flow

```
┌─────────────────┐
│   User visits   │
│    /upload      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Select Media    │────►│ Upload to        │
│ (drag & drop)   │     │ Cloudinary       │
└─────────────────┘     └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Returns:         │
                        │ - secure_url     │
                        │ - public_id      │
                        │ - thumbnail_url  │
                        └────────┬─────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│ Option A:       │                             │ Option B:       │
│ Describe ad in  │                             │ Enter Facebook  │
│ natural language│                             │ Ad ID           │
└────────┬────────┘                             └────────┬────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│ POST /api/ai    │                             │ Fetch creative  │
│ action:         │                             │ from Graph API  │
│ 'parse-content' │                             │                 │
└────────┬────────┘                             └────────┬────────┘
         │                                               │
         └───────────────────────┬───────────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ ExtractedAdData  │
                        │ (80+ fields)     │
                        │                  │
                        │ - hookType       │
                        │ - platform       │
                        │ - colorScheme    │
                        │ - hasSubtitles   │
                        │ - etc...         │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Save to Supabase │
                        │ - videos table   │
                        │ - video_metadata │
                        └──────────────────┘
```

### 2. Prediction Flow

```
┌─────────────────┐
│   User visits   │
│    /predict     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Select existing ad OR configure new ad  │
│                                          │
│ Configuration includes:                  │
│ - Hook Type                              │
│ - Platform                               │
│ - Content Category                       │
│ - Editing Style                          │
│ - Features (subtitles, UGC, voiceover)   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           DUAL PREDICTION PATH           │
├─────────────────┬───────────────────────┤
│                 │                        │
▼                 ▼                        │
┌─────────────┐   ┌─────────────────────┐  │
│ Client ML   │   │ NVIDIA AI API       │  │
│ System      │   │                     │  │
│             │   │ POST /api/ai        │  │
│ features.ts │   │ action: 'predict'   │  │
│     ↓       │   │                     │  │
│ model.ts    │   │ Returns:            │  │
│     ↓       │   │ - successProbability│  │
│ weights.ts  │   │ - confidence        │  │
│             │   │ - keyFactors[]      │  │
│ Returns:    │   │ - recommendations[] │  │
│ - score     │   │ - reasoning         │  │
│ - factors   │   └─────────────────────┘  │
└──────┬──────┘                            │
       │                                   │
       └──────────────┬────────────────────┘
                      │
                      ▼
             ┌─────────────────┐
             │ Combined Result │
             │                 │
             │ - Success %     │
             │ - Confidence    │
             │ - Key Factors   │
             │ - Recommendations│
             │ - Segment Scores│
             │ - Wildcards     │
             └─────────────────┘
```

### 3. Learning Loop (Self-Correction)

```
┌─────────────────────────────────────────────────────────────────┐
│                   PREDICTION RECORDED                            │
│                                                                  │
│  {                                                               │
│    id: "pred-1703000000",                                        │
│    adId: "ad-123",                                               │
│    predictedScore: 75,                                           │
│    weightsUsed: [...],                                           │
│    predictedAt: "2024-12-20T10:00:00Z"                           │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ (Time passes, user runs ad)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   USER INPUTS RESULTS                            │
│                                                                  │
│  "Spent $500, got 12000 impressions, 250 clicks, 4.1% CTR,      │
│   18 conversions, made $1,200 revenue"                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI RESULTS PARSING (POST /api/ai)                   │
│                                                                  │
│  ExtractedResultsData:                                           │
│  {                                                               │
│    adSpend: 500,                                                 │
│    impressions: 12000,                                           │
│    clicks: 250,                                                  │
│    ctr: 4.1,                                                     │
│    conversions: 18,                                              │
│    revenue: 1200,                                                │
│    roas: 2.4,                                                    │
│    successScore: 82   ← Calculated                               │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│             FEEDBACK LOOP ANALYSIS (feedback-loop.ts)            │
│                                                                  │
│  predicted: 75                                                   │
│  actual: 82                                                      │
│  delta: +7                                                       │
│  deltaPercent: 9.3%                                              │
│                                                                  │
│  Analysis Result:                                                │
│  - isHighError: false (< 50%)                                    │
│  - isSurpriseSuccess: false (predicted wasn't < 50)              │
│  - isSurpriseFailure: false                                      │
│  - analysisType: 'accurate'                                      │
└─────────────────────────────────────────────────────────────────┘
                             │
      ┌──────────────────────┴──────────────────────┐
      │                                             │
      ▼                                             ▼
┌─────────────────┐                     ┌─────────────────────────┐
│ If ACCURATE     │                     │ If HIGH ERROR (>50%)    │
│                 │                     │                         │
│ No weight       │                     │ 1. adjustWeightsForError│
│ adjustment      │                     │    - Increase/decrease  │
│ needed          │                     │      feature weights    │
│                 │                     │    - Save to localStorage│
└─────────────────┘                     │                         │
                                        │ If SURPRISE SUCCESS     │
                                        │ (predicted <50, actual >70):│
                                        │                         │
                                        │ 2. discoverFeaturesFromAd│
                                        │    - Call AI to find    │
                                        │      hidden patterns    │
                                        │    - Add new features   │
                                        │      to weight system   │
                                        └─────────────────────────┘
```

---

## Feature Deep Dive

### 1. AI Document Parsing

The system extracts **80+ metadata fields** from natural language descriptions using NVIDIA's LLaMA 3.1 70B model.

#### Extraction Categories

| Category | Fields |
|----------|--------|
| **Basic Info** | title, description, mediaType, aspectRatio, duration |
| **Creative Intelligence** | hookType, hookText, hookVelocity, hookKeywords, contentCategory, editingStyle, patternType |
| **Sentiment Analysis** | overallSentiment, emotionalTone |
| **Face & Emotion** | facePresence, numberOfFaces, facialEmotion |
| **Text Analysis** | hasTextOverlays, textOverlayRatio, textReadability, readabilityScore |
| **Visual Analysis** | colorScheme, colorTemperature, saliencyMapScore, sceneVelocity, shotComposition |
| **Audio Analysis** | musicType, bpm, hasVoiceover, voiceoverStyle, audioPeakTiming |
| **Script & Copy** | script, painPoints, cta, ctaText, ctaStrength, headlines |
| **Brand Consistency** | logoConsistency, logoTiming, brandColorUsage |
| **Voice Authority** | voiceAuthorityScore, voiceGender, voiceAge, speechPace |
| **Engagement Triggers** | curiosityGap, socialProofElements, urgencyTriggers, trustSignals |
| **AI Discovery** | aiDiscoveredMetrics, aiInsights, missingDataFields |

#### Parsing Logic (document-parser.ts)

```typescript
// Client calls API
const response = await fetch('/api/ai', {
  method: 'POST',
  body: JSON.stringify({
    action: 'parse-content',
    data: { rawText: userDescription }
  })
});

// API sends to NVIDIA with structured prompt
// Prompt includes exact JSON schema with 70+ fields
// AI returns structured JSON

// If AI fails, fallback to regex extraction
function extractBasicContentData(text: string): ExtractedAdData {
  // Use pattern matching for:
  // - Media type detection (video/photo/carousel)
  // - Platform detection (tiktok/instagram/etc)
  // - Hook type identification
  // - etc.
}
```

### 2. Mind Map Visualization

Interactive force-directed graph showing pattern correlations.

#### Node Types

| Type | Description | Sizing | Coloring |
|------|-------------|--------|----------|
| **Category** | Group nodes (Hook Types, Platforms, etc.) | Fixed large | Category color |
| **Trait** | Individual values (curiosity, tiktok, etc.) | By frequency | By success rate |
| **Ad** | Individual ad connections | Small | By success |

#### Success Rate Color Scale

```
0-30%   → Red (#ef4444)
30-50%  → Orange (#f97316)
50-70%  → Yellow (#eab308)
70-85%  → Light Green (#84cc16)
85-100% → Green (#22c55e)
```

#### 2D vs 3D Mode

- **2D Mode**: Canvas-based, force-directed simulation
- **3D Mode**: Adds depth dimension, rotation controls

### 3. Athena AI Chatbot

Natural language interface with full data context access.

#### Context Building (ChatBot.tsx)

```typescript
function getDataContext() {
  // Gathers ALL user data for AI context:
  return {
    totalAds: ads.length,
    platforms: { tiktok: 5, instagram: 3, ... },
    hookTypes: { curiosity: 4, question: 2, ... },
    avgPredictedScore: 68,
    avgActualScore: 72,
    adsWithResults: 15,
    topTraits: ['ugc', 'subtitles', 'trending_audio'],
    recentAds: [{ title, platform, hookType, predicted, actual }]
  };
}
```

#### Quick Prompts

- "What type of creatives should I make next?"
- "What's working best right now?"
- "Analyze my top performing ads"
- "Why did my last ad fail?"

---

## Database Schema & Data Models

### Supabase Tables

#### Table: `videos`

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloudinary_url TEXT NOT NULL,           -- Full CDN URL
  cloudinary_public_id TEXT NOT NULL,     -- For deletion/transformation
  thumbnail_url TEXT,                      -- Auto-generated thumbnail
  duration_seconds INTEGER,               -- Video length
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Table: `video_metadata`

```sql
CREATE TABLE video_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  
  -- Content Details
  script TEXT,
  hook_type TEXT NOT NULL,                -- curiosity, shock, question, etc.
  content_category TEXT NOT NULL,         -- product_demo, ugc, testimonial, etc.
  
  -- Visual Elements
  editing_style TEXT NOT NULL,            -- fast_cuts, cinematic, raw_authentic, etc.
  color_scheme TEXT NOT NULL,             -- vibrant, muted, warm, cool, etc.
  text_overlays BOOLEAN DEFAULT false,
  subtitles BOOLEAN DEFAULT false,
  
  -- Characters
  character_codes TEXT[],                 -- Actor identifiers
  number_of_actors INTEGER DEFAULT 1,
  influencer_used BOOLEAN DEFAULT false,
  ugc_style BOOLEAN DEFAULT false,
  
  -- Audio
  music_type TEXT NOT NULL,               -- trending, original, voiceover_only, etc.
  voiceover BOOLEAN DEFAULT false,
  
  -- Custom
  custom_tags TEXT[],                     -- User-defined tags
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Table: `ad_performance`

```sql
CREATE TABLE ad_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  
  -- Campaign Details
  platform TEXT NOT NULL,                 -- facebook, instagram, tiktok, etc.
  launch_date DATE,
  launch_day TEXT,                        -- monday, tuesday, etc.
  launch_time TEXT,                       -- morning, afternoon, evening, etc.
  
  -- Spend & Results
  ad_spend DECIMAL(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,             -- Click-through rate
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(6,2) DEFAULT 0,            -- Return on ad spend
  
  -- Engagement
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  
  -- User Assessment
  success_rating INTEGER CHECK (success_rating BETWEEN 1 AND 10),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Database Operations (lib/supabase.ts)

```typescript
export const db = {
  // Videos
  createVideo(data)         // Insert new video record
  getVideos()               // Get all videos, newest first
  getVideoById(id)          // Get single video
  
  // Metadata
  createMetadata(data)      // Insert video metadata
  getMetadataByVideoId(id)  // Get metadata for video
  
  // Performance
  createPerformance(data)   // Insert performance data
  getPerformanceByVideoId() // Get all performance for video
  getAllPerformance()       // Get all with joins
  
  // Combined Queries
  getFullVideoData(id)      // Video + metadata + performance
  getAllFullVideoData()     // All videos with all data
  
  // Dashboard
  getDashboardStats()       // Aggregated statistics
};
```

---

## API Reference

### POST `/api/ai`

Central AI endpoint handling multiple actions.

#### Request Format

```typescript
{
  "action": "predict" | "parse-content" | "parse-results" | 
            "analyze-mindmap" | "discover-features" | "chat",
  "data": { ... }  // Action-specific data
}
```

#### Action: `predict`

Generate AI prediction for ad configuration.

```typescript
// Request
{
  "action": "predict",
  "data": {
    "hookType": "curiosity",
    "contentCategory": "ugc",
    "editingStyle": "raw_authentic",
    "platform": "tiktok",
    "features": {
      "hasSubtitles": true,
      "hasTextOverlays": true,
      "isUGC": true,
      "hasVoiceover": false
    }
  }
}

// Response
{
  "success": true,
  "data": {
    "successProbability": 78,
    "confidence": 72,
    "keyFactors": [
      { "name": "UGC Style", "impact": "positive", "weight": 0.9 },
      { "name": "Trending Audio", "impact": "positive", "weight": 0.8 }
    ],
    "recommendations": [
      "Add trending audio to boost engagement",
      "Consider adding captions for accessibility"
    ],
    "reasoning": "UGC content on TikTok with curiosity hooks shows high engagement..."
  }
}
```

#### Action: `parse-content`

Extract structured metadata from natural language.

```typescript
// Request
{
  "action": "parse-content",
  "data": {
    "rawText": "TikTok ad for skincare, vertical video, UGC style with curiosity hook..."
  }
}

// Response: ExtractedAdData with 80+ fields
```

#### Action: `parse-results`

Extract performance metrics from results description.

```typescript
// Request
{
  "action": "parse-results",
  "data": {
    "rawText": "Spent $500, 10k impressions, 400 clicks, 4% CTR, 20 conversions..."
  }
}

// Response: ExtractedResultsData
```

#### Action: `chat`

Athena AI chatbot response.

```typescript
// Request
{
  "action": "chat",
  "data": {
    "message": "What's working best right now?",
    "context": { /* full user data context */ },
    "history": [
      { "role": "user", "content": "Hi" },
      { "role": "assistant", "content": "Hello! How can I help?" }
    ]
  }
}

// Response
{
  "success": true,
  "data": {
    "response": "Based on your data, UGC content on TikTok is performing best..."
  }
}
```

---

### POST `/api/capi/send`

Send conversion events to Facebook Conversions API.

#### Request

```typescript
{
  "datasetId": "123456789",           // REQUIRED: Facebook Dataset ID
  "accessToken": "EAABcd...",         // REQUIRED: CAPI Access Token
  "eventName": "Purchase",            // REQUIRED: Event type
  "eventId": "conv-123-abc",          // REQUIRED: Unique deduplication ID
  "eventTime": 1703000000,            // REQUIRED: Unix timestamp (seconds)
  
  // At least ONE identifier required
  "leadId": "fb_lead_123",            // Best match rate (100%)
  "email": "user@example.com",        // Will be SHA-256 hashed
  "phone": "+1234567890",             // Will be SHA-256 hashed
  
  // Optional - improves matching
  "firstName": "John",                // Will be hashed
  "lastName": "Doe",                  // Will be hashed
  "clientIpAddress": "192.168.1.1",   // Improves iOS matching
  "clientUserAgent": "Mozilla/5.0..", // Improves matching
  
  // Optional - conversion value
  "value": 99.99,
  "currency": "USD"
}
```

#### Response

```typescript
// Success
{
  "success": true,
  "message": "Conversion event sent successfully",
  "events_received": 1,
  "fbtrace_id": "ABC123..."
}

// Error
{
  "success": false,
  "error": "Dataset ID is required"
}
```

#### Available Event Names

| Event | Description |
|-------|-------------|
| `Purchase` | Payment completed |
| `Lead` | Lead captured |
| `CompleteRegistration` | Form submitted |
| `Subscribe` | User subscribed |
| `StartTrial` | Trial started |
| `Schedule` | Appointment booked |
| `Contact` | User initiated contact |
| `SubmitApplication` | Application submitted |
| `InitiateCheckout` | Checkout started |
| `AddToCart` | Item added to cart |
| `ViewContent` | Content viewed |
| `Search` | Search performed |
| `Custom` | Custom event |

---

### GET/POST `/api/webhook/facebook`

Receive Facebook webhook events.

#### Verification (GET)

```
GET /api/webhook/facebook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE

Response: CHALLENGE (if token matches)
```

#### Events (POST)

```typescript
// Leadgen Event
{
  "object": "page",
  "entry": [{
    "id": "PAGE_ID",
    "time": 1703000000,
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "LEAD_ID",
        "page_id": "PAGE_ID"
      }
    }]
  }]
}
```

---

## Machine Learning System

### Architecture Overview

The ML system is **entirely client-side**, running in the browser and persisting state to localStorage. This provides:

- **Privacy**: User data never leaves their browser
- **Speed**: No network latency for predictions
- **Offline**: Works without internet after initial load

### System Modules

#### 1. `index.ts` - Central Orchestrator

Exports unified interface and orchestrates all ML modules.

```typescript
// Main functions
getMLSystemState()                    // Get full system state
predictWithML(adData, targetSegment)  // Full prediction pipeline
learnFromResults(ad, results)         // Learning pipeline
getMLDashboard()                      // Stats for UI
```

#### 2. `model.ts` - Neural Network (TensorFlow.js)

```typescript
// Architecture: 3-layer neural network
const model = tf.sequential();
model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [17] }));
model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

// Training
trainModel(epochs, onProgress)  // Train with accumulated data
predict(metadata, campaign)     // Make prediction

// Persistence
saveModel()   // Save to IndexedDB
loadModel()   // Load from IndexedDB
```

#### 3. `features.ts` - Feature Encoding

Converts categorical features to numerical values.

```typescript
// Encoding maps with learned weights
const hookTypeMap = {
  curiosity: 0.9,      // High performing
  shock: 0.85,
  question: 0.8,
  story: 0.75,
  testimonial: 0.7,
  other: 0.5           // Default
};

// 17 features extracted:
// 1. Hook Type
// 2. Editing Style
// 3. Content Category
// 4. Color Scheme
// 5. Music Type
// 6. Text Overlays (boolean → 0.8/0.3)
// 7. Subtitles (boolean → 0.9/0.4)
// 8. UGC Style (boolean → 0.95/0.5)
// 9. Influencer Used
// 10. Voiceover
// 11. Number of Actors (normalized)
// 12. Character Variety
// 13. Tag Richness
// 14. Script Length
// 15. Platform
// 16. Launch Day
// 17. Launch Time
```

#### 4. `weight-adjustment.ts` - Dynamic Weights

```typescript
interface FeatureWeight {
  feature: string;
  category: string;
  weight: number;           // -1 to +1
  previousWeight?: number;
  confidenceLevel: number;  // 0-100
  sampleSize: number;
  lastUpdated: string;
  trend: 'rising' | 'falling' | 'stable';
  trendStrength: number;
}

// Default weights
const DEFAULT_WEIGHTS = [
  { feature: 'curiosity', category: 'hook_type', weight: 0.8, ... },
  { feature: 'ugc_style', category: 'visual', weight: 0.85, ... },
  { feature: 'subtitles', category: 'visual', weight: 0.7, ... },
  // ...20+ features
];

// Adjustment logic
function adjustWeightsForError(prediction, adData, actualScore) {
  // Calculate error direction
  const delta = actualScore - prediction.predictedScore;
  
  // Adjust weights based on what was present
  // If actual > predicted: increase weights for present features
  // If actual < predicted: decrease weights for present features
  
  // Learning rate decreases with confidence
  const learningRate = 0.1 * (1 - confidenceLevel / 100);
}
```

#### 5. `feedback-loop.ts` - Error Detection

```typescript
interface PredictionRecord {
  id: string;
  adId: string;
  predictedScore: number;
  predictedAt: string;
  actualScore?: number;
  delta?: number;
  deltaPercent?: number;
  isHighError: boolean;        // delta > 50%
  isSurpriseSuccess: boolean;  // predicted < 50, actual >= 70
  isSurpriseFailure: boolean;  // predicted >= 70, actual < 50
  correctionApplied: boolean;
}

// Analysis types
analyzePredictionResult(ad, results) → {
  needsCorrection: boolean,
  analysisType: 'surprise_success' | 'surprise_failure' | 'accurate' | 'minor_error',
  delta: number,
  recommendations: string[]
}
```

#### 6. `exploration.ts` - Epsilon-Greedy

Prevents self-fulfilling prophecies by recommending wildcards.

```typescript
interface ExplorationConfig {
  enabled: true,
  explorationRate: 0.1,      // 10% wildcards
  wildcardCount: 1,
  minScoreForWildcard: 20,   // Don't recommend terrible ideas
  maxScoreForWildcard: 50    // Wildcards should be surprising
}

// Logic
function generateWildcardRecommendations() {
  // Find low-weighted features with low sample size
  // These are "uncertain" - might be undervalued
  
  // Also find high-weighted but falling features
  // These might be overused/declining
  
  return [{
    trait: 'shaky_camera',
    description: 'Raw, shaky camera work',
    expectedScore: 35,
    explorationReason: 'Only 2 data points - needs more testing'
  }];
}
```

#### 7. `time-decay.ts` - Recency Weighting

```typescript
const TIME_DECAY_RATES = {
  thisWeek: 1.0,      // Full weight
  lastMonth: 0.8,     // 80%
  threeMonths: 0.5,   // 50%
  sixMonths: 0.3,     // 30%
  older: 0.1          // 10%
};

// Concept drift detection
function detectConceptDrift() {
  // Compare recent prediction accuracy vs historical
  // If accuracy drops significantly → patterns are changing
}
```

#### 8. `feature-discovery.ts` - Pattern Discovery

When a surprise success/failure occurs, AI discovers new patterns.

```typescript
// Trigger: surprise_success or surprise_failure
async function discoverFeaturesFromAd(ad, reason) {
  // Call AI with ad content and results
  // AI analyzes what made this ad different
  
  // Returns new features like:
  return [{
    name: 'neon_in_first_2_seconds',
    description: 'Neon color in opening frames',
    type: 'visual',
    criteria: 'Detect bright neon colors in first 2 seconds',
    correlation: 75
  }];
}
```

#### 9. `audience-segmentation.ts` - Segment Scoring

Different audiences respond differently to features.

```typescript
interface AudienceSegment {
  id: string;
  name: string;                    // "Gen Z TikTok Users"
  ageRange: { min: 18, max: 24 };
  gender: 'all';
  platforms: ['tiktok'];
  featureWeights: FeatureWeight[]; // Segment-specific weights
}

// Segment-specific scoring
getAllSegmentScores(features) → [
  { segmentId: 'gen_z', score: 85 },
  { segmentId: 'millennials', score: 72 },
  { segmentId: 'boomer', score: 45 }
]
```

#### 10. `history.ts` - Undo/Redo

```typescript
// Track all data operations
interface HistoryEntry {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'ad' | 'result' | 'weight';
  entityId: string;
  previousState: any;
  newState: any;
  timestamp: string;
}

// Operations
undoLast()   // Revert last action
redoLast()   // Redo undone action
getHistorySummary()  // Get history for UI
```

---

## AI Integration (NVIDIA NIM)

### Configuration

```typescript
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct';
```

### Request Format

```typescript
const response = await fetch(NVIDIA_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,  // Low for structured output
    max_tokens: 1024
  })
});
```

### Fallback Strategy

If NVIDIA API fails:
1. Return `{ fallback: true }` to client
2. Client uses heuristic prediction functions
3. Basic regex parsing for document extraction

---

## Facebook CAPI Integration

### Setup Flow

```
1. Facebook Login (OAuth)
   ├── User clicks "Connect Facebook"
   ├── Redirect to Facebook OAuth
   └── Returns with access_token

2. Select Page & Ad Account
   ├── GET /me/accounts → List pages
   ├── User selects page
   ├── GET /me/adaccounts → List ad accounts
   └── User selects ad account

3. Configure CAPI
   ├── User enters Dataset ID
   ├── User enters Access Token
   └── Credentials saved to localStorage

4. Test Connection
   └── Send test event to validate credentials

5. Activate
   └── Enable automatic event sending
```

### Data Hashing (capi.ts)

All PII is SHA-256 hashed before sending:

```typescript
async function sha256Hash(value: string): Promise<string> {
  const normalizedValue = value.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedValue);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalization
normalizePhone(phone) // Remove spaces, dashes, +, ()
normalizeEmail(email) // Lowercase, trim
```

### Event Matching Priority

1. **lead_id** - 100% match rate (best)
2. **email (hashed)** - ~60% match rate
3. **phone (hashed)** - ~40% match rate
4. **Multiple identifiers** - Improves match rate

### Attribution Windows

| Type | Window |
|------|--------|
| Click-through | 7 days |
| View-through | 1 day |

> **Important**: Conversions outside these windows will NOT be attributed, regardless of CAPI correctness.

### Token Lifecycle & Expiry

> [!WARNING]
> **Tokens expire!** Marketing API and CAPI tokens have limited lifespans. Events will silently fail when tokens expire.

#### Token Types

| Token Type | Lifespan | Use Case |
|------------|----------|----------|
| **Short-lived** | ~1-2 hours | Initial OAuth login |
| **Long-lived** | ~60 days | Extended access |
| **System User Token** | Never expires | Server-to-server (recommended for CAPI) |

#### When Tokens Expire

**Symptoms:**
- CAPI events return `error.code: 190` (Invalid OAuth access token)
- Events Manager shows no new events
- No error visible in Athena UI (silent failure)

**Error Response Example:**
```json
{
  "error": {
    "message": "Error validating access token: Session has expired",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463
  }
}
```

#### How to Regenerate Tokens

**Option 1: User Token (60-day)**
1. Go to [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Generate User Token with required permissions
4. Exchange for long-lived token:
```bash
GET /oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={app-id}&
  client_secret={app-secret}&
  fb_exchange_token={short-lived-token}
```

**Option 2: System User Token (Recommended)**
1. Go to Business Settings → System Users
2. Create system user with Admin role
3. Assign assets (Ad Account, Dataset)
4. Generate token — this token never expires

#### Where to Update in Athena

1. Go to **Settings** → **Facebook CAPI**
2. Enter new Access Token
3. Click **Test Connection**
4. If successful, click **Save**

### Meta Permissions Matrix

> [!IMPORTANT]
> Request only the permissions you need. Meta app review requires justification for each permission.

| Feature | API | Permission | Required For |
|---------|-----|------------|--------------|
| Read user pages | Graph API | `pages_show_list` | Selecting Facebook page |
| Manage pages | Graph API | `pages_manage_metadata` | Webhooks setup |
| Read ad accounts | Marketing API | `ads_read` | Listing ad accounts |
| Read ad creatives | Marketing API | `ads_read` | Fetching ad content |
| **Send conversions** | **CAPI** | `ads_management` | **Core CAPI functionality** |
| Receive webhooks | Graph API | `pages_manage_metadata` | Lead/message webhooks |
| Messaging | Graph API | `pages_messaging` | Reading DMs (if needed) |

#### Minimum Permissions for CAPI Only

```
pages_show_list
ads_read
ads_management
```

#### Full Integration Permissions

```
pages_show_list
pages_manage_metadata
pages_messaging
ads_read
ads_management
```

### Offline Dataset Setup (Meta Business Suite)

> [!CAUTION]
> **#1 Failure Point**: If your Dataset is not assigned to your Ad Account, conversions will never attribute to campaigns, even if CAPI sends events successfully.

#### Step 1: Create Offline Event Set (Dataset)

1. Go to [Events Manager](https://business.facebook.com/events_manager)
2. Click **Connect Data Sources** → **Offline**
3. Name your dataset (e.g., "Athena Conversions")
4. Click **Create**
5. Copy the **Dataset ID** (you'll need this in Athena)

#### Step 2: Assign Dataset to Ad Account

**This step is critical!**

1. In Events Manager, click your dataset
2. Go to **Settings** tab
3. Scroll to **Linked Assets**
4. Click **Add Assets** → **Ad Accounts**
5. Select your ad account
6. Click **Add**

#### Step 3: Verify Assignment

1. Go to your Ad Account settings
2. Look for "Offline Event Sets" or "Datasets"
3. Confirm your dataset appears

#### Step 4: Configure in Athena

1. Go to **Settings** → **Facebook CAPI**
2. Enter your **Dataset ID**
3. Enter your **Access Token**
4. Click **Test Connection**

### ⚠️ Campaign Optimization Rules

> [!CAUTION]
> **CRITICAL**: The event you send MUST match the event your campaign optimizes for. Mismatched events are **silently ignored** by Meta.

#### The Rule

```
Campaign Optimization Event === CAPI Event Name
```

#### Examples

| Campaign Optimizes For | CAPI Event to Send | Result |
|------------------------|-------------------|--------|
| **Leads** | `Lead` | ✅ Attributed |
| **Leads** | `Contact` | ❌ Ignored |
| **Leads** | `Purchase` | ❌ Ignored |
| **Purchase** | `Purchase` | ✅ Attributed |
| **Purchase** | `Lead` | ❌ Ignored |
| **Complete Registration** | `CompleteRegistration` | ✅ Attributed |

#### How to Check Campaign Optimization

1. Go to Ads Manager
2. Select your campaign
3. Look at the **Optimization Goal** setting
4. Match your CAPI event name exactly

#### Common Mistake

Setting up a "Lead" campaign but sending "Contact" events when users message you.

**Fix**: Either change your campaign to optimize for "Contact" OR change your CAPI event to "Lead".

### Conversion State Machine

> [!IMPORTANT]
> Meta expects **one immutable conversion per outcome**. Do not send multiple events for the same conversion.

#### Lead Lifecycle Diagram

```
                                    ┌─────────────────┐
                                    │   Ad Clicked    │
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LEAD CREATED                                 │
│                                                                      │
│   ✅ Fire: Lead event                                                │
│   📍 When: First contact/form submission                            │
│   🔑 event_id: lead_{internal_id}                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Qualified│  │Disqualified│  │ No Show │
        │          │  │           │  │         │
        │ ❌ No    │  │ ❌ No     │  │ ❌ No   │
        │   event  │  │   event   │  │  event  │
        └────┬─────┘  └───────────┘  └─────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DEAL WON / PURCHASE                             │
│                                                                      │
│   ✅ Fire: Purchase event                                            │
│   📍 When: Payment received / deal closed                           │
│   🔑 event_id: purchase_{internal_id}                               │
│   💰 Include: value, currency                                       │
└─────────────────────────────────────────────────────────────────────┘
```

#### When to Fire Each Event

| Internal State | Fire Event? | Event Name | Notes |
|----------------|-------------|------------|-------|
| Lead created | ✅ Yes | `Lead` | First capture only |
| Lead qualified | ❌ No | — | Internal state, not a conversion |
| Appointment scheduled | ✅ Yes | `Schedule` | If optimizing for appointments |
| No-show / cancelled | ❌ No | — | Don't "undo" conversions |
| Trial started | ✅ Yes | `StartTrial` | If optimizing for trials |
| Payment successful | ✅ Yes | `Purchase` | Include value |
| Payment failed | ❌ No | — | Not a conversion |
| Subscription renewed | ❌ No* | — | *Only if separate campaigns |

#### Rules

1. **One event per `event_id`** — Never re-send the same conversion
2. **Immutable** — Don't update or delete sent events
3. **Forward-only** — States move forward, not backward
4. **Real-world moment** — Event time = when action happened, not when sent

### Failure Debugging Guide

#### Where to Check for Failures

**1. Meta Events Manager**
```
Business Suite → Events Manager → Your Dataset → Overview
```

Look for:
- **Events Received**: Total events received (even unmatched)
- **Match Rate**: % of events matched to Meta users
- **Test Events**: Real-time event debugging

**2. Test Events Tool**
```
Events Manager → Your Dataset → Test Events
```

- Enter test event code
- Send a test conversion from Athena
- See real-time payload and errors

**3. Athena API Response**

Check for `fbtrace_id` in successful responses:
```json
{
  "success": true,
  "events_received": 1,
  "fbtrace_id": "ABC123xyz..."
}
```

Use `fbtrace_id` to debug with Meta support.

#### Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `190` | Invalid access token | Regenerate token (see Token Lifecycle) |
| `100` | Invalid parameter | Check event payload format |
| `200` | Permissions error | Check app permissions |
| `1` | Unknown error | Check `fbtrace_id`, contact support |
| `17` | Rate limit | Reduce request frequency |

#### Debugging Checklist

- [ ] Token is valid and not expired
- [ ] Dataset ID is correct
- [ ] Dataset is assigned to Ad Account
- [ ] Event name matches campaign optimization
- [ ] `event_id` is unique per conversion
- [ ] `event_time` is within attribution window
- [ ] At least one identifier (lead_id, email, or phone) is provided
- [ ] Events Manager shows events being received

#### Silent Failure Scenarios

| Scenario | Events Manager Shows | Attribution | Fix |
|----------|---------------------|-------------|-----|
| Token expired | No new events | None | Regenerate token |
| Dataset not assigned | Events received | None | Assign dataset to ad account |
| Wrong event name | Events received | None | Match campaign optimization |
| Outside attribution window | Events received | None | Send events sooner |
| No identifiers | Events received (0% match) | None | Add lead_id, email, or phone |

---

## Components Architecture

### Sidebar.tsx

Collapsible navigation component.

```typescript
// Features
- Auto-collapse on mobile (<768px)
- Manual collapse toggle
- Active route highlighting
- Icon-only mode when collapsed
- localStorage persistence for collapse state

// Routes
'/'          → Dashboard
'/upload'    → Upload
'/predict'   → Predict
'/analytics' → Analytics
'/mindmap'   → Mind Map
'/videos'    → Video Library
'/settings'  → Settings
'/pipeline'  → Pipeline
```

### ChatBot.tsx

Floating AI assistant.

```typescript
// Features
- Minimized/expanded states
- Message history
- Quick prompt suggestions
- Context-aware responses
- Typing indicator
- Auto-scroll to latest message

// State
const [messages, setMessages] = useState<Message[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [isMinimized, setIsMinimized] = useState(true);
```

### FacebookLogin.tsx

OAuth component for Facebook integration.

```typescript
// Features
- Facebook SDK initialization
- OAuth login flow
- Page and ad account selection
- CAPI configuration form
- Connection testing
- Disconnect functionality
```

### UndoPanel.tsx

ML history management panel.

```typescript
// Features
- View undo/redo history
- Undo last action
- Redo undone action
- Clear history
- Filter by entity type
```

---

## Type System

### Core Types (types/index.ts)

**713 lines** of TypeScript type definitions organized into:

1. **Database Models** (3-75)
   - Video, VideoMetadata, AdPerformance

2. **Enum Types** (77-166)
   - HookType (13 values)
   - ContentCategory (12 values)
   - EditingStyle (9 values)
   - ColorScheme (10 values)
   - MusicType (9 values)
   - Platform (9 values)
   - DayOfWeek, TimeOfDay

3. **Document System** (219-479)
   - MediaType, AspectRatio, AdPlacement, CTAType
   - ContentDocument, ResultsDocument
   - ExtractedAdData (80+ fields)
   - ExtractedResultsData
   - AdEntry (combined)

4. **Mind Map Types** (481-544)
   - MindMapNode, MindMapConnection
   - MindMapCategory, DiscoveredPattern

5. **ML System Types** (546-713)
   - PredictionRecord
   - FeatureWeight
   - DiscoveredMLFeature
   - AudienceSegment
   - TimeDecayConfig, ExplorationConfig
   - MLSystemState
   - WeightAdjustmentEvent

---

## File Structure

```
ads-algorithm-app/
├── app/                           # Next.js App Router (17 routes)
│   ├── page.tsx                   # Dashboard (/)
│   ├── page.module.css
│   ├── layout.tsx                 # Root layout with Sidebar
│   ├── globals.css                # Design tokens + responsive
│   │
│   ├── api/                       # API Routes (18 directories)
│   │   ├── ai/                    # AI endpoint + recommendations + agent
│   │   ├── capi/                  # CAPI event sending
│   │   ├── categories/            # Trait categories
│   │   ├── collective/            # Collective intelligence
│   │   ├── contacts/              # Contact management
│   │   ├── data-pools/            # Data pool operations
│   │   ├── facebook/              # Facebook OAuth + Ads + Insights
│   │   ├── organizer/             # Admin user management
│   │   ├── pool/                  # Pool operations
│   │   ├── sync/                  # Background sync
│   │   ├── traits/                # Dynamic traits
│   │   └── webhook/               # Facebook webhook receiver
│   │
│   ├── admin/                     # /admin - Admin panel
│   ├── athena/                    # /athena - Agent interface
│   ├── create-ad/                 # /create-ad - Campaign builder
│   ├── import/                    # /import - Ad import
│   ├── login/                     # /login - Authentication
│   ├── marketplace/               # /marketplace - Data pools
│   ├── mindmap/                   # /mindmap - Visualization
│   ├── myads/                     # /myads - Ad library
│   ├── organizer/                 # /organizer - User management
│   ├── pipeline/                  # /pipeline - CRM
│   ├── predict/                   # /predict - Predictions
│   ├── results/                   # /results - Results input
│   ├── settings/                  # /settings - Configuration
│   ├── upload/                    # /upload - Media upload
│   └── videos/                    # /videos - Video library
│
├── components/                    # React Components (18+)
│   ├── Sidebar.tsx                # Navigation
│   ├── ChatBot.tsx                # AI Assistant
│   ├── FacebookLogin.tsx          # OAuth Component
│   ├── UndoPanel.tsx              # History Management
│   ├── AdQualityScore.tsx         # Quality scoring display
│   ├── BackgroundSyncProvider.tsx # Global sync
│   ├── SyncIndicator.tsx          # Sync status
│   ├── NotificationBell.tsx       # Notifications
│   ├── DailyReportsViewer.tsx     # Reports
│   ├── RoleGate.tsx               # RBAC protection
│   ├── ThemeProvider.tsx          # Theme context
│   └── ...
│
├── lib/                           # Core Libraries
│   ├── supabase.ts                # Database operations
│   ├── cloudinary.ts              # Media upload
│   ├── capi.ts                    # Facebook CAPI
│   ├── athena-agent.ts            # Agent system (2700+ lines)
│   ├── collective-intelligence.ts # Shared learning
│   ├── contacts-store.ts          # Contact management
│   ├── prediction-utils.ts        # Prediction utilities
│   ├── rbac.ts                    # Role-based access
│   ├── auth.ts                    # Authentication
│   ├── sync.ts                    # Sync utilities
│   │
│   ├── ai/                        # AI Integration (24 modules)
│   │   ├── nvidia-ai.ts           # NVIDIA NIM client
│   │   ├── document-parser.ts     # AI parsing
│   │   ├── agent-runner.ts        # Multi-step agent
│   │   ├── agent-tools.ts         # Agent tools
│   │   ├── anomaly-detection.ts   # Anomaly detection
│   │   ├── creative-fatigue.ts    # Fatigue detection
│   │   ├── forecasting.ts         # Performance prediction
│   │   ├── pattern-mining.ts      # Pattern extraction
│   │   ├── guardrails.ts          # Safety checks
│   │   └── ...
│   │
│   └── ml/                        # ML System (19 modules)
│       ├── index.ts               # Orchestrator
│       ├── model.ts               # TensorFlow.js
│       ├── features.ts            # Feature encoding
│       ├── campaign-optimizer.ts  # Campaign recommendations
│       ├── risk-assessment.ts     # Risk scoring
│       ├── failure-taxonomy.ts    # Failure patterns
│       ├── success-normalization.ts # Success scoring
│       ├── seasonality.ts         # Time patterns
│       └── ...
│
├── types/                         # TypeScript Types
│   ├── index.ts                   # Core types
│   ├── extended-ad.ts             # Extended ad types
│   └── ad-quality-types.ts        # Quality scoring types
│
├── hooks/                         # Custom React Hooks
├── supabase/                      # Supabase migrations
├── public/                        # Static Assets
│
├── .env.local                     # Environment variables
├── package.json
├── tsconfig.json
├── next.config.ts
└── SYSTEM_DOCUMENTATION.md        # This file (2990+ lines)
```

---

## Environment Setup

### Required Environment Variables

Create `.env.local` in project root:

```env
# NVIDIA AI API (REQUIRED)
NVIDIA_API_KEY=nvapi-xxxx...

# Cloudinary (REQUIRED)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ads_algorithm

# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Facebook (OPTIONAL - for CAPI integration)
NEXT_PUBLIC_FACEBOOK_APP_ID=123456789
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your-secret-token
```

### Service Configuration

#### Cloudinary Setup

1. Sign up at https://cloudinary.com
2. Go to Dashboard → Settings → Upload
3. Create unsigned upload preset named `ads_algorithm`
4. Copy Cloud Name from Dashboard

#### Supabase Setup

1. Sign up at https://supabase.com
2. Create new project
3. Run the database schema SQL (see Database Schema section)
4. Copy Project URL and anon key from Settings → API

#### NVIDIA NIM Setup

1. Sign up at https://build.nvidia.com
2. Generate API key
3. Ensure access to `nvidia/llama-3.1-nemotron-70b-instruct` model

#### Facebook Developer Setup

1. Create app at https://developers.facebook.com
2. Add Facebook Login product
3. Configure OAuth redirect URLs
4. Set webhook callback: `https://your-domain.com/api/webhook/facebook`
5. Subscribe to leadgen, messaging fields

---

## Development Guide

### Getting Started

```bash
# Clone repository
git clone <repo-url>
cd ads-algorithm-app

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev

# Open http://localhost:3000
```

### Commands

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Adding New Features

#### New Page

```bash
# Create directory
mkdir app/new-page

# Create files
touch app/new-page/page.tsx
touch app/new-page/page.module.css
```

```typescript
// app/new-page/page.tsx
'use client';

import styles from './page.module.css';

export default function NewPage() {
  return (
    <div className={styles.container}>
      <h1>New Page</h1>
    </div>
  );
}
```

#### New API Route

```bash
mkdir -p app/api/new-endpoint
touch app/api/new-endpoint/route.ts
```

```typescript
// app/api/new-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Hello' });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ received: body });
}
```

#### New ML Feature

1. Add feature to `types/index.ts`
2. Add encoding to `lib/ml/features.ts`
3. Add default weight to `lib/ml/weight-adjustment.ts`
4. Update extraction prompt in `app/api/ai/route.ts`

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production deploy
vercel --prod
```

### Environment Variables

Set all environment variables in Vercel dashboard:
Project Settings → Environment Variables

### Post-Deployment

1. Update Facebook OAuth redirect URLs
2. Set webhook URL: `https://your-app.vercel.app/api/webhook/facebook`
3. Verify webhook in Facebook Developer Console

---

## Athena AI Upgrade System

### Overview

The Athena AI Upgrade is a comprehensive enhancement to the platform's AI capabilities, adding closed-loop recommendations, confidence scoring, data quality monitoring, anomaly detection, and multi-step agent workflows with safety guardrails.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ATHENA AI UPGRADE SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   Agent     │    │  Guardrails │    │  Anomaly    │            │
│  │   Runner    │───►│   System    │───►│  Detection  │            │
│  │             │    │  (7 checks) │    │  (6 metrics)│            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│         │                                      │                   │
│         ▼                                      ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │  Agent      │    │   Data      │    │  Evaluation │            │
│  │  Tools (5)  │    │   Health    │    │  (p-value)  │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│         │                                      │                   │
│         ▼                                      ▼                   │
│  ┌─────────────────────────────────────────────────────┐          │
│  │              RECOMMENDATIONS ENGINE                  │          │
│  │  Confidence Scoring • Evidence Citation • Auto-Apply │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Schema (athena_upgrade_schema.sql)

8 new tables added to Supabase:

| Table | Purpose |
|-------|---------|
| `athena_recommendations` | Stores AI recommendations with confidence, evidence, status |
| `recommendation_events` | Audit trail for recommendation lifecycle |
| `evaluation_runs` | Before/after impact analysis results |
| `data_health_scores` | Data quality metrics per entity |
| `anomalies` | Detected performance anomalies |
| `agent_runs` | Multi-step agent execution logs |
| `prompt_versions` | Prompt A/B testing with performance tracking |
| `user_ai_preferences` | User KPI settings, constraints, alerts |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/recommendations` | GET/POST/PATCH | CRUD for recommendations |
| `/api/ai/recommendations/[id]` | GET/POST | Single rec + feedback |
| `/api/ai/health` | GET/POST | Data quality scoring |
| `/api/ai/agent/run` | POST | Execute agent workflow |
| `/api/ai/agent/runs` | GET/POST | Agent run history |
| `/api/ai/anomalies` | GET/POST/PATCH | Anomaly detection & management |
| `/api/ai/evaluations` | GET/POST | Impact evaluation |
| `/api/ai/prompts` | GET/POST/PATCH | Prompt versioning |
| `/api/ai/preferences` | GET/POST | User AI preferences |

### Core Modules

#### 1. Guardrails System (`lib/ai/guardrails.ts`)

7 safety checks to prevent harmful recommendations:

| Guardrail | Severity | Description |
|-----------|----------|-------------|
| `learning_phase` | Block | Requires 50+ conversions before changes |
| `sample_size` | Block | Minimum 500-1000 impressions required |
| `top_converter_protection` | Block | Cannot pause top performers (ROAS > 2) |
| `tracking_health` | Block | Cannot scale when tracking is broken |
| `budget_limit` | Warning | Budget changes should not exceed 50% |
| `action_blocklist` | Block | Respects user "never recommend" list |
| `minimum_spend` | Block | Entity must have spend data |

#### 2. Agent Tools (`lib/ai/agent-tools.ts`)

5 structured tools for multi-step reasoning:

| Tool | Purpose |
|------|---------|
| `fetch_metrics` | Get performance metrics for entities |
| `validate_data_health` | Check data quality before recommendations |
| `check_guardrails` | Verify action safety |
| `get_historical_benchmarks` | Get historical baselines for comparison |
| `generate_recommendation` | Create structured recommendation |

#### 3. Agent Runner (`lib/ai/agent-runner.ts`)

6-step workflow:

1. **Fetch Metrics** - Get current performance data
2. **Validate Health** - Check data quality (must be ≥70)
3. **Get Benchmarks** - Compare to historical baselines
4. **Analyze** - Determine recommendation type (scale/pause/optimize)
5. **Check Guardrails** - Verify safety of proposed action
6. **Generate Recommendation** - Create with confidence score + evidence

#### 4. Anomaly Detection (`lib/ai/anomaly-detection.ts`)

Detects 6 types of anomalies with seasonality awareness:

| Anomaly Type | Metric | Threshold Logic |
|--------------|--------|-----------------|
| `spend_spike` | Spend | >30% above baseline |
| `cpa_spike` | CPA | >20% above baseline |
| `roas_drop` | ROAS | <20% below baseline |
| `ctr_drop` | CTR | <25% below baseline |
| `tracking_break` | Conversions | >50% drop (flags as tracking issue) |
| `creative_fatigue` | CTR | Declining CTR + stable impressions |

Severity levels: `low`, `medium`, `high`, `critical`

#### 5. Evaluation Engine (`lib/ai/evaluation.ts`)

Before/after impact analysis with statistical significance:

- 7-day before and 7-day after windows
- P-value calculation using normal approximation
- Significance threshold: p < 0.05
- Outcomes: `positive`, `negative`, `neutral`, `insufficient_data`
- Brier score calibration for confidence accuracy

#### 6. Confidence Calibration (`lib/ai/confidence-calibration.ts`)

Adjusts confidence scores based on historical accuracy:

- Bucket-based calibration (0-0.2, 0.2-0.4, etc.)
- Brier score calculation for calibration quality
- Automatic adjustment factors based on actual vs predicted accuracy

#### 7. Auto-Apply (`lib/ai/auto-apply.ts`)

Automatically applies high-confidence recommendations:

| Check | Description |
|-------|-------------|
| `enabled` | User must opt-in |
| `minConfidence` | Calibrated confidence ≥ 90% |
| `guardrailsPass` | All guardrails must pass |
| `dailyLimit` | Max 5 auto-applies per day |
| `excludedActions` | Never auto-apply pause/delete |
| `excludedEntities` | User-defined protected entities |

### UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TopActionsPanel` | Dashboard | Shows top 5 ranked recommendations |
| `AlertCenter` | Dashboard | Severity-based anomaly alerts |
| `RecommendationCard` | Dashboard | Individual rec with accept/reject/apply |
| `DataHealthBadge` | Various | Color-coded health indicator |
| `AIPreferencesPanel` | Settings | KPI/constraint configuration |

### Confidence Scoring

Recommendations include confidence scores based on:

```typescript
confidence = (
  0.3 × dataPoints/100 +      // More data = higher confidence
  0.2 × varianceScore +       // Low variance = higher confidence
  0.2 × completeness +        // Complete data = higher confidence
  0.2 × healthScore/100 +     // Healthy tracking = higher confidence
  0.1 × historicalSuccess     // Past accuracy = higher confidence
)
```

### Integration

Components are integrated into:

1. **Dashboard (`app/page.tsx`)**:
   - `AlertCenter` - Shows open anomalies
   - `TopActionsPanel` - Shows pending recommendations

2. **Settings (`app/settings/page.tsx`)**:
   - `AIPreferencesPanel` - User AI configuration

### Usage

```typescript
// Run agent to generate recommendations
const result = await runAgent({
  query: 'Analyze my ads',
  orgId: userId,
  userId: userId,
  entityIds: ['ad_1', 'ad_2']
});

// Check guardrails before action
const safety = await checkAllGuardrails({
  entity: { id: 'ad_1', type: 'ad', metrics: {...} },
  actionType: 'pause',
  orgContext: { orgId: userId }
});

// Run anomaly detection
const anomalies = await runAnomalyDetection(userId);
```

---

## Athena Agent System

The Athena Agent transforms the AI assistant from a passive responder to an **active executor**. It can perform 40+ actions through natural language commands, enabling users to manage their advertising ecosystem without leaving the chat interface.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ATHENA AGENT SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Message → Intent Parser → Action Matcher → Confirmation → Executor   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     ACTION REGISTRY (40+ Actions)                    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  AD MANAGEMENT         FACEBOOK INTEGRATION    PIPELINE OPS         │   │
│  │  ├── import_ads        ├── pause_fb_ad         ├── create_pipeline  │   │
│  │  ├── delete_ad         ├── resume_fb_ad        ├── move_lead        │   │
│  │  ├── delete_ads_bulk   ├── update_budget       ├── show_insights    │   │
│  │  ├── list_ads          ├── create_fb_campaign  └── export_data      │   │
│  │  ├── get_ad_details    ├── create_fb_adset                          │   │
│  │  ├── archive_ad        ├── upload_ad_image                          │   │
│  │  ├── restore_ad        ├── create_ad_creative                       │   │
│  │  ├── sort_ads          └── create_full_ad                           │   │
│  │  ├── filter_ads                                                      │   │
│  │  └── bulk_update_ads   TRAITS & ANALYSIS       SEARCH               │   │
│  │                        ├── add_custom_trait    └── search_trends    │   │
│  │                        └── analyze patterns                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Action Categories

#### 1. Ad Management Actions

| Action | Description | Confirmation |
|--------|-------------|--------------|
| `import_ads` | Import ads from Facebook | No |
| `delete_ad` | Delete a specific ad | Yes |
| `delete_ads_bulk` | Delete multiple ads | Yes |
| `list_ads` | List ads with optional filters | No |
| `get_ad_details` | Get detailed ad information | No |
| `archive_ad` | Archive an ad | No |
| `restore_ad` | Restore archived ad | No |
| `sort_ads` | Sort ads by criteria | No |
| `filter_ads` | Filter ads by conditions | No |
| `bulk_update_ads` | Update multiple ads | Yes |

#### 2. Facebook Integration Actions

| Action | Description | Confirmation |
|--------|-------------|--------------|
| `pause_fb_ad` | Pause a Facebook ad | Yes |
| `resume_fb_ad` | Resume a paused ad | Yes |
| `update_budget` | Update ad set budget | Yes |
| `create_fb_campaign` | Create new campaign | Yes |
| `create_fb_adset` | Create new ad set | Yes |
| `upload_ad_image` | Upload image to Facebook | No |
| `create_ad_creative` | Create ad creative | Yes |
| `create_full_ad` | Create complete ad | Yes |

#### 3. Pipeline & CRM Actions

| Action | Description | Confirmation |
|--------|-------------|--------------|
| `create_pipeline` | Create new pipeline | No |
| `move_lead` | Move lead between stages | Yes |
| `show_insights` | Show analytics insights | No |
| `export_data` | Export ads/analytics | No |

#### 4. Traits & Analysis Actions

| Action | Description | Confirmation |
|--------|-------------|--------------|
| `add_custom_trait` | Add new custom trait | No |
| `search_trends` | Search web for trends | No |

### Intent Parsing

The agent uses pattern matching to identify user intent:

```typescript
const INTENT_PATTERNS: Record<ActionName, RegExp[]> = {
  pause_fb_ad: [
    /pause\s+(the\s+)?ad/i,
    /stop\s+(the\s+)?ad/i,
    /turn\s+off\s+(the\s+)?ad/i
  ],
  update_budget: [
    /update\s+(the\s+)?budget/i,
    /change\s+(the\s+)?budget/i,
    /set\s+(the\s+)?budget\s+to/i
  ],
  // ... more patterns
};
```

### Usage Examples

```typescript
// Natural language commands the agent understands:

"Pause my worst performing ad"
// → pause_fb_ad action with lowest ROAS ad

"Create a new campaign for skincare products"
// → create_fb_campaign with extracted targeting

"Import my Facebook ads"
// → import_ads action

"Delete all ads with less than 1% CTR"
// → delete_ads_bulk with filter condition

"Update the budget to $50 for my summer campaign"
// → update_budget with new amount
```

### Confirmation Workflow

Actions marked with `requiresConfirmation: true` trigger a confirmation UI:

```typescript
interface ParsedIntent {
  action: ActionName;
  parameters: Record<string, unknown>;
  confidence: number;
  requiresConfirmation: boolean;
  confirmationMessage?: string;  // Human-readable confirmation
}
```

---

## Campaign Builder & Templates

The Campaign Builder enables creation of complete Facebook campaigns with multiple ad sets and ads, along with reusable campaign templates.

### Multi-Level Campaign Structure

```
Campaign
├── Campaign Settings
│   ├── Name
│   ├── Objective (TRAFFIC, CONVERSIONS, LEADS, etc.)
│   └── Special Ad Category (NONE, HOUSING, CREDIT, etc.)
│
├── Ad Set 1
│   ├── Name
│   ├── Daily Budget
│   ├── Targeting
│   │   ├── Age Range (min-max)
│   │   ├── Gender (all/male/female)
│   │   ├── Countries
│   │   └── Interests
│   │
│   ├── Ad 1
│   │   ├── Media (video/photo)
│   │   ├── Primary Text
│   │   ├── Headline
│   │   ├── Description
│   │   ├── CTA
│   │   └── Website URL
│   │
│   └── Ad 2...
│
└── Ad Set 2...
```

### Campaign Templates

Save and reuse campaign configurations:

```typescript
interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  campaign: {
    name: string;
    objective: string;
    specialAdCategory: string;
  };
  adSets: Array<{
    name: string;
    dailyBudget: number;
    targeting: TargetingConfig;
    ads: Array<AdConfig>;
  }>;
}
```

### AI Recommendations Integration

The Campaign Builder integrates with the Campaign Optimizer to provide:

- Placement recommendations with confidence scores
- Ad copy suggestions based on historical performance
- Budget type recommendations (daily vs lifetime)
- Flexible ads format recommendations
- Historical performance benchmarks

### Step Wizard

1. **Analyze Content** - Describe your ad and get AI trait extraction
2. **View Recommendations** - See AI-powered suggestions
3. **Configure Campaign** - Set campaign-level settings
4. **Configure Ad Sets** - Add targeting and budgets
5. **Configure Ads** - Add creative content
6. **Review & Create** - Final review before creation

---

## Ad Quality Scoring System

A chess-inspired quality analysis system that evaluates ad creatives and provides actionable feedback.

### Scoring Methodology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AD QUALITY ANALYSIS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │  BLUNDERS   │   │  MISTAKES   │   │INACCURACIES│   │  POSITIVES  │    │
│  │   (−20)     │   │   (−10)     │   │    (−5)    │   │   (+10)     │    │
│  │   🔴 Red    │   │  🟠 Orange  │   │  🟡 Yellow │   │  🟢 Green   │    │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘    │
│                                                                             │
│  Starting Score: 100  →  Final Score: 100 - penalties + bonuses            │
│                                                                             │
│  GRADES:                                                                    │
│  A (90-100) │ B (75-89) │ C (60-74) │ D (40-59) │ F (0-39)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Issue Severity Types

| Severity | Icon | Impact | Description |
|----------|------|--------|-------------|
| **Blunder** | 🔴 | -20 points | Critical mistake that significantly harms performance |
| **Mistake** | 🟠 | -10 points | Notable error that reduces effectiveness |
| **Inaccuracy** | 🟡 | -5 points | Minor issue with room for improvement |

### Positive Categories

| Category | Icon | Impact | Description |
|----------|------|--------|-------------|
| **Excellent** | ⭐ | +10 points | Outstanding best practice implementation |
| **Good** | ✅ | +5 points | Solid technique or approach |
| **Decent** | 👍 | +2 points | Above average element |

### Victory Chance

Inspired by chess engine analysis, provides a success probability:

```typescript
interface AdQualityAnalysis {
  overallScore: number;        // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  victoryChance: number;       // 0-100% success probability
  issues: QualityIssue[];
  positives: QualityPositive[];
  summary: string;
}
```

### Integration Points

- **Upload Page**: Auto-analyze on content extraction
- **MyAds Page**: Quality badge on ad cards
- **Webhook Handler**: Analyze imported ads automatically

---

## Pipeline CRM System

A lead management system with customizable stage-based workflows and Facebook integration.

### Pipeline Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE CRM                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐     │
│  │   NEW      │───▶│ QUALIFIED  │───▶│  BOOKED    │───▶│   CLOSED   │     │
│  │   LEAD     │    │            │    │            │    │   (GOAL)   │     │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘     │
│       │                 │                  │                  │            │
│       │                 │                  │                  │            │
│       ▼                 ▼                  ▼                  ▼            │
│    [Lead]            [Lead]             [Lead]            [Send CAPI      │
│    Event             Event              Event             Conversion]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Goal Presets

| Goal | Icon | Description |
|------|------|-------------|
| Appointment Booked | 📅 | Track until appointment scheduled |
| Sale Completed | 💰 | Track until purchase made |
| Trial Started | 🚀 | Track until trial begins |
| Quote Requested | 📝 | Track until quote sent |
| Custom Goal | ⚙️ | Define your own conversion |

### Stage Configuration

```typescript
interface Stage {
  id: string;
  name: string;
  isGoal: boolean;          // Final conversion stage
  isAutoCreated: boolean;   // System-generated
  leadCount: number;
  facebookEvent?: string;   // CAPI event to fire
  description?: string;
}
```

### Facebook CAPI Integration

When a lead reaches a goal stage, the system can automatically fire CAPI conversion events:

1. Configure stage with Facebook event type
2. Lead moves to goal stage
3. CAPI event automatically sent with lead data
4. Conversion attributed back to original ad

### Contact Import

Import contacts directly from Facebook Messenger:

```typescript
interface FetchedContact {
  conversationId: string;
  facebookPsid: string;
  name: string;
  email?: string;
  isFromAd: boolean;
  messageCount: number;
  messages: Message[];
}
```

---

## Advanced ML Modules

The ML system includes 19 specialized modules for comprehensive ad performance analysis.

### Module Overview

| Module | Size | Purpose |
|--------|------|---------|
| `index.ts` | 8KB | Central orchestrator |
| `model.ts` | 9KB | TensorFlow.js neural network |
| `features.ts` | 10KB | Feature encoding |
| `weight-adjustment.ts` | 10KB | Dynamic weight updates |
| `feedback-loop.ts` | 6KB | Error detection & learning |
| `campaign-optimizer.ts` | 34KB | Multi-factor campaign recommendations |
| `risk-assessment.ts` | 17KB | Risk scoring and mitigation |
| `failure-taxonomy.ts` | 19KB | Failure pattern classification |
| `success-normalization.ts` | 15KB | Standardized success scoring |
| `seasonality.ts` | 9KB | Time-based pattern detection |
| `pattern-learning.ts` | 9KB | Cross-ad pattern discovery |
| `historical-performance.ts` | 6KB | Historical baseline tracking |
| `score-recalculation.ts` | 9KB | Dynamic score updating |
| `feature-eligibility.ts` | 9KB | Feature validation rules |
| `exploration.ts` | 7KB | Epsilon-greedy exploration |
| `time-decay.ts` | 5KB | Recency weighting |
| `audience-segmentation.ts` | 9KB | Segment-specific scoring |
| `history.ts` | 8KB | Undo/redo operations |
| `feature-discovery.ts` | 7KB | AI-powered pattern discovery |

### Campaign Optimizer

The largest ML module (34KB) provides comprehensive campaign recommendations:

```typescript
interface CampaignRecommendations {
  placement: {
    recommended: string[];
    confidence: number;
    reasoning: string;
  };
  adCopy: {
    headlines: string[];
    descriptions: string[];
    confidence: number;
  };
  budgetType: {
    recommended: 'daily' | 'lifetime';
    confidence: number;
    historicalData: BudgetPerformance[];
  };
  flexibleAds: {
    recommended: boolean;
    confidence: number;
  };
  aggregateStats: {
    totalAdsAnalyzed: number;
    avgROAS: number;
    avgCTR: number;
    topTraits: string[];
  };
}
```

### Risk Assessment

Evaluates potential risks before campaign launch:

```typescript
interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;  // 0-100
  factors: RiskFactor[];
  mitigations: string[];
  recommendations: string[];
}
```

### Success Normalization

Standardizes success scoring across different metrics:

- ROAS normalization
- CTR percentile ranking
- Conversion rate scoring
- Cross-platform normalization

---

## Advanced AI Modules

The AI system includes 24 specialized modules beyond the core NVIDIA NIM integration.

### Module Overview

| Module | Size | Purpose |
|--------|------|---------|
| `nvidia-ai.ts` | 21KB | Core LLM integration |
| `document-parser.ts` | 14KB | Natural language parsing |
| `agent-runner.ts` | 11KB | Multi-step agent execution |
| `agent-tools.ts` | 11KB | Structured agent tools |
| `anomaly-detection.ts` | 12KB | Performance anomaly detection |
| `creative-fatigue.ts` | 13KB | Creative decline detection |
| `forecasting.ts` | 13KB | Performance prediction |
| `pattern-mining.ts` | 17KB | Deep pattern extraction |
| `nl-query.ts` | 13KB | Natural language query processing |
| `timeline.ts` | 13KB | Time-series analysis |
| `explainability.ts` | 12KB | AI decision explanations |
| `governance.ts` | 10KB | AI decision oversight |
| `confidence-scoring.ts` | 9KB | Confidence calculations |
| `confidence-calibration.ts` | 5KB | Calibrating confidence accuracy |
| `priority-scoring.ts` | 8KB | Action prioritization |
| `benchmarking.ts` | 10KB | Performance benchmarks |
| `data-health.ts` | 11KB | Data quality scoring |
| `evaluation.ts` | 7KB | Before/after impact analysis |
| `guardrails.ts` | 8KB | Safety checks |
| `auto-apply.ts` | 6KB | Automatic recommendation application |
| `prompt-versioning.ts` | 13KB | Prompt A/B testing |
| `audit-logging.ts` | 8KB | Action audit trail |
| `rbac.ts` | 9KB | Role-based access control |

### Creative Fatigue Detection

Identifies when ad creatives are losing effectiveness:

```typescript
interface FatigueAnalysis {
  isFatigued: boolean;
  fatigueScore: number;  // 0-100
  indicators: {
    ctrDecline: number;
    frequencyIncrease: number;
    engagementDrop: number;
  };
  recommendation: 'continue' | 'refresh' | 'replace';
  estimatedDaysUntilFatigue: number;
}
```

### Forecasting

Predicts future performance based on trends:

```typescript
interface Forecast {
  metric: string;
  currentValue: number;
  predictions: {
    day7: { value: number; confidence: number };
    day14: { value: number; confidence: number };
    day30: { value: number; confidence: number };
  };
  trend: 'improving' | 'stable' | 'declining';
}
```

### Pattern Mining

Discovers hidden patterns across ad data:

```typescript
interface MinedPattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  correlation: number;
  associatedTraits: string[];
  performanceImpact: 'positive' | 'negative' | 'neutral';
}
```

---

## Background Sync System

A global background synchronization system that keeps Facebook ad data up-to-date automatically.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND SYNC PROVIDER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   Timer     │───▶│   Fetch     │───▶│   Compare   │───▶│   Update   │  │
│  │  (15 min)   │    │  FB Ads     │    │   & Merge   │    │ localStorage│  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └────────────┘  │
│                                                                             │
│  Features:                                                                  │
│  ├── Configurable sync interval (min 5 minutes)                            │
│  ├── Auto-prediction generation for new ads                                │
│  ├── Visibility-aware (pauses when tab hidden)                             │
│  ├── Conflict resolution with timestamp comparison                          │
│  └── Real-time sync indicator in UI                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration

```typescript
interface SyncSettings {
  enabled: boolean;
  intervalMinutes: number;  // Default: 15, Min: 5
  lastSyncTime?: string;
  autoGeneratePredictions: boolean;
}
```

### Sync Process

1. **Timer Trigger**: Interval-based or visibility change
2. **Fetch Ads**: Get latest from Facebook Graph API
3. **Compare**: Detect new, updated, or removed ads
4. **Merge**: Apply updates with conflict resolution
5. **Predictions**: Auto-generate for new ads
6. **Store**: Save to localStorage with timestamp

### Components

- `BackgroundSyncProvider.tsx` - Global sync context
- `SyncIndicator.tsx` - Visual sync status

---

## Collective Intelligence

A privacy-preserving shared learning system that allows users to benefit from community insights.

### Privacy Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COLLECTIVE INTELLIGENCE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT IS SHARED (anonymized):          WHAT IS NEVER SHARED:               │
│  ├── Feature weights                    ├── Raw creatives                   │
│  ├── Outcome signals (success/fail)     ├── Ad content                      │
│  ├── Confidence levels                  ├── User identity                   │
│  └── Category information               ├── Spend data                      │
│                                          └── Individual metrics              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Participation Modes

| Mode | Contributes | Receives |
|------|-------------|----------|
| `private` | ❌ No | ❌ No |
| `receive_only` | ❌ No | ✅ Yes |
| `contribute_receive` | ✅ Yes | ✅ Yes |

### Weight Blending

Local weights are blended with collective priors based on data volume:

```typescript
function calculateBlendRatio(localDataPoints: number): number {
  // More local data = more weight on local weights
  // Less local data = more weight on collective priors
  
  const MIN_FOR_FULL_LOCAL = 200;
  return Math.min(localDataPoints / MIN_FOR_FULL_LOCAL, 1);
}

// Result:
// 0 data points → 100% collective
// 100 data points → 50% local, 50% collective
// 200+ data points → 100% local
```

### Collective Priors

Aggregated signals from the community:

```typescript
interface CollectivePrior {
  feature_name: string;
  category: string;
  avg_weight: number;
  confidence: number;
  contribution_count: number;
  lift_percentage: number;  // Performance improvement
}
```

### Contribution Flow

1. User runs ad and inputs results
2. System calculates weight delta
3. Anonymized contribution submitted
4. Collective prior updated with running average
5. All users receive updated priors on next sync

---

## Marketplace & Data Pools

A visual marketplace for accessing Galaxy Orbs public data pools.

### Galaxy Orbs Visualization

Interactive 3D visualization of available data pools:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MARKETPLACE                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     ●           Data Pool: "E-commerce Traits"                              │
│   ● ○ ●         Contributors: 1,247                                         │
│     ●           Avg Lift: +23%                                              │
│                                                                             │
│         ○       Data Pool: "B2B SaaS"                                       │
│       ○ ● ○     Contributors: 892                                           │
│         ○       Avg Lift: +18%                                              │
│                                                                             │
│   ○ = Available to you                                                      │
│   ● = Subscribed                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AI Data Integration

Ask AI for targeted data:

```
User: "Get me data for business owners as target audience"

AI: Analyzing available pools...
    Found 3 relevant pools:
    - B2B Decision Makers (1.2K contributors)
    - Small Business Owners (934 contributors)
    - Entrepreneur Targeting (567 contributors)
    
    Would you like me to integrate this data into your ML model?
```

### Data Pool Structure

```typescript
interface DataPool {
  id: string;
  name: string;
  description: string;
  category: string;
  contributorCount: number;
  avgLift: number;
  features: CollectivePrior[];
  isPublic: boolean;
  createdAt: string;
}
```

---

## Admin & RBAC

Role-based access control system for team management.

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROLE HIERARCHY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────┐                                     │
│                         │   OWNER     │                                     │
│                         │  (Full)     │                                     │
│                         └──────┬──────┘                                     │
│                                │                                            │
│                         ┌──────┴──────┐                                     │
│                         │   ADMIN     │                                     │
│                         │ (Manage)    │                                     │
│                         └──────┬──────┘                                     │
│                                │                                            │
│              ┌─────────────────┼─────────────────┐                         │
│              │                 │                 │                          │
│       ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐                  │
│       │   EDITOR    │   │   VIEWER    │   │   GUEST     │                  │
│       │  (Write)    │   │  (Read)     │   │ (Limited)   │                  │
│       └─────────────┘   └─────────────┘   └─────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Permission | Owner | Admin | Editor | Viewer | Guest |
|------------|-------|-------|--------|--------|-------|
| View Ads | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create Ads | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete Ads | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Settings | ✅ | ✅ | ✅ | ✅ | ❌ |
| Change Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Access Billing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Account | ✅ | ❌ | ❌ | ❌ | ❌ |

### Organizer Page

Admin interface for user management:

- View all users
- Assign roles
- Invite new users
- Revoke access
- View activity logs

### Auth Integration

```typescript
// lib/auth.ts
interface AuthUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  permissions: Permission[];
}

// lib/rbac.ts
function hasPermission(user: AuthUser, permission: Permission): boolean;
function requireRole(minimumRole: Role): Middleware;
```

### RoleGate Component

```typescript
// Protect UI elements based on role
<RoleGate minimumRole="admin">
  <AdminControls />
</RoleGate>
```

---

## Troubleshooting


### Common Issues

| Issue | Solution |
|-------|----------|
| NVIDIA API errors | Check API key, verify model access |
| Cloudinary upload fails | Verify upload preset is unsigned |
| Supabase connection fails | Check URL and anon key |
| Facebook OAuth fails | Verify app ID and redirect URLs |
| ML predictions not updating | Check localStorage is enabled |

### Debugging

```typescript
// Enable console logging
console.log('[ML]', getMLSystemState());
console.log('[CAPI]', result);

// Check localStorage
localStorage.getItem('ml_feature_weights')
localStorage.getItem('ml_predictions')
localStorage.getItem('ads_data')
```

---

## Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Cloudinary Docs**: https://cloudinary.com/documentation
- **NVIDIA NIM**: https://docs.nvidia.com/nim
- **Facebook CAPI**: https://developers.facebook.com/docs/marketing-api/conversions-api
- **TensorFlow.js**: https://www.tensorflow.org/js

---

*Documentation last updated: December 30, 2024*  
*AdVision AI (Athena) v0.3.0 - Athena Agent & Full Platform Update*

