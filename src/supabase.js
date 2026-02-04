// Supabase Client Configuration
// Uses environment variables from Vercel (injected by Vite at build time)

(function() {
    // Get Supabase config from Vite build (defined in vite.config.js)
    // These are replaced at build time with actual values from Vercel env vars
    // For local development, create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

    // Try to get from Vite-defined constants (production build)
    let SUPABASE_URL = '';
    let SUPABASE_ANON_KEY = '';

    try {
        // These are replaced by Vite at build time
        SUPABASE_URL = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
        SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';
    } catch (e) {
        // Fallback for local development without Vite build
        console.log('Running in development mode without Vite build');
    }

    // Fallback to window config for local development (config.js is gitignored)
    if (!SUPABASE_URL && window.APP_CONFIG) {
        SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL || '';
        SUPABASE_ANON_KEY = window.APP_CONFIG.SUPABASE_ANON_KEY || '';
    }

    // Initialize Supabase client if credentials are available
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        // Mock client for development without Supabase
        window.supabaseClient = null;
    }

    // Auth helper functions
    window.AppAuth = {
        // Get current user
        async getCurrentUser() {
            if (!window.supabaseClient) {
                // Return mock user for development
                return null;
            }
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            return user;
        },

        // Get user profile with approval status
        async getUserProfile(userId) {
            if (!window.supabaseClient) return null;

            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }
            return data;
        },

        // Check if user is approved
        async isUserApproved(userId) {
            const profile = await this.getUserProfile(userId);
            return profile?.is_approved === true;
        },

        // Check if user is admin
        async isUserAdmin(userId) {
            const profile = await this.getUserProfile(userId);
            return profile?.is_admin === true;
        },

        // Sign up new user
        async signUp(email, password, metadata) {
            if (!window.supabaseClient) {
                console.warn('Supabase not configured');
                return { error: { message: 'Supabase not configured' } };
            }

            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: metadata // full_name, apartment, user_type
                }
            });

            return { data, error };
        },

        // Sign in
        async signIn(email, password) {
            if (!window.supabaseClient) {
                console.warn('Supabase not configured');
                return { error: { message: 'Supabase not configured' } };
            }

            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            return { data, error };
        },

        // Sign in with Google
        async signInWithGoogle() {
            if (!window.supabaseClient) {
                console.warn('Supabase not configured');
                return { error: { message: 'Supabase not configured' } };
            }

            const { data, error } = await window.supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/auth.html?callback=true'
                }
            });

            return { data, error };
        },

        // Sign out
        async signOut() {
            if (!window.supabaseClient) return;
            await window.supabaseClient.auth.signOut();
        },

        // Listen to auth state changes
        onAuthStateChange(callback) {
            if (!window.supabaseClient) return () => {};

            const { data: { subscription } } = window.supabaseClient.auth.onAuthStateChange(
                (event, session) => {
                    callback(event, session);
                }
            );

            return () => subscription.unsubscribe();
        },

        // Admin: Approve user
        async approveUser(userId) {
            if (!window.supabaseClient) return { error: { message: 'Supabase not configured' } };

            const { data, error } = await window.supabaseClient
                .from('profiles')
                .update({ is_approved: true })
                .eq('id', userId);

            return { data, error };
        },

        // Admin: Get pending users
        async getPendingUsers() {
            if (!window.supabaseClient) return { data: [], error: null };

            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('is_approved', false)
                .order('created_at', { ascending: false });

            return { data: data || [], error };
        },

        // Admin: Get all users
        async getAllUsers() {
            if (!window.supabaseClient) return { data: [], error: null };

            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            return { data: data || [], error };
        }
    };
})();
