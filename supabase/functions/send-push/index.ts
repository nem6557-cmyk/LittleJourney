// Supabase Edge Function: Send Push Notifications via Expo
// Triggered by database webhooks when new notifications are created

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

serve(async (req) => {
  try {
    // Authorize the request: it must come from EITHER an internal Supabase
    // webhook (carrying the shared secret) OR an authenticated staff user.
    // Anything else is rejected — never send pushes for an unauthenticated caller.
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    const isInternalWebhook = !!webhookSecret && providedSecret === webhookSecret;

    if (!isInternalWebhook) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      // Verify the JWT for a client-initiated call
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      // Verify caller is staff (caregiver or admin)
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!callerProfile || !['caregiver', 'admin'].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden: staff only' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const { record } = await req.json();

    if (!record?.user_id) {
      return new Response('Missing user_id', { status: 400 });
    }

    // Get user's push token
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', record.user_id)
      .single();

    if (!profile?.push_token) {
      return new Response(JSON.stringify({ skipped: 'No push token' }), { status: 200 });
    }

    // Determine priority based on notification type
    const isUrgent = record.type === 'incident' || record.type === 'alert';

    const message: PushMessage = {
      to: profile.push_token,
      title: record.title,
      body: record.body,
      data: record.data || {},
      sound: isUrgent ? 'default' : undefined,
      priority: isUrgent ? 'high' : 'default',
      channelId: isUrgent ? 'urgent' : 'default',
    };

    // Send via Expo Push API
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    return new Response(JSON.stringify({ sent: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
