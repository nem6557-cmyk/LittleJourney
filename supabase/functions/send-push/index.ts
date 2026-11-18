// Supabase Edge Function: deliver a push notification for an existing row in
// `notifications` via Expo.
//
// Callers: (a) the database webhook on notifications INSERT (shared secret), or
// (b) an authenticated caregiver/admin. In both cases the title/body/target are
// read from the DATABASE row, not from the request body, so a caller cannot
// push arbitrary text (phishing) to arbitrary users. Staff callers may only
// trigger pushes for notifications inside their own daycare.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin, requireCaller } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, preflight, readJson, safeEqual } from '../_shared/http.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    const provided = req.headers.get('x-webhook-secret');
    const isInternal = !!webhookSecret && !!provided && safeEqual(provided, webhookSecret);

    let callerDaycare: string | null = null;
    if (!isInternal) {
      const caller = await requireCaller(req);
      if (!['caregiver', 'admin'].includes(caller.profile.role) || !caller.profile.daycare_id) {
        throw new HttpError(403, 'Staff only.');
      }
      callerDaycare = caller.profile.daycare_id;
    }

    const { record } = await readJson<{ record?: { id?: string } }>(req);
    if (!record?.id || typeof record.id !== 'string') throw new HttpError(400, 'record.id is required.');

    const { data: notification } = await admin
      .from('notifications')
      .select('id, user_id, daycare_id, type, title, body, data')
      .eq('id', record.id)
      .single();
    if (!notification) throw new HttpError(404, 'Notification not found.');
    if (callerDaycare && notification.daycare_id !== callerDaycare) throw new HttpError(403, 'Forbidden');

    // Claim the notification: whichever caller (DB webhook or client) gets here
    // first sends it; the other becomes a no-op.
    const { data: claimed } = await admin
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', notification.id)
      .is('push_sent_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) return json({ skipped: 'Already delivered' });

    const { data: target } = await admin.from('profiles').select('push_token').eq('id', notification.user_id).single();
    if (!target?.push_token) return json({ skipped: 'No push token' });

    const urgent = notification.type === 'incident' || notification.type === 'alert';
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: target.push_token,
        title: notification.title,
        body: notification.body,
        data: notification.data ?? {},
        sound: urgent ? 'default' : undefined,
        priority: urgent ? 'high' : 'default',
        channelId: urgent ? 'urgent' : 'default',
      }),
    });
    const result = await response.json().catch(() => null);

    // Expo reports dead tokens per-ticket; clear them so we stop sending.
    const ticket = result?.data;
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      await admin.from('profiles').update({ push_token: null }).eq('id', notification.user_id);
    }

    return json({ sent: ticket?.status === 'ok' });
  } catch (err) {
    return errorResponse('send-push', err);
  }
});
