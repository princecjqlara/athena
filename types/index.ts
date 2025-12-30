// Video and Ad Performance Types

export interface Video {
  id: string;
  cloudinary_url: string;
  cloudinary_public_id: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  created_at: string;
}

export interface VideoMetadata {
  id: string;
  video_id: string;

  // Content Details
  script?: string;
  hook_type: HookType;
  content_category: ContentCategory;

  // Visual Elements
  editing_style: EditingStyle;
  color_scheme: ColorScheme;
  text_overlays: boolean;
  subtitles: boolean;

  // Characters/Actors
  character_codes: string[];
  number_of_actors: number;
  influencer_used: boolean;
  ugc_style: boolean;

  // Audio
  music_type: MusicType;
  voiceover: boolean;

  // Custom Tags
  custom_tags: string[];

  created_at: string;
}

export interface AdPerformance {
  id: string;
  video_id: string;

  // Campaign Details
  platform: Platform;
  launch_date: string;
  launch_day: DayOfWeek;
  launch_time: TimeOfDay;

  // Spend & Results
  ad_spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  roas: number;

  // Engagement
  likes: number;
  comments: number;
  shares: number;
  saves: number;

  // User Assessment
  success_rating: number; // 1-10
  notes?: string;

  created_at: string;
}

// Enum Types
export type HookType =
  | 'curiosity'
  | 'shock'
  | 'question'
  | 'story'
  | 'statistic'
  | 'controversy'
  | 'transformation'
  | 'before_after'
  | 'problem_solution'
  | 'testimonial'
  | 'unboxing'
  | 'challenge'
  | 'other';

export type ContentCategory =
  | 'product_demo'
  | 'lifestyle'
  | 'testimonial'
  | 'educational'
  | 'entertainment'
  | 'behind_the_scenes'
  | 'comparison'
  | 'tutorial'
  | 'ugc'
  | 'influencer'
  | 'brand_story'
  | 'other';

export type EditingStyle =
  | 'fast_cuts'
  | 'cinematic'
  | 'raw_authentic'
  | 'animated'
  | 'mixed_media'
  | 'minimal'
  | 'dynamic'
  | 'slow_motion'
  | 'other';

export type ColorScheme =
  | 'vibrant'
  | 'muted'
  | 'monochrome'
  | 'warm'
  | 'cool'
  | 'pastel'
  | 'dark'
  | 'neon'
  | 'natural'
  | 'other';

export type MusicType =
  | 'trending'
  | 'original'
  | 'voiceover_only'
  | 'no_music'
  | 'licensed'
  | 'cinematic'
  | 'upbeat'
  | 'emotional'
  | 'other';

export type Platform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'snapchat'
  | 'pinterest'
  | 'twitter'
  | 'linkedin'
  | 'other';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type TimeOfDay =
  | 'early_morning'   // 5-8am
  | 'morning'         // 8-12pm
  | 'afternoon'       // 12-5pm
  | 'evening'         // 5-9pm
  | 'night';          // 9pm-5am

// ===== NEW ML-CRITICAL TYPES =====

// Budget Tiers - categorize campaign budget for better predictions
export type BudgetTier =
  | 'micro'      // $0-$50
  | 'small'      // $50-$200
  | 'medium'     // $200-$1000
  | 'large'      // $1000-$5000
  | 'enterprise'; // $5000+

// Campaign Objective Types - affects expected outcomes
export type ObjectiveType =
  | 'awareness'      // Brand awareness, reach
  | 'traffic'        // Website clicks
  | 'engagement'     // Likes, comments, shares
  | 'leads'          // Lead generation
  | 'conversions'    // Purchases, signups
  | 'messages'       // Messenger conversations
  | 'video_views';   // Video view campaigns

// Audience Types - cold vs warm audiences
export type AudienceType =
  | 'cold'           // Never seen brand before
  | 'warm'           // Engaged with content
  | 'retargeting'    // Website visitors, cart abandoners
  | 'lookalike'      // Similar to existing customers
  | 'custom';        // Custom audience

// Hook Retention Quality - first 3 seconds effectiveness
export type HookRetention =
  | 'poor'           // <25% watch past 3s
  | 'below_average'  // 25-50% watch past 3s
  | 'average'        // 50-75% watch past 3s
  | 'good'           // 75-90% watch past 3s
  | 'excellent';     // >90% watch past 3s

