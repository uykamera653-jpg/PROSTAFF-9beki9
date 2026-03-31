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

    // Get order details including rejected_by and shown_to
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('category_id, rejected_by, shown_to')
      .eq('id', payload.orderId)
      .single();

    if (orderError) {
      throw new Error(`Order not found: ${orderError.message}`);
    }

    const rejectedWorkerIds = orderData.rejected_by || [];
    console.log(`🚫 Rejected by ${rejectedWorkerIds.length} workers`);

    // Get workers in this category
    const { data: workerCategories, error: wcError } = await supabaseAdmin
      .from('worker_categories')
      .select('worker_id')
      .eq('category_id', orderData.category_id);

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

    // Get online workers with location who haven't rejected this order
    const { data: workers, error: workersError } = await supabaseAdmin
      .from('workers')
      .select('id, latitude, longitude')
      .in('id', workerIds)
      .eq('is_online', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (workersError) {
      throw new Error(`Failed to get workers: ${workersError.message}`);
    }

    // Get already shown_to workers for this order
    const shownToWorkerIds: string[] = orderData.shown_to || [];
    console.log(`👁️ Already shown to ${shownToWorkerIds.length} workers`);

    // Filter out rejected and already-shown workers, calculate distances
    const MAX_DISTANCE_KM = 10;
    const nearbyWorkers = workers
      .filter(w => !rejectedWorkerIds.includes(w.id) && !shownToWorkerIds.includes(w.id))
      .map(w => {
        const distance = calculateDistance(
          payload.latitude,
          payload.longitude,
          w.latitude!,
          w.longitude!
        );
        return { ...w, distance };
      })
      .filter(w => w.distance <= MAX_DISTANCE_KM)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3); // Send to max 3 workers at a time

    const onlineWorkerIds = nearbyWorkers.map(w => w.id);
    console.log(`🟢 ${onlineWorkerIds.length} workers selected (max 3) within ${MAX_DISTANCE_KM}km`);

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

    // Double-check workers are still online before sending
    const { data: onlineCheck, error: onlineError } = await supabaseAdmin
      .from('workers')
      .select('id, is_online')
      .in('id', tokens.map(t => t.user_id));

    if (onlineError) {
      console.error('⚠️ Failed to verify online status:', onlineError);
    }

    // Filter tokens to only send to currently online workers
    const finalTokens = tokens.filter(token => {
      const worker = onlineCheck?.find(w => w.id === token.user_id);
      const stillOnline = worker?.is_online === true;
      
      if (!stillOnline) {
        console.log(`⏸️ Worker ${token.user_id} is now offline, skipping notification`);
      }
      
      return stillOnline;
    });

    console.log(`📱 ${finalTokens.length}/${tokens.length} workers still online`);

    if (finalTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No workers online at send time' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update shown_to array to track which workers received this order
    const newShownToIds = [...new Set([...shownToWorkerIds, ...finalTokens.map(t => t.user_id)])];
    await supabaseAdmin
      .from('orders')
      .update({ shown_to: newShownToIds })
      .eq('id', payload.orderId);
    console.log(`✅ Updated shown_to: ${newShownToIds.length} workers total`);

    // Send push notifications via Expo Push API
    const messages = finalTokens.map(token => {
      // Find worker distance
      const worker = nearbyWorkers.find(w => w.id === token.user_id);
      const distance = worker ? ` (${worker.distance.toFixed(1)}km)` : '';

      return {
        to: token.token,
        sound: 'default',
        title: `🔔 Yangi buyurtma${distance}`,
        body: `📍 ${payload.location}\n${payload.description.substring(0, 100)}`,
      data: {
        orderId: payload.orderId,
        category: payload.category,
        screen: 'order-detail',
      },
      priority: 'high',
      channelId: 'new-orders', // ✅ Android notification channel (with sound settings)
      badge: 1, // iOS badge count
      ttl: 600, // 10 minutes expiry
      
      // Android-specific settings
      android: {
        sound: 'default',
        priority: 'max',
        vibrate: [0, 250, 250, 250],
        channelId: 'new-orders',
      },
      
      // iOS-specific settings
      ios: {
        sound: 'default',
        badge: 1,
        priority: 'high',
      },
      };
    });

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
