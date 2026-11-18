import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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

    // ── Billing cleanup (every role) ──
    // Stop all recurring charges and remove saved cards. The Stripe customer
    // object and past invoices are retained for tax/financial record-keeping,
    // as stated in the Privacy Policy.
    if (stripe && profile.stripe_customer_id) {
      try {
        const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'all', limit: 20 });
        for (const sub of subs.data) {
          if (['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)) {
            await stripe.subscriptions.cancel(sub.id);
          }
        }
        const cards = await stripe.paymentMethods.list({ customer: profile.stripe_customer_id, type: 'card', limit: 20 });
        for (const card of cards.data) await stripe.paymentMethods.detach(card.id);
        deletionLog.push('Stripe subscriptions cancelled and saved cards removed');
      } catch (err) {
        // Don't strand the user: log for follow-up and continue with deletion.
        console.error('[data-deletion] Stripe cleanup failed', profile.stripe_customer_id, err);
        deletionLog.push('Billing cleanup needs manual follow-up');
      }
    }

    if (profile.role === 'parent') {
      // Remove parent-child links
      await supabase
        .from('parent_children')
        .delete()
        .eq('parent_id', user.id);
      deletionLog.push('Parent-child links removed');

      // Cancel any active Stripe subscriptions BEFORE deleting the rows, so a
      // deleted account doesn't keep getting billed.
      const { data: parentSubs } = await supabase
        .from('parent_subscriptions')
        .select('stripe_subscription_id')
        .eq('parent_id', user.id);
      if (stripe && parentSubs) {
        for (const sub of parentSubs) {
          const sid = (sub as { stripe_subscription_id?: string }).stripe_subscription_id;
          if (sid) {
            try {
              await stripe.subscriptions.cancel(sid);
            } catch (err) {
              console.warn('[data-deletion] Failed to cancel Stripe subscription', sid, err);
            }
          }
        }
      }

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
        // Nobody is left to manage billing — stop charging the daycare.
        const { data: daycareSub } = await supabase
          .from('subscriptions')
          .select('stripe_subscription_id')
          .eq('daycare_id', profile.daycare_id)
          .maybeSingle();
        const sid = (daycareSub as { stripe_subscription_id?: string } | null)?.stripe_subscription_id;
        if (stripe && sid) {
          try {
            await stripe.subscriptions.cancel(sid);
            deletionLog.push('Daycare subscription cancelled (no remaining admin)');
          } catch (err) {
            console.error('[data-deletion] Failed to cancel daycare subscription', sid, err);
          }
        }
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
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);
    if (profileDeleteError) {
      console.error('[data-deletion] profile delete failed', profileDeleteError);
      return new Response(
        JSON.stringify({ error: 'We could not finish deleting your account. Please contact support@littlejourney.app.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    deletionLog.push('Profile deleted');

    // Finally delete the auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      console.error('[data-deletion] auth delete failed', deleteAuthError);
      return new Response(
        JSON.stringify({ error: 'We could not finish deleting your account. Please contact support@littlejourney.app.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    deletionLog.push('Auth account deleted');

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
    console.error('[data-deletion] unexpected error', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