// Target Age Group - demographic targeting
export type TargetAgeGroup =
  | 'gen_z'          // 18-24
  | 'younger_millennial' // 25-34
  | 'older_millennial'   // 35-44
  | 'gen_x'          // 45-54
  | 'boomer'         // 55+
  | 'broad';         // Multiple age groups

// Combined type for full video data
export interface FullVideoData {
  video: Video;
  metadata: VideoMetadata;
  performance?: AdPerformance[];
}

// Prediction types
export interface PredictionResult {
  success_probability: number;
  confidence: number;
  top_factors: PredictionFactor[];
  recommendations: string[];
  similar_videos: SimilarVideo[];
}

export interface PredictionFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export interface SimilarVideo {
  video_id: string;
  thumbnail_url?: string;
  success_rating: number;
  similarity_score: number;
}

// Form input types
export interface VideoUploadInput {
  file: File;
}

export interface MetadataInput extends Omit<VideoMetadata, 'id' | 'video_id' | 'created_at'> { }

export interface PerformanceInput extends Omit<AdPerformance, 'id' | 'video_id' | 'created_at'> { }

// Dashboard stats
export interface DashboardStats {
  total_videos: number;
  total_ads: number;
  average_ctr: number;
  average_roas: number;
  best_hook_type: HookType;
  best_platform: Platform;
  best_launch_day: DayOfWeek;
  total_spend: number;
  total_revenue: number;
}

// ============================================
// Document-Based Input System Types
// ============================================

// Media Types (supports photos and videos)
export type MediaType = 'video' | 'photo' | 'carousel';

// Aspect Ratios
export type AspectRatio =
  | '9:16'    // Vertical (TikTok, Stories, Reels)
  | '1:1'     // Square (Feed)
  | '4:5'     // Portrait Feed
  | '16:9'    // Horizontal (YouTube)
  | '4:3'     // Standard
  | 'other';

// Ad Placements
export type AdPlacement =
  | 'feed'
  | 'stories'
  | 'reels'
  | 'explore'
  | 'in-stream'
  | 'pre-roll'
  | 'mid-roll'
  | 'banner'
  | 'sponsored'
  | 'other';

// CTA Types
export type CTAType =
  | 'shop_now'
  | 'learn_more'
  | 'sign_up'
  | 'download'
  | 'contact_us'
  | 'swipe_up'
  | 'link_in_bio'
  | 'book_now'
  | 'get_offer'
  | 'none'
  | 'other';

// Duration categories
export type DurationCategory =
  | 'under_15s'
  | '15_30s'
  | '30_60s'
  | 'over_60s';

// Content Document - raw user input
export interface ContentDocument {
  rawText: string;
  mediaFile?: File;
  mediaUrl?: string;
  createdAt: string;
}

// Results Document - raw user input
export interface ResultsDocument {
  rawText: string;
  adId: string;
  createdAt: string;
}

// AI-Extracted Ad Data - structured output with COMPREHENSIVE ANALYTICS
export interface ExtractedAdData {
  // ===== BASIC INFO =====
  title?: string;
  description?: string;

  // ===== MEDIA DETAILS =====
  mediaType: MediaType;
  aspectRatio: AspectRatio;
  duration?: number;
  durationCategory?: DurationCategory;
  adFormat?: 'static' | 'video' | 'carousel' | 'collection' | 'story';

  // ===== PLATFORM & PLACEMENT =====
  platform: Platform;
  placement: AdPlacement;
  industryVertical?: string;

  // ===== CREATIVE INTELLIGENCE =====
  hookType: HookType;
  hookText?: string;
  hookVelocity?: 'instant' | 'gradual' | 'delayed'; // How quickly hook grabs attention
  hookKeywords?: string[]; // Key attention-grabbing words
  contentCategory: ContentCategory;
  editingStyle: EditingStyle;

  // ===== PATTERN RECOGNITION =====
  patternType?: 'problem_solution' | 'social_proof' | 'fomo' | 'authority' | 'storytelling' | 'comparison' | 'demonstration';

