import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

interface RequestBody {
  operation: 'get_users' | 'update_role' | 'get_stats' | 'delete_user' | 'get_workers' | 'get_companies' | 'toggle_worker_online' | 'toggle_company_online' | 'toggle_worker_block' | 'toggle_company_block';
  user_id?: string;
  new_role?: string;
  worker_id?: string;
  company_id?: string;
  is_online?: boolean;
  is_blocked?: boolean;
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

    // Get authenticated user and profile in parallel for better performance
    const [authResult, profileResult] = await Promise.all([
      supabase.auth.getUser(token),
      (async () => {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return { data: null, error: { message: 'User not found' } };
        return supabase.from('user_profiles').select('role').eq('id', user.id).single();
      })()
    ]);

    const { data: { user }, error: userError } = authResult;
    
    if (userError || !user) {
      console.error('❌ User auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - foydalanuvchi topilmadi' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = profileResult;

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

    console.log('👑 Admin access granted - role:', profile.role, '| User:', user.id);

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

      case 'get_workers': {
        const { data: workers, error } = await supabase
          .from('workers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Get workers error:', error);
          return new Response(
            JSON.stringify({ error: 'Ishchilarni yuklashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Workers loaded:', workers?.length || 0);
        return new Response(
          JSON.stringify({ workers: workers || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_companies': {
        const { data: companies, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Get companies error:', error);
          return new Response(
            JSON.stringify({ error: 'Firmalarni yuklashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Companies loaded:', companies?.length || 0);
        return new Response(
          JSON.stringify({ companies: companies || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle_worker_online': {
        if (!body.worker_id || body.is_online === undefined) {
          return new Response(
            JSON.stringify({ error: 'worker_id va is_online majburiy' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`🔄 Toggling worker ${body.worker_id} online status to ${body.is_online}`);

        const { error } = await supabase
          .from('workers')
          .update({
            is_online: body.is_online,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.worker_id);

        if (error) {
          console.error('❌ Toggle worker online error:', error);
          return new Response(
            JSON.stringify({ error: 'Online holatini yangilashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Worker online status updated');
        return new Response(
          JSON.stringify({ success: true, message: 'Online holat o\'zgartirildi' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle_company_online': {
        if (!body.company_id || body.is_online === undefined) {
          return new Response(
            JSON.stringify({ error: 'company_id va is_online majburiy' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`🔄 Toggling company ${body.company_id} online status to ${body.is_online}`);

        const { error } = await supabase
          .from('companies')
          .update({
            is_online: body.is_online,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.company_id);

        if (error) {
          console.error('❌ Toggle company online error:', error);
          return new Response(
            JSON.stringify({ error: 'Online holatini yangilashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Company online status updated');
        return new Response(
          JSON.stringify({ success: true, message: 'Online holat o\'zgartirildi' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle_worker_block': {
        if (!body.worker_id || body.is_blocked === undefined) {
          return new Response(
            JSON.stringify({ error: 'worker_id va is_blocked majburiy' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`🔄 Toggling worker ${body.worker_id} block status to ${body.is_blocked}`);

        const { error } = await supabase
          .from('workers')
          .update({
            is_blocked: body.is_blocked,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.worker_id);

        if (error) {
          console.error('❌ Toggle worker block error:', error);
          return new Response(
            JSON.stringify({ error: 'Bloklash holatini yangilashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Worker block status updated');
        return new Response(
          JSON.stringify({ success: true, message: body.is_blocked ? 'Ishchi bloklandi' : 'Ishchi blokdan chiqarildi' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle_company_block': {
        if (!body.company_id || body.is_blocked === undefined) {
          return new Response(
            JSON.stringify({ error: 'company_id va is_blocked majburiy' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`🔄 Toggling company ${body.company_id} block status to ${body.is_blocked}`);

        const { error } = await supabase
          .from('companies')
          .update({
            is_blocked: body.is_blocked,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.company_id);

        if (error) {
          console.error('❌ Toggle company block error:', error);
          return new Response(
            JSON.stringify({ error: 'Bloklash holatini yangilashda xatolik' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Company block status updated');
        return new Response(
          JSON.stringify({ success: true, message: body.is_blocked ? 'Firma bloklandi' : 'Firma blokdan chiqarildi' }),
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
