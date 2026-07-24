-- Phase 4: Profile Themes

-- Add theme customization columns to the profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_theme_color TEXT,
ADD COLUMN IF NOT EXISTS profile_theme_style TEXT DEFAULT 'solid',
ADD COLUMN IF NOT EXISTS profile_cover_url TEXT;

-- Comment on new columns for visibility
COMMENT ON COLUMN profiles.profile_theme_color IS 'Hex color or CSS variable for the custom profile background theme';
COMMENT ON COLUMN profiles.profile_theme_style IS 'Style type of the theme: solid, gradient, glass, mesh, etc.';
COMMENT ON COLUMN profiles.profile_cover_url IS 'Optional cover image URL for the top of the profile';