  // ===== SENTIMENT ANALYSIS =====
  overallSentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  emotionalTone?: 'inspiring' | 'urgent' | 'calm' | 'exciting' | 'serious' | 'humorous';

  // ===== FACE PRESENCE & FACIAL EMOTION =====
  facePresence?: boolean;
  numberOfFaces?: number;
  facialEmotion?: 'happy' | 'neutral' | 'surprised' | 'serious' | 'excited' | 'not_visible';

  // ===== TEXT-OVERLAY ANALYSIS =====
  hasTextOverlays: boolean;
  textOverlayRatio?: 'minimal' | 'moderate' | 'heavy';
  textReadability?: 'easy' | 'moderate' | 'difficult';
  readabilityScore?: 'simple' | 'moderate' | 'complex';

  // ===== COLOR & VISUAL ANALYSIS =====
  colorScheme: ColorScheme;
  colorTemperature?: 'warm' | 'cool' | 'neutral';
  brandVisualTiming?: 'early' | 'middle' | 'end' | 'throughout';
  safeZoneAdherence?: boolean;
  visualAudioMismatch?: boolean;
  visualStyle?: string[];
  hasSubtitles: boolean;
  subtitleStyle?: 'default' | 'animated' | 'highlighted' | 'minimal';

  // ===== AUDIO ANALYSIS (BPM, VO, Silence) =====
  musicType: MusicType;
  bpm?: 'slow' | 'medium' | 'fast' | 'variable';
  hasVoiceover: boolean;
  voiceoverStyle?: 'professional' | 'casual' | 'energetic' | 'calm';
  silenceDetection?: boolean;
  audioPeakTiming?: 'hook' | 'middle' | 'cta' | 'throughout';
  audioDescription?: string;

  // ===== SCRIPT & COPY ANALYSIS =====
  script?: string;
  painPointAddressing?: boolean;
  painPoints?: string[];
  cta?: CTAType;
  ctaText?: string;
  ctaStrength?: 'weak' | 'moderate' | 'strong';
  headlines?: string[];

  // ===== RETENTION & PERFORMANCE PREDICTORS =====
  retentionCurveSlope?: 'steep_drop' | 'gradual_decline' | 'flat' | 'hook_spike';
  preFlightScore?: number; // 0-100 Pre-Flight Optimization Score
  preFlightNotes?: string[];
  conceptDrift?: boolean;

  // ===== ADVANCED VISUAL ANALYTICS =====
  saliencyMapScore?: number; // 0-100 - How well key elements draw attention
  sceneVelocity?: 'static' | 'slow' | 'moderate' | 'fast' | 'chaotic'; // Pace of scene changes
  textToBackgroundContrast?: 'poor' | 'adequate' | 'good' | 'excellent'; // Readability contrast
  shotComposition?: 'rule_of_thirds' | 'centered' | 'symmetrical' | 'dynamic' | 'close_up' | 'wide' | 'mixed';
  semanticCongruence?: boolean; // Do visuals match the message/script?
  moodMatching?: boolean; // Does audio mood match visual mood?

  // ===== BRAND CONSISTENCY =====
  logoConsistency?: 'absent' | 'subtle' | 'prominent' | 'intrusive';
  logoTiming?: 'intro' | 'throughout' | 'outro' | 'none';
  brandColorUsage?: 'none' | 'accent' | 'dominant';

  // ===== VOICE & AUDIO AUTHORITY =====
  voiceAuthorityScore?: number; // 0-100 - Confidence/authority of voiceover
  voiceGender?: 'male' | 'female' | 'neutral' | 'multiple' | 'none';
  voiceAge?: 'young' | 'middle' | 'mature' | 'varied';
  speechPace?: 'slow' | 'moderate' | 'fast' | 'varied';

  // ===== ENGAGEMENT TRIGGERS =====
  curiosityGap?: boolean; // Creates desire to know more
  socialProofElements?: string[]; // Testimonials, reviews, numbers
  urgencyTriggers?: string[]; // Limited time, scarcity, etc.
  trustSignals?: string[]; // Guarantees, certifications, etc.

  // ===== TALENT =====
  numberOfActors: number;
  talentType?: 'ugc_creator' | 'influencer' | 'model' | 'none' | 'multiple';
  isUGCStyle: boolean;

