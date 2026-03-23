import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface OrderNotificationPayload {
  orderId: string;
  category: string;
  location: string;
  latitude: number;
  longitude: number;
  description: string;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: OrderNotificationPayload = await req.json();
    console.log('📨 Sending notifications for order:', payload.orderId);

    // Get category ID
    const { data: categoryData, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .ilike('name_uz', `%${payload.category}%`)
      .single();

    if (catError) {
      throw new Error(`Category not found: ${catError.message}`);
    }

    // Get workers in this category
    const { data: workerCategories, error: wcError } = await supabaseAdmin
      .from('worker_categories')
      .select('worker_id')
      .eq('category_id', categoryData.id);

    if (wcError) {
      throw new Error(`Failed to get worker categories: ${wcError.message}`);
    }

    const workerIds = workerCategories.map(wc => wc.worker_id);
    console.log(`📋 Found ${workerIds.length} workers in category`);

    if (workerIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No workers in this category' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get online workers with push tokens
    const { data: workers, error: workersError } = await supabaseAdmin
      .from('workers')
      .select('id')
      .in('id', workerIds)
      .eq('is_online', true);

    if (workersError) {
      throw new Error(`Failed to get workers: ${workersError.message}`);
    }

    const onlineWorkerIds = workers.map(w => w.id);
    console.log(`🟢 ${onlineWorkerIds.length} online workers`);

    if (onlineWorkerIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No online workers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push tokens for online workers
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', onlineWorkerIds);

    if (tokensError) {
      throw new Error(`Failed to get push tokens: ${tokensError.message}`);
    }

    console.log(`📱 ${tokens.length} push tokens found`);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No push tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance and filter nearby workers (within 10km)
    const MAX_DISTANCE_KM = 10;
    const nearbyTokens = tokens.filter(token => {
      // For now, send to all online workers
      // In production, you'd calculate actual distance based on worker's last known location
      return true;
    });

    console.log(`📍 ${nearbyTokens.length} nearby workers`);

    // Send push notifications via Expo Push API
    const messages = nearbyTokens.map(token => ({
      to: token.token,
      sound: 'default', // ✅ OVOZ bilan notification
      title: `🔔 Yangi buyurtma: ${payload.category}`,
      body: `📍 ${payload.location}\n${payload.description.substring(0, 100)}`,
      data: {
        orderId: payload.orderId,
        category: payload.category,
        screen: 'order-detail',
      },
      priority: 'high',
      channelId: 'new-orders', // Android notification channel
      badge: 1, // iOS badge count
      ttl: 600, // 10 minutes expiry
    }));

    // Send to Expo Push Notification service
    const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
    const responses = await Promise.all(
      messages.map(message =>
        fetch(expoPushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        })
      )
    );

    const results = await Promise.all(responses.map(r => r.json()));
    const successCount = results.filter(r => r.data?.status === 'ok').length;

    console.log(`✅ Sent ${successCount}/${messages.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: messages.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
