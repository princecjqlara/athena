# Athena Intelligence - Complete Page Documentation

> **AI-Powered Intelligence Hub for Advertising Insights, Recommendations, and Agent Automation**  
> Route: `/athena` | Main Dashboard for All AI Intelligence Features

---

## Table of Contents

1. [Overview](#overview)
2. [Main Dashboard (`/athena`)](#main-dashboard-athena)
3. [AI Recommendations (`/athena/recommendations`)](#ai-recommendations-athenarecommendations)
4. [Data Health (`/athena/health`)](#data-health-athenahealth)
5. [Anomaly Detection (`/athena/anomalies`)](#anomaly-detection-athenaanomalies)
6. [Agent Activity (`/athena/activity`)](#agent-activity-athenaactivity)
7. [Prompt Versions (`/athena/prompts`)](#prompt-versions-athenaprompts)
8. [Athena Agent System](#athena-agent-system)
9. [API Endpoints](#api-endpoints)
10. [Database Schema](#database-schema)
11. [File Structure](#file-structure)

---

## Overview

### What is Athena Intelligence?

Athena Intelligence is the central AI command center of the AdVision platform. It provides:

- **AI Recommendations**: Actionable suggestions to improve ad performance
- **Data Health Monitoring**: Quality and completeness analysis of advertising data
- **Anomaly Detection**: Automatic detection of unusual patterns in spending, performance, or conversions
- **Agent Activity**: Complete history of AI agent runs with reasoning chains
- **Prompt Management**: A/B testing different AI prompt configurations
- **40+ Agentic Actions**: Execute tasks via natural language commands

### Quick Stats Bar

The main dashboard displays four key metrics at a glance:

| Metric | Description | Color Coding |
|--------|-------------|--------------|
| **Recommendations** | Active pending recommendations | Blue (#3b82f6) |
| **Data Health** | Overall health score percentage | Green ≥80%, Yellow ≥60%, Red <60% |
| **Active Alerts** | Open anomaly alerts | Red if >0, Green if 0 |
| **Agent Runs** | Total AI agent executions | Purple (#8b5cf6) |

---

## Main Dashboard (`/athena`)

**File**: `app/athena/page.tsx`  
**Styling**: `app/athena/page.module.css`

### Key Features

1. **Stats Overview Bar**
   - Fetches stats from `/api/athena/stats` API
   - Falls back to localStorage calculation if API fails
   - Displays recommendations, health score, anomalies, and agent runs

2. **Feature Cards Grid** (6 cards)

   | Card | Route | Description |
   |------|-------|-------------|
   | 💡 AI Recommendations | `/athena/recommendations` | Actionable suggestions based on historical data |
   | 🏥 Data Health | `/athena/health` | Monitor data completeness and quality |
   | ⚠️ Anomaly Detection | `/athena/anomalies` | Detect unusual patterns automatically |
   | 🤖 Agent Activity | `/athena/activity` | View AI agent run history and reasoning |
   | 🎯 Predictions | `/predict` | AI predictions for ad performance |
   | 📝 Prompt Versions | `/athena/prompts` | Manage and A/B test AI prompts |

3. **Quick Actions Section**
   - 📥 Import Ads from Facebook
   - 🎯 Get Predictions
   - 🗺️ View Algorithm
   - 🧠 Collective Intelligence

### Health Score Calculation (Local)

```typescript
// Calculated from localStorage when API unavailable
const calculateLocalHealthScore = () => {
    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    
    let completeness = 100;  // Starts at 100, reduced if ads missing metrics
    let freshness = 100;     // Based on ads uploaded in last 7 days
    let attribution = 80;    // Default attribution score
    const schema = 100;      // Schema compliance
    
    return Math.round((completeness + freshness + attribution + schema) / 4);
};
```

---

## AI Recommendations (`/athena/recommendations`)

**File**: `app/athena/recommendations/page.tsx`  
**API**: `GET/PATCH /api/ai/recommendations`

### Purpose

Display and manage AI-generated actionable recommendations for improving ad performance.

### Data Model: `Recommendation`

```typescript
interface Recommendation {
    id: string;
    recommendation_type: string;      // Type of recommendation
    entity_type: string;               // What entity it applies to
    entity_id: string;                 // ID of the target entity
    title: string;                     // Recommendation title
    description: string;               // Detailed description
    confidence_score: number;          // 0.0 - 1.0 confidence level
    status: string;                    // 'pending' | 'accepted' | 'rejected' | 'expired'
    created_at: string;
    expires_at: string;
    reasoning_steps?: string[];        // AI reasoning chain
    action_json?: Record<string, unknown>;  // Executable action data
}
```

### Features

1. **Status Filtering**
   - All | Pending | Accepted | Rejected

2. **Entity Type Filtering**
   - Dynamic list based on available recommendations

3. **Confidence Score Color Coding**
   - ≥80%: Green (#10b981)
   - ≥60%: Yellow (#f59e0b)
   - <60%: Red (#ef4444)

4. **Accept/Reject Actions**
   - Pending recommendations can be accepted or rejected
   - Status updates via PATCH request

5. **Reasoning Display**
   - Shows AI reasoning steps when available
   - Helps users understand recommendation logic

---

## Data Health (`/athena/health`)

**File**: `app/athena/health/page.tsx`  
**API**: `GET/POST /api/ai/health`

### Purpose

Monitor the quality, completeness, and freshness of advertising data for accurate AI predictions.

### Data Models

```typescript
interface HealthScore {
    entity_type: string;
    entity_id: string;
    overall_score: number;
    completeness_score: number;      // How complete is the data?
    freshness_score: number;         // How recent is the data?
    attribution_score: number;       // How well can results be attributed?
    schema_score: number;            // Does data match expected format?
    issues: {
        type: string;
        severity: string;            // 'critical' | 'high' | 'medium' | 'low'
        description: string;
    }[];
}

interface HealthData {
    overallHealth: number;           // 0-100 percentage
    scores: HealthScore[];
    summary: {
        total: number;
        healthy: number;             // Score ≥80
        warning: number;             // Score 60-79
        critical: number;            // Score <60
    };
}
```

### Health Categories

| Category | Icon | Description |
|----------|------|-------------|
| **Completeness** | 📋 | Percentage of ads with metrics data |
| **Freshness** | 🕐 | Percentage of ads uploaded within 7 days |
| **Attribution** | 🔗 | Percentage of ads with conversion data |
| **Schema** | ✓ | Percentage of ads with required fields (name, status) |

### Local Health Calculation

When API is unavailable, health is calculated from localStorage:

```typescript
// Completeness: % of ads with adInsights
completeness = (adsWithMetrics / totalAds) * 100;

// Freshness: % of ads from last 7 days
freshness = (recentAds / totalAds) * 100;

// Attribution: % of ads with conversion data
attribution = (adsWithConversions / totalAds) * 100;

// Schema: % of ads with name AND status
schema = (adsWithSchema / totalAds) * 100;

// Overall: average of all four
overallHealth = (completeness + freshness + attribution + schema) / 4;
```

### Features

1. **Overall Health Score Display**
   - Large percentage with color coding
   - Summary counts (Healthy/Warning/Critical)

2. **Health Breakdown Cards**
   - Visual progress bars for each category
   - Individual category descriptions

3. **Issues List**
   - Severity-coded issue cards
   - Left border color indicates severity

4. **Recalculate Button**
   - Triggers POST request to recalculate all health scores

---

## Anomaly Detection (`/athena/anomalies`)

**File**: `app/athena/anomalies/page.tsx`  
**API**: `GET/PATCH /api/ai/anomalies`

### Purpose

Automatically detect and alert on unusual patterns in advertising data: spending anomalies, performance drops, conversion issues, etc.

### Data Model: `Anomaly`

```typescript
interface Anomaly {
    id: string;
    anomaly_type: string;            // Type of anomaly detected
    entity_type: string;             // What entity it affects
    entity_id: string;
    metric_name: string;             // Which metric deviated
    expected_value: number;          // What was expected
    actual_value: number;            // What was observed
    deviation_pct: number;           // Percentage deviation
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'open' | 'acknowledged' | 'resolved';
    detected_at: string;
    resolved_at?: string;
    context_json?: Record<string, unknown>;
}
```

### Severity Indicators

| Severity | Color | Icon |
|----------|-------|------|
| Critical | Red (#ef4444) | 🚨 |
| High | Orange (#f59e0b) | ⚠️ |
| Medium | Blue (#3b82f6) | 📊 |
| Low | Gray (#6b7280) | ℹ️ |

### Features

1. **Summary Cards**
   - Total anomalies count
   - Open alerts count
   - Breakdowns by severity (Critical/High/Medium)

2. **Filtering**
   - By status (All/Open/Acknowledged/Resolved)
   - By severity (All/Critical/High/Medium/Low)

3. **Anomaly Cards**
   - Severity-coded left border
   - Deviation percentage display
   - Metric comparison (Expected vs Actual)
   - Detection timestamp

4. **Status Management**
   - Acknowledge: Mark as reviewed
   - Resolve: Mark as fixed

---

## Agent Activity (`/athena/activity`)

**File**: `app/athena/activity/page.tsx`  
**API**: `GET /api/ai/agent/runs`

### Purpose

View complete history of AI agent runs, including input queries, tools used, reasoning chains, and outputs.

### Data Model: `AgentRun`

```typescript
interface AgentRun {
    id: string;
    org_id: string;
    user_id: string;
    trigger_type: string;            // 'user_query' | 'scheduled' | 'webhook' | 'auto'
    input_query: string;             // Original user input
    steps_json: {
        step: string;
        reasoning: string;
        tool?: string;
    }[];
    tools_used: string[];
    total_duration_ms: number;
    recommendations_generated: number;
    final_output: string;
    status: 'completed' | 'failed' | 'running';
    error_message?: string;
    prompt_version?: string;
    model_version?: string;
    created_at: string;
    completed_at?: string;
}
```

### Trigger Type Icons

| Trigger | Icon | Description |
|---------|------|-------------|
| user_query | 💬 | User-initiated via chat |
| scheduled | 🕐 | Scheduled/automated run |
| webhook | 🔗 | Triggered by webhook |
| auto | 🤖 | Automatic system action |

### Features

1. **Stats Overview**
   - Total runs count
   - Completed runs (green)
   - Failed runs (red)
   - Total recommendations generated (blue)

2. **Filtering**
   - By status (All/Completed/Failed/Running)
   - By trigger type

3. **Expandable Run Details**
   - Full input query
   - Tools used (with monospace styling)
   - Reasoning chain (numbered steps with purple accent)
   - Final output
   - Error messages (if failed)
   - Metadata (ID, prompt version, model version)

4. **Duration Formatting**
   - Milliseconds: `500ms`
   - Seconds: `2.5s`
   - Minutes: `1m 30s`

---

## Prompt Versions (`/athena/prompts`)

**File**: `app/athena/prompts/page.tsx`  
**API**: `GET/POST/PATCH /api/ai/prompts`

### Purpose

Manage and A/B test different AI prompt configurations for optimal recommendation quality.

### Data Model: `PromptVersion`

```typescript
interface PromptVersion {
    id: string;
    prompt_name: string;             // Logical name (e.g., 'athena_agent')
    version: string;                 // Semantic version (e.g., '1.0.0')
    prompt_text: string;             // The actual prompt content
    tool_definitions?: Record<string, unknown>;
    is_active: boolean;              // Can be used in production
    is_default: boolean;             // Default for this prompt_name
    total_runs: number;              // Times this prompt was used
    avg_confidence: number;          // Average confidence of results
    avg_accept_rate: number;         // Recommendation acceptance rate
    avg_positive_outcome_rate: number; // Positive outcomes rate
    created_by?: string;
    created_at: string;
}
```

### Features

1. **Prompt Groups**
   - Grouped by `prompt_name`
   - Version count per group

2. **Create New Prompt**
   - Prompt name input
   - Version input (semantic versioning)
   - Prompt text (monospace textarea)
   - Option to set as default

3. **Performance Stats** (for prompts with runs)
   - Total Runs
   - Avg Confidence (color-coded)
   - Accept Rate (color-coded)
   - Positive Outcomes (color-coded)

4. **Version Management**
   - Activate/Deactivate toggle
   - Set as default button
   - Expandable prompt text preview

5. **Active Only Filter**
   - Toggle to show only active prompts

---

## Athena Agent System

**File**: `lib/athena-agent.ts` (2,729 lines)

### Purpose

Enables Athena to **execute tasks via natural language**, not just answer questions. The agent parses user intent, matches to actions, and executes operations.

### Key Exports

```typescript
// Action name type (40+ actions)
export type ActionName = 'import_ads' | 'analyze_ad' | 'pause_ad' | ...;

// Action definition
export interface AgentAction {
    name: ActionName;
    description: string;
    requiresConfirmation: boolean;
    parameters: { name: string; type: string; required: boolean; description: string }[];
    execute: (params: Record<string, unknown>) => Promise<ActionResult>;
}

// Action result
export interface ActionResult {
    success: boolean;
    message: string;
    data?: unknown;
    error?: string;
}

// Parsed user intent
export interface ParsedIntent {
    action: ActionName | null;
    parameters: Record<string, unknown>;
    confidence: number;
    requiresConfirmation: boolean;
    confirmationMessage?: string;
}
```

### Complete Action Catalog (40+ Actions)

#### Core Actions
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `import_ads` | Import ads from Facebook | No |
| `analyze_ad` | Analyze a specific ad | No |
| `predict_score` | Predict success score | No |
| `sync_data` | Sync local data to cloud | No |
| `export_data` | Export ads/analytics data | No |
| `show_insights` | Show performance insights | No |
| `show_patterns` | Show learned patterns | No |
| `recommend_creative` | Recommend creative elements | No |

#### Ad Management
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `delete_ad` | Delete a specific ad | Yes |
| `delete_ads_bulk` | Delete multiple ads | Yes |
| `edit_ad` | Edit ad properties | Yes |
| `list_ads` | List all ads | No |
| `get_ad_details` | Get detailed ad info | No |
| `duplicate_ad` | Copy an existing ad | No |
| `archive_ad` | Archive (hide) an ad | Yes |
| `restore_ad` | Restore archived ad | No |
| `sort_ads` | Sort ads by criteria | No |
| `filter_ads` | Filter ads by criteria | No |
| `bulk_update_ads` | Update multiple ads | Yes |
| `refresh_predictions` | Refresh AI predictions | No |

#### Facebook Ad Management (Direct API)
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `pause_ad` | Pause running FB ad | Yes |
| `resume_ad` | Resume paused FB ad | Yes |
| `update_budget` | Update ad set budget | Yes |

#### Facebook Ad Creation
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `create_fb_campaign` | Create FB campaign | Yes |
| `create_fb_adset` | Create FB ad set | Yes |
| `upload_ad_image` | Upload image to FB | No |
| `create_ad_creative` | Create ad creative | Yes |
| `create_full_ad` | Create complete ad | Yes |

#### Pipeline Management
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `create_pipeline` | Create sales pipeline | Yes |
| `delete_pipeline` | Delete pipeline | Yes |
| `edit_pipeline` | Edit/rename pipeline | Yes |
| `add_pipeline_stage` | Add stage to pipeline | No |
| `remove_pipeline_stage` | Remove stage | Yes |
| `reorder_pipeline_stages` | Reorder stages | Yes |
| `list_pipelines` | List all pipelines | No |
| `get_pipeline_details` | Get pipeline details | No |

#### Lead Management
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `move_lead` | Move lead to stage | Yes |
| `delete_lead` | Delete a lead | Yes |
| `edit_lead` | Edit lead info | Yes |
| `list_leads` | List all leads | No |
| `bulk_move_leads` | Move multiple leads | Yes |

#### Trait Management
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `create_trait` | Create custom trait | No |
| `delete_trait` | Delete trait | Yes |
| `edit_trait` | Edit trait | No |
| `list_traits` | List all traits | No |

#### Research & Trends
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `search_trends` | Search advertising trends | No |
| `research_topic` | Research specific topic | No |

#### System Actions
| Action | Description | Confirmation |
|--------|-------------|--------------|
| `clear_all_data` | Clear all local data | Yes (requires "DELETE ALL") |
| `add_result` | Add performance results | Yes |

### Intent Parsing

Natural language is matched against regex patterns:

```typescript
const INTENT_PATTERNS = [
    { pattern: /import|fetch|get|pull.*ads?.*facebook|fb/i, action: 'import_ads' },
    { pattern: /pause.*ad|stop.*ad|disable.*ad/i, action: 'pause_ad' },
    { pattern: /create.*campaign|new.*campaign/i, action: 'create_fb_campaign' },
    // ... 60+ patterns
];
```

### AI Response Parsing

Actions are communicated via structured tags:

```
[ACTION: action_name]
[PARAMS: {"param": "value"}]
[MESSAGE: Explanation to user]
```

---

## API Endpoints

### Athena Stats
**`GET /api/athena/stats`**

```typescript
// Response
{
    success: true,
    stats: {
        recommendations: number,  // Pending recommendations count
        anomalies: number,        // Open anomalies count
        dataHealthScore: number,  // 0-100 percentage
        agentRuns: number         // Total agent runs
    }
}
```

### Related APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/recommendations` | GET | Fetch all recommendations |
| `/api/ai/recommendations` | PATCH | Update recommendation status |
| `/api/ai/health` | GET | Fetch health scores |
| `/api/ai/health` | POST | Recalculate health |
| `/api/ai/anomalies` | GET | Fetch anomalies |
| `/api/ai/anomalies` | PATCH | Update anomaly status |
| `/api/ai/agent/runs` | GET | Fetch agent run history |
| `/api/ai/prompts` | GET | Fetch prompt versions |
| `/api/ai/prompts` | POST | Create new prompt |
| `/api/ai/prompts` | PATCH | Update prompt (active/default) |

---

## Database Schema

### Supabase Tables

```sql
-- AI Recommendations
CREATE TABLE athena_recommendations (
    id UUID PRIMARY KEY,
    recommendation_type TEXT,
    entity_type TEXT,
    entity_id TEXT,
    title TEXT,
    description TEXT,
    confidence_score DECIMAL,
    status TEXT DEFAULT 'pending',
    reasoning_steps JSONB,
    action_json JSONB,
    created_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Anomalies
CREATE TABLE anomalies (
    id UUID PRIMARY KEY,
    anomaly_type TEXT,
    entity_type TEXT,
    entity_id TEXT,
    metric_name TEXT,
    expected_value DECIMAL,
    actual_value DECIMAL,
    deviation_pct DECIMAL,
    severity TEXT,
    status TEXT DEFAULT 'open',
    detected_at TIMESTAMP,
    resolved_at TIMESTAMP,
    context_json JSONB
);

-- Data Health Scores
CREATE TABLE data_health_scores (
    id UUID PRIMARY KEY,
    entity_type TEXT,
    entity_id TEXT,
    overall_score DECIMAL,
    completeness_score DECIMAL,
    freshness_score DECIMAL,
    attribution_score DECIMAL,
    schema_score DECIMAL,
    issues JSONB,
    calculated_at TIMESTAMP
);

-- Agent Runs
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY,
    org_id TEXT,
    user_id TEXT,
    trigger_type TEXT,
    input_query TEXT,
    steps_json JSONB,
    tools_used TEXT[],
    total_duration_ms INTEGER,
    recommendations_generated INTEGER,
    final_output TEXT,
    status TEXT,
    error_message TEXT,
    prompt_version TEXT,
    model_version TEXT,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Prompt Versions
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY,
    prompt_name TEXT,
    version TEXT,
    prompt_text TEXT,
    tool_definitions JSONB,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    total_runs INTEGER DEFAULT 0,
    avg_confidence DECIMAL,
    avg_accept_rate DECIMAL,
    avg_positive_outcome_rate DECIMAL,
    created_by TEXT,
    created_at TIMESTAMP
);
```

---

## File Structure

```
app/athena/
├── page.tsx                    # Main Athena dashboard
├── page.module.css             # Dashboard styling
├── activity/
│   └── page.tsx                # Agent Activity page (406 lines)
├── anomalies/
│   └── page.tsx                # Anomaly Detection page (341 lines)
├── health/
│   └── page.tsx                # Data Health page (354 lines)
├── prompts/
│   └── page.tsx                # Prompt Versions page (438 lines)
└── recommendations/
    └── page.tsx                # AI Recommendations page (252 lines)

app/api/athena/
└── stats/
    └── route.ts                # Stats API endpoint (66 lines)

lib/
└── athena-agent.ts             # Agent system (2,729 lines)
    ├── ActionName type         # 40+ action types
    ├── AGENT_ACTIONS registry  # Action definitions
    ├── INTENT_PATTERNS         # 60+ regex patterns
    ├── parseIntent()           # Parse user message
    ├── parseAIResponse()       # Parse AI action commands
    └── executeAction()         # Execute action
```

---

## Usage Examples

### Natural Language Commands

```
User: "Import my ads from Facebook"
→ Agent: Executes import_ads action

User: "Pause ad 12345"
→ Agent: Requests confirmation, then executes pause_ad with adId='12345'

User: "Create a new campaign called Summer Sale"
→ Agent: Requests confirmation, executes create_fb_campaign with name='Summer Sale'

User: "What's working best right now?"
→ Agent: Executes show_patterns action

User: "Delete all ads from TikTok"
→ Agent: Requests confirmation, executes delete_ads_bulk with filter={platform:'tiktok'}
```

### Accessing Athena Features

1. **Dashboard**: Navigate to `/athena` for overview
2. **Recommendations**: Click "💡 AI Recommendations" card
3. **Health Check**: Click "🏥 Data Health" card
4. **Anomalies**: Click "⚠️ Anomaly Detection" card
5. **History**: Click "🤖 Agent Activity" card
6. **Prompts**: Click "📝 Prompt Versions" card
7. **Chat**: Use chatbot (Athena icon) anywhere for natural language commands

---

## Color Coding Reference

### Health/Performance Scores
- **≥80%**: Green (#10b981) - Healthy
- **60-79%**: Yellow (#f59e0b) - Warning
- **<60%**: Red (#ef4444) - Critical

### Severity Levels
- **Critical**: Red (#ef4444)
- **High**: Orange (#f59e0b)
- **Medium**: Blue (#3b82f6)
- **Low**: Gray (#6b7280)

### Status Colors
- **Open**: Red (#ef4444)
- **Acknowledged**: Yellow (#f59e0b)
- **Resolved/Completed**: Green (#10b981)
- **Running**: Blue (#3b82f6)
- **Pending**: Yellow (#f59e0b)
- **Accepted**: Green (#10b981)
- **Rejected**: Red (#ef4444)

---

*Last Updated: December 30, 2025*