  // ===== ML-CRITICAL CAMPAIGN DATA =====
  budgetTier?: BudgetTier;           // Budget category for prediction
  objectiveType?: ObjectiveType;     // Campaign objective
  audienceType?: AudienceType;       // Cold vs warm audience
  hookRetention?: HookRetention;     // First 3 seconds retention quality
  targetAgeGroup?: TargetAgeGroup;   // Target demographic

  // ===== CUSTOM TRAITS =====
  customTraits: string[];

  // ===== AI-DISCOVERED CATEGORIES =====
  // The AI can add its own discovered metrics and patterns
  aiDiscoveredMetrics?: {
    name: string;
    value: string | number | boolean;
    importance: 'low' | 'medium' | 'high';
    description: string;
  }[];

  aiInsights?: string[]; // AI's unique observations not covered by standard metrics

  // ===== AI-SUGGESTED NEW TRAITS =====
  // Traits the AI recommends adding to the learned traits system
  learnedTraitsToCreate?: {
    traitName: string;
    traitCategory: string;
    definition: string;
    importance: 'low' | 'medium' | 'high';
  }[];

  // ===== MISSING DATA SUGGESTIONS =====
  missingDataFields?: string[]; // Fields user should provide for better analysis
  suggestions?: string[]; // AI suggestions for more complete data

  // ===== AI CONFIDENCE =====
  extractionConfidence: number;
}

// AI-Extracted Results Data
export interface ExtractedResultsData {
  // Campaign Details
  platform: Platform;
  startDate?: string;
  endDate?: string;
  launchDay?: DayOfWeek;
  launchTime?: TimeOfDay;

  // Spend & Performance
  adSpend: number;
  impressions: number;
  reach?: number;
  clicks: number;
  ctr: number;

  // Conversions
  conversions?: number;
  conversionRate?: number;
  revenue?: number;
  roas?: number;

  // Engagement
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;

  // Observations
  notes?: string;
  bestPerformingDay?: string;
  bestPerformingTime?: string;
  audienceInsights?: string[];

  // Calculated Score
  successScore: number;

  // AI Confidence
  extractionConfidence: number;
}

// Full Ad Entry (combines everything)
export interface AdEntry {
  id: string;

  // Media
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType: MediaType;

  // For imported ads
  name?: string;
  facebookAdId?: string;
  importedFromFacebook?: boolean;

  // Documents (raw input)
  contentDocument: string;
  resultsDocument?: string;

  // Extracted Data
  extractedContent: ExtractedAdData;
  extractedResults?: ExtractedResultsData;

  // Status
  hasResults: boolean;
  successScore?: number;

  // Ad Connection - Link imported ads to uploaded ads
  linkedAdId?: string;                    // ID of the connected ad
  linkedAdType?: 'imported' | 'uploaded'; // Type of the linked ad
  linkedAt?: string;                      // Timestamp when connection was made

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Mind Map Types
export interface MindMapNode {
  id: string;
  label: string;
  category: MindMapCategory;
  type: 'category' | 'trait' | 'ad';

  // Dynamic sizing (based on frequency)
  frequency: number;
  size: number;

  // Dynamic coloring (based on success)
  avgSuccessRate?: number;
  color: string;

  // Position
  x: number;
  y: number;

  // Connections
  connections: string[];

  // Data
  adIds: string[];
  metadata?: Record<string, unknown>;
}

export type MindMapCategory =
  | 'center'
  | 'media_type'
  | 'aspect_ratio'
  | 'platform'
  | 'placement'
  | 'hook_type'
  | 'content_type'
  | 'visual_style'
  | 'audio'
  | 'cta'
  | 'talent'
  | 'duration'
  | 'custom';

export interface MindMapConnection {
  from: string;
  to: string;
  strength: number; // 0-1, based on co-occurrence
  successCorrelation?: number; // how these together affect success
}

export interface MindMapData {
  nodes: MindMapNode[];
  connections: MindMapConnection[];
  patterns: DiscoveredPattern[];
  lastUpdated: string;
}

export interface DiscoveredPattern {
  id: string;
  traits: string[];
  frequency: number;
  avgSuccessRate: number;
  description: string;
  recommendation?: string;
}

// ============================================
// SELF-CORRECTION ML ARCHITECTURE TYPES
// ============================================

// Prediction Record - tracks prediction vs reality
export interface PredictionRecord {
  id: string;
  adId: string;

