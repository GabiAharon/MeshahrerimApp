// Supabase Client Configuration
// Reads from window.APP_CONFIG which is generated at build time from environment variables.

(function() {
    const config = window.APP_CONFIG || {};
    const SUPABASE_URL = config.SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || '';
    const FAULT_PHOTOS_BUCKET = 'fault-photos';
    const MARKETPLACE_PHOTOS_BUCKET = 'marketplace-photos';

    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        window.supabaseClient = null;
    }

    const withClient = () => {
        if (!window.supabaseClient) {
            return { error: { message: 'Supabase not configured' } };
        }
        return { client: window.supabaseClient };
    };

    const buildPhotoPath = (userId, fileName, index) => {
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        return `${userId}/${Date.now()}_${index}_${safeName}`;
    };

    window.AppAuth = {
        async getCurrentUser() {
            const { client, error } = withClient();
            if (error) return null;
            const { data: { user } } = await client.auth.getUser();
            return user;
        },

        async getCurrentSession() {
            const { client, error } = withClient();
            if (error) return null;
            const { data: { session } } = await client.auth.getSession();
            return session;
        },

        async getUserProfile(userId) {
            const { client, error: clientError } = withClient();
            if (clientError) return null;

            const { data, error } = await client
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

        async ensureCurrentUserProfile(fallback = {}) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const { data: userData, error: userError } = await client.auth.getUser();
            const user = userData?.user;
            if (userError || !user) {
                return { data: null, error: userError || { message: 'Not authenticated' } };
            }

            const { data: existingProfile, error: existingError } = await client
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (existingError) return { data: null, error: existingError };
            if (existingProfile) return { data: existingProfile, error: null };

            const metadata = user.user_metadata || {};
            const fallbackUserType = fallback.user_type || metadata.user_type;
            const normalizedUserType = fallbackUserType === 'owner' ? 'owner' : 'tenant';

            const payload = {
                id: user.id,
                email: user.email || fallback.email || '',
                full_name: fallback.full_name || metadata.full_name || metadata.name || (user.email ? user.email.split('@')[0] : 'Resident'),
                apartment: fallback.apartment || metadata.apartment || '',
                phone: fallback.phone || metadata.phone || null,
                user_type: normalizedUserType
            };

            const { data, error } = await client
                .from('profiles')
                .upsert(payload, { onConflict: 'id' })
                .select()
                .single();

            return { data, error };
        },

        async getCurrentProfile() {
            const user = await this.getCurrentUser();
            if (!user) return null;
            return this.getUserProfile(user.id);
        },

        async isUserApproved(userId) {
            const profile = await this.getUserProfile(userId);
            return profile?.is_approved === true;
        },

        async isUserAdmin(userId) {
            const profile = await this.getUserProfile(userId);
            return profile?.is_admin === true;
        },

        async signUp(email, password, metadata) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: metadata
                }
            });
            return { data, error };
        },

        async signIn(email, password) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { data, error } = await client.auth.signInWithPassword({ email, password });
            return { data, error };
        },

        async signOut() {
            const { client, error } = withClient();
            if (error) return;
            await client.auth.signOut();
        },

        onAuthStateChange(callback) {
            const { client, error } = withClient();
            if (error) return () => {};

            const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
                callback(event, session);
            });
            return () => subscription.unsubscribe();
        },

        async updateMyProfile(userId, updates) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { data, error } = await client
                .from('profiles')
                .update(updates)
                .eq('id', userId)
                .select()
                .single();
            return { data, error };
        },

        async approveUser(userId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { error } = await client
                .from('profiles')
                .update({ is_approved: true })
                .eq('id', userId);
            return { data: null, error };
        },

        async rejectUser(userId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { error } = await client
                .from('profiles')
                .update({ is_approved: false })
                .eq('id', userId);
            return { data: null, error };
        },

        async getPendingUsers() {
            const { client, error } = withClient();
            if (error) return { data: [], error: null };

            const result = await client
                .from('profiles')
                .select('*')
                .eq('is_approved', false)
                .order('created_at', { ascending: false });
            return { data: result.data || [], error: result.error };
        },

        async getAllUsers() {
            const { client, error } = withClient();
            if (error) return { data: [], error: null };

            const result = await client
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            return { data: result.data || [], error: result.error };
        },

        async getAdminUsers() {
            const { client, error } = withClient();
            if (error) return { data: [], error: null };

            const result = await client
                .from('profiles')
                .select('id, email, full_name')
                .eq('is_admin', true);
            return { data: result.data || [], error: result.error };
        },

        async getProfessionals({ includeUnapproved = false } = {}) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };

            let query = client
                .from('professionals')
                .select('*')
                .order('created_at', { ascending: false });

            if (!includeUnapproved) {
                query = query.eq('is_approved', true);
            }

            const { data, error } = await query;
            return { data: data || [], error };
        },

        async updateProfessionalApproval(professionalId, isApproved) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const { data, error } = await client
                .from('professionals')
                .update({ is_approved: !!isApproved })
                .eq('id', professionalId)
                .select()
                .single();

            return { data, error };
        },

        async deleteProfessional(professionalId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { error } = await client
                .from('professionals')
                .delete()
                .eq('id', professionalId);
            return { error };
        },

        async addProfessional({ name, profession, phone, description, isApproved = false }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const profile = await this.getCurrentProfile();
            if (!profile) {
                return { data: null, error: { message: 'User profile not found' } };
            }
            if (!profile.is_admin && !profile.is_approved) {
                return { data: null, error: { message: 'החשבון שלך עדיין ממתין לאישור מנהל' } };
            }

            const allowDirectApprove = profile.is_admin === true && isApproved === true;

            const { data, error } = await client
                .from('professionals')
                .insert({
                    name: String(name || '').trim(),
                    profession: String(profession || '').trim(),
                    phone: phone ? String(phone).trim() : null,
                    description: description ? String(description).trim() : null,
                    recommended_by: user.id,
                    is_approved: allowDirectApprove
                })
                .select()
                .single();

            return { data, error };
        },

        async getPolls({ includeInactive = false } = {}) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { data: [], error: { message: 'Not authenticated' } };

            let pollQuery = client
                .from('polls')
                .select('id,question,options,is_active,ends_at,created_at')
                .order('created_at', { ascending: false });

            if (!includeInactive) {
                pollQuery = pollQuery.eq('is_active', true);
            }

            const { data: polls, error: pollsError } = await pollQuery;
            if (pollsError) return { data: [], error: pollsError };

            const pollIds = (polls || []).map((p) => p.id);
            if (pollIds.length === 0) return { data: [], error: null };

            const { data: votes, error: votesError } = await client
                .from('poll_votes')
                .select('poll_id,option_id,user_id')
                .in('poll_id', pollIds);

            if (votesError) return { data: [], error: votesError };

            const votesByPoll = {};
            (votes || []).forEach((vote) => {
                if (!votesByPoll[vote.poll_id]) votesByPoll[vote.poll_id] = [];
                votesByPoll[vote.poll_id].push(vote);
            });

            const normalized = (polls || []).map((poll) => {
                const voteRows = votesByPoll[poll.id] || [];
                const optionCounts = {};
                let userVote = null;

                voteRows.forEach((vote) => {
                    optionCounts[vote.option_id] = (optionCounts[vote.option_id] || 0) + 1;
                    if (vote.user_id === user.id) userVote = vote.option_id;
                });

                const options = Array.isArray(poll.options)
                    ? poll.options.map((option, index) => {
                        const optionId = option.id || `opt_${index + 1}`;
                        return {
                            id: optionId,
                            text: option.text || option.label || '',
                            votes: optionCounts[optionId] || 0
                        };
                    })
                    : [];

                return {
                    id: poll.id,
                    question: poll.question,
                    options,
                    is_active: !!poll.is_active,
                    ends_at: poll.ends_at,
                    created_at: poll.created_at,
                    user_vote: userVote
                };
            });

            return { data: normalized, error: null };
        },

        async createPoll({ question, options = [], endsAt = null }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const normalizedOptions = (options || [])
                .map((option, index) => ({
                    id: `opt_${index + 1}`,
                    text: String(option || '').trim()
                }))
                .filter((option) => option.text);

            if (!String(question || '').trim() || normalizedOptions.length < 2) {
                return { data: null, error: { message: 'Poll must have a question and at least 2 options' } };
            }

            const { data, error } = await client
                .from('polls')
                .insert({
                    question: String(question).trim(),
                    options: normalizedOptions,
                    created_by: user.id,
                    is_active: true,
                    ends_at: endsAt || null
                })
                .select()
                .single();

            return { data, error };
        },

        async votePoll({ pollId, optionId }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const { data, error } = await client
                .from('poll_votes')
                .insert({
                    poll_id: pollId,
                    user_id: user.id,
                    option_id: optionId
                })
                .select()
                .single();

            return { data, error };
        },

        async closePoll(pollId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const { data, error } = await client
                .from('polls')
                .update({ is_active: false })
                .eq('id', pollId)
                .select()
                .single();

            return { data, error };
        },

        async deletePoll(pollId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { error } = await client
                .from('polls')
                .delete()
                .eq('id', pollId);
            return { error };
        },

        async uploadMarketplacePhotos(files, userId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };
            if (!Array.isArray(files) || files.length === 0) return { data: [], error: null };

            const uploadedUrls = [];
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                const objectPath = buildPhotoPath(userId, file.name || `market_${i}.jpg`, i);
                const { error } = await client.storage
                    .from(MARKETPLACE_PHOTOS_BUCKET)
                    .upload(objectPath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) return { data: [], error };

                const { data: publicData } = client.storage
                    .from(MARKETPLACE_PHOTOS_BUCKET)
                    .getPublicUrl(objectPath);
                uploadedUrls.push(publicData.publicUrl);
            }

            return { data: uploadedUrls, error: null };
        },

        async getMarketplaceItems({ includeInactive = false } = {}) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };

            let query = client
                .from('marketplace')
                .select('id,title,description,price,category,photos,is_active,created_at,user_id,profiles(full_name,apartment)')
                .order('created_at', { ascending: false });

            if (!includeInactive) {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;
            return { data: data || [], error };
        },

        async createMarketplaceItem({ title, description, category, price = null, files = [] }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const uploadResult = await this.uploadMarketplacePhotos(files || [], user.id);
            if (uploadResult.error) return { data: null, error: uploadResult.error };

            const payload = {
                user_id: user.id,
                title: String(title || '').trim(),
                description: description ? String(description).trim() : null,
                category: category || 'give',
                price: category === 'sell' ? Number(price) || 0 : null,
                photos: uploadResult.data,
                is_active: true
            };

            const { data, error } = await client
                .from('marketplace')
                .insert(payload)
                .select()
                .single();

            return { data, error };
        },

        async closeMarketplaceItem(itemId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const { data, error } = await client
                .from('marketplace')
                .update({ is_active: false })
                .eq('id', itemId)
                .select()
                .single();

            return { data, error };
        },

        async deleteMarketplaceItem(itemId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { error } = await client
                .from('marketplace')
                .delete()
                .eq('id', itemId);
            return { error };
        },

        async getPaymentsForYear(year) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };

            const { data, error } = await client
                .from('payments')
                .select('id,user_id,apartment,year,amount,is_paid,paid_at,created_at,profiles(full_name,apartment,email)')
                .eq('year', year)
                .order('apartment', { ascending: true });

            return { data: data || [], error };
        },

        async getFinanceSettings() {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const { data, error } = await client
                .from('finance_settings')
                .select('*')
                .eq('id', 1)
                .maybeSingle();

            if (error) return { data: null, error };
            return { data: data || { id: 1, annual_fee: 0, apartments: [] }, error: null };
        },

        async saveFinanceSettings({ annualFee, apartments = [] }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: null, error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const normalizedApartments = (apartments || [])
                .map((item) => String(item || '').trim())
                .filter(Boolean);

            const { data, error } = await client
                .from('finance_settings')
                .upsert(
                    {
                        id: 1,
                        annual_fee: Number(annualFee) || 0,
                        apartments: normalizedApartments,
                        updated_by: user.id
                    },
                    { onConflict: 'id' }
                )
                .select()
                .single();

            return { data, error };
        },

        async setPaymentStatus({ userId, apartment, year, isPaid, amount = 0 }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const paidAt = isPaid ? new Date().toISOString() : null;
            const apartmentKey = String(apartment || '').trim();
            if (!apartmentKey) return { error: { message: 'Apartment is required' } };

            const { data, error } = await client
                .from('payments')
                .upsert(
                    {
                        user_id: userId || null,
                        apartment: apartmentKey,
                        year,
                        amount: Number(amount) || 0,
                        is_paid: !!isPaid,
                        paid_at: paidAt
                    },
                    {
                        onConflict: 'apartment,year'
                    }
                )
                .select()
                .single();

            return { data, error };
        },

        async getExpenses({ limit = 200 } = {}) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };

            const { data, error } = await client
                .from('expenses')
                .select('*')
                .order('expense_date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit);

            return { data: data || [], error };
        },

        async createExpense({ category, amount, description }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { error: { message: 'Not authenticated' } };

            const payload = {
                category,
                amount: Number(amount) || 0,
                description: description || null,
                created_by: user.id,
                expense_date: new Date().toISOString().slice(0, 10)
            };

            const { data, error } = await client
                .from('expenses')
                .insert(payload)
                .select()
                .single();

            return { data, error };
        },

        subscribeToPendingUsers(onChange) {
            const { client, error } = withClient();
            if (error || !client || typeof onChange !== 'function') return () => {};

            const channel = client
                .channel('profiles-pending-watch')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'profiles' },
                    () => onChange()
                )
                .subscribe();

            return () => {
                try {
                    client.removeChannel(channel);
                } catch (e) {
                    console.warn('Failed to remove profiles-pending-watch channel', e);
                }
            };
        },

        async createAdminInviteLink(hours = 24) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { data, error } = await client.rpc('create_admin_invite', {
                p_expires_hours: hours
            });
            if (error) return { error };

            const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
            return {
                data: `${baseUrl}auth.html?invite_code=${encodeURIComponent(data)}`
            };
        },

        async claimAdminInvite(inviteCode) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { data, error } = await client.rpc('claim_admin_invite', {
                p_code: inviteCode
            });
            return { data, error };
        },

        async uploadFaultPhotos(files, userId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };
            if (!Array.isArray(files) || files.length === 0) return { data: [], error: null };

            const uploadedUrls = [];
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                const objectPath = buildPhotoPath(userId, file.name || `photo_${i}.jpg`, i);
                const { error } = await client.storage
                    .from(FAULT_PHOTOS_BUCKET)
                    .upload(objectPath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) return { data: [], error };

                const { data: publicData } = client.storage
                    .from(FAULT_PHOTOS_BUCKET)
                    .getPublicUrl(objectPath);
                uploadedUrls.push(publicData.publicUrl);
            }

            return { data: uploadedUrls, error: null };
        },

        async createFault({ category, description, location, files, preservePhotos = false }) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { error: { message: 'Not authenticated' } };

            const uploadResult = await this.uploadFaultPhotos(files || [], user.id);
            if (uploadResult.error) return { error: uploadResult.error };

            const payload = {
                user_id: user.id,
                category,
                description,
                location: location || null,
                photos: uploadResult.data,
                preserve_photos: preservePhotos
            };

            const { data, error } = await client
                .from('faults')
                .insert(payload)
                .select('*')
                .single();
            return { data, error };
        },

        async getFaults({ onlyMine = false } = {}) {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { data: [], error: { message: 'Not authenticated' } };

            let query = client
                .from('faults')
                .select('id,user_id,category,description,location,status,photos,created_at,updated_at,profiles(apartment,full_name)')
                .order('created_at', { ascending: false });

            if (onlyMine) {
                query = query.eq('user_id', user.id);
            }

            const { data, error } = await query;
            return { data: data || [], error };
        },

        async updateFaultStatus(faultId, status) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { data, error } = await client
                .from('faults')
                .update({ status })
                .eq('id', faultId)
                .select()
                .single();
            return { data, error };
        },

        async deleteFault(faultId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { error } = await client
                .from('faults')
                .delete()
                .eq('id', faultId);
            return { error };
        },

        async createNotice(payload) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const user = await this.getCurrentUser();
            if (!user) return { error: { message: 'Not authenticated' } };

            const { data, error } = await client
                .from('notices')
                .insert({
                    title: payload.title,
                    content: payload.content || '',
                    type: payload.type || 'info',
                    created_by: user.id,
                    is_active: true
                })
                .select()
                .single();
            return { data, error };
        },

        async sendPushBroadcast(payload) {
            try {
                const response = await fetch('/api/send-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: payload.title,
                        message: payload.message || payload.content || '',
                        url: payload.url || '/index.html'
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    return { error: { message: data.error || 'Push send failed' } };
                }
                return { data, error: null };
            } catch (error) {
                return { error };
            }
        },

        async getActiveNotices() {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: clientError };

            const { data, error } = await client
                .from('notices')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            return { data: data || [], error };
        },

        async deleteNotice(noticeId) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { error } = await client
                .from('notices')
                .delete()
                .eq('id', noticeId);
            return { error };
        },

        async setFaultPhotoPreservation(faultId, preserve = true) {
            const { client, error: clientError } = withClient();
            if (clientError) return { error: clientError };

            const { data, error } = await client
                .from('faults')
                .update({ preserve_photos: preserve })
                .eq('id', faultId)
                .select()
                .single();
            return { data, error };
        },

        async getFaultPhotoRetentionStatus() {
            const { client, error: clientError } = withClient();
            if (clientError) return { data: [], error: null };

            const { data, error } = await client
                .from('faults')
                .select('id,category,preserve_photos,photos_expires_at,created_at,status')
                .not('photos', 'is', null)
                .order('photos_expires_at', { ascending: true, nullsFirst: false });
            return { data: data || [], error };
        }
    };
})();
