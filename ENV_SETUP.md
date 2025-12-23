# Environment Configuration for AdVision AI

## NVIDIA AI API (GPT-Powered Predictions)
Powers the AI predictions, pattern analysis, and recommendations.

```
NVIDIA_API_KEY=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
```

## Cloudinary Configuration
Get these from https://cloudinary.com/console

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ads_algorithm
```

## Supabase Configuration
Get these from https://supabase.com/dashboard

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Meta/Facebook Configuration
Get these from https://developers.facebook.com

```
NEXT_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id
```


## Setup Instructions

1. Create a `.env.local` file in the root of the project
2. Copy all the environment variables above
3. Replace the placeholder values with your actual credentials

### Cloudinary Setup
1. Sign up at https://cloudinary.com
2. Go to Dashboard > Settings > Upload
3. Create an unsigned upload preset named "ads_algorithm"
4. Copy your Cloud Name from the Dashboard

### Supabase Setup
1. Sign up at https://supabase.com
2. Create a new project
3. Go to Settings > API
4. Copy the Project URL and anon key

### Database Tables
Run this SQL in your Supabase SQL Editor:

```sql
-- Videos Table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video Metadata Table
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

-- Ad Performance Table
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