  // Prediction
  predictedScore: number;
  predictedAt: string;

  // Reality (filled after results)
  actualScore?: number;
  actualResultsAt?: string;

  // Error Analysis
  delta?: number; // actualScore - predictedScore
  deltaPercent?: number;
  isHighError: boolean; // delta > 50%
  isSurpriseSuccess: boolean; // predicted low, actual high
  isSurpriseFailure: boolean; // predicted high, actual low

  // Context
  weightsUsed: FeatureWeight[];
  audienceSegment?: string;

  // Correction
  correctionApplied: boolean;
  correctionNotes?: string[];
}

// Feature Weight - dynamic scoring weights
export interface FeatureWeight {
  feature: string;
  category: string;
  weight: number; // can be negative or positive
  previousWeight?: number;

  // Confidence
  confidenceLevel: number; // 0-100
  sampleSize: number; // how many data points

  // Time tracking
  lastUpdated: string;
  lastSuccessfulPrediction?: string;

  // Trend
  trend: 'rising' | 'falling' | 'stable';
  trendStrength: number; // 0-100
}

// Discovered ML Feature - new patterns AI finds
export interface DiscoveredMLFeature {
  id: string;
  name: string;
  description: string;

  // Discovery context
  discoveredFrom: string; // adId that triggered discovery
  discoveredAt: string;
  discoveryReason: 'surprise_success' | 'surprise_failure' | 'pattern_analysis';

  // Validation
  validatedAgainst: string[]; // adIds that confirmed this pattern
  successCorrelation: number; // 0-100
  isValidated: boolean;
  isActive: boolean;

  // Feature details
  featureType: 'visual' | 'audio' | 'script' | 'timing' | 'engagement' | 'other';
  detectionCriteria: string; // How to detect this feature
  exampleValue?: string;
}

// Audience Segment - context-specific scoring
export interface AudienceSegment {
  id: string;
  name: string;
  description: string;

  // Demographics
  ageRange?: { min: number; max: number };
  gender?: 'male' | 'female' | 'all';
  interests?: string[];
  platforms?: string[];

  // Segment-specific weights
  featureWeights: FeatureWeight[];

  // Performance
  totalAds: number;
  avgSuccessRate: number;

  // Status
  isActive: boolean;
  lastUpdated: string;
}

// Time Decay Configuration
export interface TimeDecayConfig {
  enabled: boolean;
  decayRates: {
    thisWeek: number;      // 1.0
    lastMonth: number;     // 0.8
    threeMonths: number;   // 0.5
    sixMonths: number;     // 0.3
    older: number;         // 0.1
  };
}

// Exploration (Epsilon-Greedy) Settings
export interface ExplorationConfig {
  enabled: boolean;
  explorationRate: number; // 0.1 = 10%
  wildcardCount: number; // how many wildcards to show
  minScoreForWildcard: number; // don't recommend truly terrible ads
  maxScoreForWildcard: number; // wildcards should be "surprising" choices
}

// ML System State
export interface MLSystemState {
  // Global weights
  globalWeights: FeatureWeight[];

  // Audience segments
  audienceSegments: AudienceSegment[];

  // Discovered features
  discoveredFeatures: DiscoveredMLFeature[];

  // Prediction history
  recentPredictions: PredictionRecord[];

  // Configuration
  timeDecay: TimeDecayConfig;
  exploration: ExplorationConfig;

  // Stats
  totalPredictions: number;
  accuracyRate: number; // % of predictions within 20% of actual
  surpriseSuccessCount: number;
  surpriseFailureCount: number;

  // Last update
  lastTrainingDate: string;
  lastWeightAdjustment: string;
}

// Weight Adjustment Event
export interface WeightAdjustmentEvent {
  id: string;
  timestamp: string;
  triggeredBy: string; // predictionRecordId

  // Changes
  adjustments: {
    feature: string;
    oldWeight: number;
    newWeight: number;
    reason: string;
  }[];

  // Validation
  validatedImprovement: boolean;
}
