-- Public Traits Schema
-- Stores AI-generated and user-created traits shared across the platform

CREATE TABLE IF NOT EXISTS public_traits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'Custom',
    emoji TEXT DEFAULT '✨',
    description TEXT,
    
    -- Creator info
    created_by UUID REFERENCES auth.users(id),
    created_by_ai BOOLEAN DEFAULT false,
    
    -- Moderation
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    
    -- Metadata
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_public_traits_status ON public_traits(status);
CREATE INDEX idx_public_traits_group ON public_traits(group_name);
CREATE INDEX idx_public_traits_created_by ON public_traits(created_by);
CREATE UNIQUE INDEX idx_public_traits_name_unique ON public_traits(LOWER(name));

-- RLS Policies
ALTER TABLE public_traits ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved traits
CREATE POLICY "Anyone can read approved traits"
    ON public_traits FOR SELECT
    USING (status = 'approved' OR auth.uid() = created_by);

-- Authenticated users can create traits
CREATE POLICY "Authenticated users can create traits"
    ON public_traits FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Organizers can update any trait
CREATE POLICY "Organizers can update traits"
    ON public_traits FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'organizer'
        )
        OR auth.uid() = created_by
    );

-- Organizers can delete any trait
CREATE POLICY "Organizers can delete traits"
    ON public_traits FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'organizer'
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_public_traits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_public_traits_timestamp
    BEFORE UPDATE ON public_traits
    FOR EACH ROW
    EXECUTE FUNCTION update_public_traits_timestamp();
