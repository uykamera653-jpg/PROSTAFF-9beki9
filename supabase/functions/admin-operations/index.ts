import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

interface RequestBody {
  operation: 'get_users' | 'update_role' | 'get_stats' | 'delete_user';
  user_id?: string;
  new_role?: string;
}

Deno.serve(async (req) => {
  // CORS preflight check
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract JWT token
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - token yo\'q' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ User auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - foydalanuvchi topilmadi' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Check if user is admin or moderator
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile topilmadi' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.role !== 'admin' && profile.role !== 'moderator') {
      console.error('⛔ Access denied - role:', profile.role);
      return new Response(
        JSON.stringify({ error: 'Access denied - faqat admin va moderator uchun' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👑 Admin access granted - role:', profile.role);

    // Parse request body
    const body: RequestBody = await req.json();
    console.log('📨 Operation:', body.operation);

    // Handle operations
    switch (body.operation) {
      case 'get_users': {
        const { data: users, error } = await supabase
          .from('user_profiles')
          .select('id, name, email, role, created_at')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Get users error:', error);
          return new Response(
            JSON.stringify({ error: 'Foydalanuvchilarni yuklashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Users loaded:', users?.length || 0);
        return new Response(
          JSON.stringify({ users: users || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_stats': {
        const { data: users, error } = await supabase
          .from('user_profiles')
          .select('role');

        if (error) {
          console.error('❌ Get stats error:', error);
          return new Response(
            JSON.stringify({ error: 'Statistikani yuklashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const stats = {
          total: users?.length || 0,
          admin: users?.filter(u => u.role === 'admin').length || 0,
          moderator: users?.filter(u => u.role === 'moderator').length || 0,
          worker: users?.filter(u => u.role === 'worker').length || 0,
          company: users?.filter(u => u.role === 'company').length || 0,
          customer: users?.filter(u => u.role === 'customer').length || 0,
        };

        console.log('✅ Stats loaded:', stats);
        return new Response(
          JSON.stringify({ stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_role': {
        if (!body.user_id || !body.new_role) {
          return new Response(
            JSON.stringify({ error: 'user_id va new_role majburiy' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if new role is valid
        const validRoles = ['customer', 'worker', 'company', 'admin', 'moderator'];
        if (!validRoles.includes(body.new_role)) {
          return new Response(
            JSON.stringify({ error: 'Noto\'g\'ri rol' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`🔄 Updating role for user ${body.user_id} to ${body.new_role}`);

        const { error } = await supabase
          .from('user_profiles')
          .update({
            role: body.new_role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.user_id);

        if (error) {
          console.error('❌ Update role error:', error);
          return new Response(
            JSON.stringify({ error: 'Rolni yangilashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Role updated successfully');
        return new Response(
          JSON.stringify({ success: true, message: `Rol ${body.new_role}ga o'zgartirildi` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_user': {
        // Foydalanuvchini o'chirish (ixtiyoriy - qo'shimcha xususiyat)
        if (!body.user_id) {
          return new Response(
            JSON.stringify({ error: 'user_id majburiy' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Cannot delete yourself
        if (body.user_id === user.id) {
          return new Response(
            JSON.stringify({ error: 'O\'zingizni o\'chira olmaysiz' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`🗑️ Deleting user ${body.user_id}`);

        // Create admin client
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Delete from auth.users (will cascade to user_profiles)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(body.user_id);

        if (deleteError) {
          console.error('❌ Delete user error:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Foydalanuvchini o\'chirishda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ User deleted successfully');
        return new Response(
          JSON.stringify({ success: true, message: 'Foydalanuvchi o\'chirildi' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Noto\'g\'ri operatsiya' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('❌ Server error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server xatoligi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
