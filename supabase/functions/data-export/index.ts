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

    // Use service role for data export (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile to determine role and scope
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

    const exportData: Record<string, unknown> = {
      exportDate: new Date().toISOString(),
      userId: user.id,
      profile: {
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        phone: profile.phone,
        role: profile.role,
        createdAt: profile.created_at,
      },
    };

    if (profile.role === 'parent') {
      // Export parent's children data
      const { data: parentChildren } = await supabase
        .from('parent_children')
        .select('child_id, relationship')
        .eq('parent_id', user.id);

      const childIds = (parentChildren || []).map((pc: any) => pc.child_id);

      if (childIds.length > 0) {
        const { data: children } = await supabase
          .from('children')
          .select('*')
          .in('id', childIds);

        const { data: timeline } = await supabase
          .from('timeline_entries')
          .select('*')
          .in('child_id', childIds)
          .order('created_at', { ascending: false });

        const { data: attendance } = await supabase
          .from('attendance')
          .select('*')
          .in('child_id', childIds)
          .order('date', { ascending: false });

        const { data: milestones } = await supabase
          .from('milestones')
          .select('*')
          .in('child_id', childIds)
          .order('achieved_at', { ascending: false });

        const { data: incidents } = await supabase
          .from('incidents')
          .select('*')
          .in('child_id', childIds)
          .order('created_at', { ascending: false });

        exportData.children = children;
        exportData.timelineEntries = timeline;
        exportData.attendance = attendance;
        exportData.milestones = milestones;
        exportData.incidents = incidents;
      }

      // Export messages
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      const convIds = (memberships || []).map((m: any) => m.conversation_id);

      if (convIds.length > 0) {
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', convIds)
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false });

        exportData.messagesSent = messages;
      }

      // Export invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false });

      exportData.invoices = invoices;
    }

    if (profile.role === 'admin' && profile.daycare_id) {
      // Admin gets full daycare export
      const { data: daycare } = await supabase
        .from('daycares')
        .select('*')
        .eq('id', profile.daycare_id)
        .single();

      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('*')
        .eq('daycare_id', profile.daycare_id);

      const { data: children } = await supabase
        .from('children')
        .select('*')
        .eq('daycare_id', profile.daycare_id);

      const { data: staff } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .eq('daycare_id', profile.daycare_id);

      exportData.daycare = daycare;
      exportData.classrooms = classrooms;
      exportData.children = children;
      exportData.staff = staff;
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="littlejourney-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
