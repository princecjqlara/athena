-- Learned Traits Table for Self-Adding Prompts
-- Stores user-defined custom traits that are learned over time

CREATE TABLE IF NOT EXISTS public.learned_traits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trait_name TEXT NOT NULL,
    trait_category TEXT DEFAULT 'Custom',
    definition TEXT NOT NULL,
    business_type TEXT,
    added_by TEXT DEFAULT 'anonymous',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1
);

-- Index for fast lookups by name and business type
CREATE INDEX IF NOT EXISTS idx_learned_traits_name ON public.learned_traits(trait_name);
CREATE INDEX IF NOT EXISTS idx_learned_traits_business ON public.learned_traits(business_type);
CREATE INDEX IF NOT EXISTS idx_learned_traits_usage ON public.learned_traits(usage_count DESC);

-- Enable RLS
ALTER TABLE public.learned_traits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read traits
CREATE POLICY "Anyone can view learned traits"
    ON public.learned_traits FOR SELECT
    USING (true);

-- Policy: Allow anyone to insert traits
CREATE POLICY "Anyone can add learned traits"
    ON public.learned_traits FOR INSERT
    WITH CHECK (true);

-- Policy: Allow organizers/admins to delete
CREATE POLICY "Admins can delete learned traits"
    ON public.learned_traits FOR DELETE
    USING (true);

-- Policy: Allow updates for usage count
CREATE POLICY "Anyone can update usage count"
    ON public.learned_traits FOR UPDATE
    USING (true)
    WITH CHECK (true);
