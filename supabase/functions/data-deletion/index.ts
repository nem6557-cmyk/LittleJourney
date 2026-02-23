import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user auth
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { confirmation } = await req.json();

    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return new Response(
        JSON.stringify({ error: 'Must provide confirmation string "DELETE_MY_ACCOUNT"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for deletion (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deletionLog: string[] = [];

    // Delete user's messages
    const { count: messagesDeleted } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .eq('sender_id', user.id);
    deletionLog.push(`Messages deleted: ${messagesDeleted || 0}`);

    // Delete conversation memberships
    await supabase
      .from('conversation_members')
      .delete()
      .eq('user_id', user.id);
    deletionLog.push('Conversation memberships removed');

    // Delete comments
    const { count: commentsDeleted } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .eq('author_id', user.id);
    deletionLog.push(`Comments deleted: ${commentsDeleted || 0}`);

    // Delete reactions
    await supabase
      .from('reactions')
      .delete()
      .eq('user_id', user.id);
    deletionLog.push('Reactions removed');

    // Delete notifications
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);
    deletionLog.push('Notifications cleared');

    if (profile.role === 'parent') {
      // Remove parent-child links
      await supabase
        .from('parent_children')
        .delete()
        .eq('parent_id', user.id);
      deletionLog.push('Parent-child links removed');

      // Delete parent subscriptions
      await supabase
        .from('parent_subscriptions')
        .delete()
        .eq('parent_id', user.id);
      deletionLog.push('Parent subscriptions cancelled');
    }

    if (profile.role === 'caregiver') {
      // Remove caregiver-classroom assignments
      await supabase
        .from('caregiver_classrooms')
        .delete()
        .eq('caregiver_id', user.id);
      deletionLog.push('Classroom assignments removed');

      // Anonymize timeline entries authored by this caregiver
      await supabase
        .from('timeline_entries')
        .update({ author_id: null as any })
        .eq('author_id', user.id);
      deletionLog.push('Timeline entries anonymized');
    }

    if (profile.role === 'admin' && profile.daycare_id) {
      // Admin deletion is more complex — schedule for review
      // Don't auto-delete the entire daycare (other staff/parents depend on it)
      deletionLog.push('Admin account flagged for daycare ownership transfer');

      // Check if there are other admins
      const { data: otherAdmins } = await supabase
        .from('profiles')
        .select('id')
        .eq('daycare_id', profile.daycare_id)
        .eq('role', 'admin')
        .neq('id', user.id);

      if (!otherAdmins || otherAdmins.length === 0) {
        deletionLog.push('WARNING: No other admins found. Daycare may need ownership transfer.');
      }
    }

    // Delete storage files (avatars)
    try {
      const { data: avatarFiles } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (avatarFiles && avatarFiles.length > 0) {
        await supabase.storage
          .from('avatars')
          .remove(avatarFiles.map((f: any) => `${user.id}/${f.name}`));
        deletionLog.push(`Avatar files deleted: ${avatarFiles.length}`);
      }
    } catch {
      deletionLog.push('Avatar cleanup: no files found or already deleted');
    }

    // Delete the profile
    await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);
    deletionLog.push('Profile deleted');

    // Finally delete the auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      deletionLog.push(`Auth deletion error: ${deleteAuthError.message}`);
    } else {
      deletionLog.push('Auth account deleted');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account and associated data have been permanently deleted.',
        deletionLog,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
