
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const allowedRoles = ['manager', 'staff'] as const;

type CompanyRole = typeof allowedRoles[number];

function isCompanyRole(value: unknown): value is CompanyRole {
  return typeof value === 'string' &&
    allowedRoles.includes(value as CompanyRole);
}

Deno.serve(async (req) => {
  // Handle browser CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = Deno.env.get('APP_URL');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    return json({
      error: 'The function is missing required server configuration.',
    }, 500);
  }

  const authorization = req.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Authentication is required.' }, 401);
  }

  const token = authorization.slice('Bearer '.length);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Verify the authenticated user.
  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);

  const user = authData?.user;

  if (authError || !user) {
    return json({
      error: 'Your session is invalid or expired.',
    }, 401);
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return json({
      error: 'A valid JSON request body is required.',
    }, 400);
  }

  const action = body.action;

  // The selected business ID is a selector, not proof of authorization.
  // Every request is checked against the authenticated user's active
  // Company Admin membership for that exact company.
  const requestedBusinessId =
    typeof body.businessId === 'string'
      ? body.businessId.trim()
      : '';

  if (!requestedBusinessId) {
    return json({
      error: 'Select a company before managing its employees.',
    }, 400);
  }

  const { data: adminMembership, error: membershipError } =
    await adminClient
      .from('business_members')
      .select('business_id, role, active')
      .eq('user_id', user.id)
      .eq('business_id', requestedBusinessId)
      .eq('active', true)
      .eq('role', 'admin')
      .maybeSingle();

  if (membershipError) {
    console.error(
      'Company admin membership lookup failed:',
      membershipError,
    );

    return json({
      error: 'Unable to verify your company administrator access.',
    }, 500);
  }

  if (!adminMembership) {
    return json({
      error: 'You are not an active Company Admin for the selected company.',
    }, 403);
  }

  // Use the verified membership's business ID for all subsequent operations.
  const businessId = adminMembership.business_id;

  // --------------------------------------------------
  // LIST COMPANY EMPLOYEES AND PENDING INVITATIONS
  // --------------------------------------------------

  if (action === 'list') {
    const [
      { data: members, error: membersError },
      { data: invitations, error: invitationsError },
    ] = await Promise.all([
      adminClient
        .from('business_members')
        .select('user_id, business_id, role, active, created_at')
        .eq('business_id', businessId)
        .in('role', ['manager', 'staff'])
        .order('created_at', { ascending: false }),

      adminClient
        .from('business_invitations')
        .select(
          'id, business_id, email, full_name, role, status, expires_at, created_at',
        )
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .in('role', ['manager', 'staff'])
        .order('created_at', { ascending: false }),
    ]);

    if (membersError || invitationsError) {
      console.error(
        'Company employee list failed:',
        membersError || invitationsError,
      );

      return json({
        error: 'Unable to load company employees.',
      }, 500);
    }

    const userIds = (members || [])
      .map((member) => member.user_id)
      .filter(Boolean);

    let profiles: Record<
      string,
      { full_name?: string; email?: string }
    > = {};

    if (userIds.length) {
      const { data: profileRows, error: profilesError } =
        await adminClient
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

      if (profilesError) {
        console.error(
          'Company employee profiles lookup failed:',
          profilesError,
        );

        return json({
          error: 'Unable to load employee profile details.',
        }, 500);
      }

      profiles = Object.fromEntries(
        (profileRows || []).map((profile) => [
          profile.id,
          profile,
        ]),
      );
    }

    const employees = (members || []).map((member) => ({
      ...member,
      full_name: profiles[member.user_id]?.full_name || '',
      email: profiles[member.user_id]?.email || '',
    }));

    const now = Date.now();

    const pendingInvitations = (invitations || []).filter(
      (invitation) =>
        !invitation.expires_at ||
        new Date(invitation.expires_at).getTime() > now,
    );

    return json({
      employees,
      invitations: pendingInvitations,
    });
  }

  // --------------------------------------------------
  // INVITE A NEW EMPLOYEE
  // --------------------------------------------------

  if (action === 'invite_employee') {
    const fullName =
      typeof body.fullName === 'string'
        ? body.fullName.trim()
        : '';

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const role = body.role;

    if (
      !fullName ||
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return json({
        error: 'A valid employee name and email address are required.',
      }, 400);
    }

    if (!isCompanyRole(role)) {
      return json({
        error: 'Company Admins may invite Managers or Staff only.',
      }, 400);
    }

    // Check for an existing pending invitation.
    const { data: existingPending, error: pendingLookupError } =
      await adminClient
        .from('business_invitations')
        .select('id')
        .eq('business_id', businessId)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

    if (pendingLookupError) {
      console.error(
        'Pending invitation lookup failed:',
        pendingLookupError,
      );

      return json({
        error: 'Unable to check existing invitations.',
      }, 500);
    }

    if (existingPending) {
      return json({
        error: 'A pending invitation already exists for this email address.',
      }, 409);
    }

    // Check whether the employee already has an account.
    const { data: existingProfile, error: profileLookupError } =
      await adminClient
        .from('profiles')
        .select('id, email')
        .ilike('email', email)
        .maybeSingle();

    if (profileLookupError) {
      console.error(
        'Existing profile lookup failed:',
        profileLookupError,
      );

      return json({
        error: 'Unable to check the employee account.',
      }, 500);
    }

    if (existingProfile) {
      const {
        data: existingMembership,
        error: existingMembershipError,
      } = await adminClient
        .from('business_members')
        .select('user_id')
        .eq('business_id', businessId)
        .eq('user_id', existingProfile.id)
        .maybeSingle();

      if (existingMembershipError) {
        console.error(
          'Existing membership lookup failed:',
          existingMembershipError,
        );

        return json({
          error: 'Unable to check the employee membership.',
        }, 500);
      }

      if (existingMembership) {
        return json({
          error: 'This account is already a member of your company.',
        }, 409);
      }
    }

    // Invitations expire after seven days.
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Create the pending invitation first.
    // The existing database acceptance trigger remains responsible
    // for activating the membership after the invitation is accepted.
    const { data: invitation, error: invitationInsertError } =
      await adminClient
        .from('business_invitations')
        .insert({
          business_id: businessId,
          email,
          full_name: fullName,
          role,
          invited_by: user.id,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select('id')
        .single();

    if (invitationInsertError) {
      console.error(
        'Invitation record creation failed:',
        invitationInsertError,
      );

      return json({
        error: 'Unable to create the employee invitation.',
      }, 500);
    }

    // Send the Supabase invitation email.
    const { error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl.replace(/\/$/, '')}/auth/callback`,
        data: {
          full_name: fullName,
          invited_for: 'business',
          business_id: businessId,
        },
      });

    if (inviteError) {
      console.error(
        'Supabase invitation email failed:',
        inviteError,
      );

      // Revoke the pending invitation if email delivery fails.
      await adminClient
        .from('business_invitations')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)
        .eq('business_id', businessId);

      return json({
        error:
          inviteError.message ||
          'Unable to send the invitation email.',
      }, 400);
    }

    return json({
      success: true,
      invitationId: invitation.id,
    });
  }

  // --------------------------------------------------
  // UPDATE A COMPANY EMPLOYEE MEMBERSHIP
  // --------------------------------------------------

  if (action === 'update_member') {
    const userId =
      typeof body.userId === 'string'
        ? body.userId
        : '';

    if (!userId) {
      return json({
        error: 'An employee user ID is required.',
      }, 400);
    }

    const updates: Record<string, unknown> = {};

    if (body.role !== undefined) {
      if (!isCompanyRole(body.role)) {
        return json({
          error: 'Company Admins may assign Manager or Staff only.',
        }, 400);
      }

      updates.role = body.role;
    }

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') {
        return json({
          error: 'The active status must be true or false.',
        }, 400);
      }

      updates.active = body.active;
    }

    if (!Object.keys(updates).length) {
      return json({
        error: 'No valid employee changes were supplied.',
      }, 400);
    }

    // Verify that the target belongs to this company and is not
    // another Company Admin.
    const { data: target, error: targetError } =
      await adminClient
        .from('business_members')
        .select('user_id, role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .maybeSingle();

    if (targetError) {
      console.error(
        'Target membership lookup failed:',
        targetError,
      );

      return json({
        error: 'Unable to verify the employee membership.',
      }, 500);
    }

    if (!target || !['manager', 'staff'].includes(target.role)) {
      return json({
        error: 'This employee cannot be managed from the Company Admin page.',
      }, 404);
    }

    // Only update this company's membership.
    // Do not change the global profile or other company memberships.
    const { error: updateError } = await adminClient
      .from('business_members')
      .update(updates)
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .in('role', ['manager', 'staff']);

    if (updateError) {
      console.error(
        'Employee membership update failed:',
        updateError,
      );

      return json({
        error: 'Unable to update the employee membership.',
      }, 500);
    }

    return json({
      success: true,
    });
  }

  // --------------------------------------------------
  // REVOKE A PENDING INVITATION
  // --------------------------------------------------

  if (action === 'revoke_invitation') {
    const invitationId =
      typeof body.invitationId === 'string'
        ? body.invitationId
        : '';

    if (!invitationId) {
      return json({
        error: 'An invitation ID is required.',
      }, 400);
    }

    const {
      data: invitation,
      error: invitationLookupError,
    } = await adminClient
      .from('business_invitations')
      .select('id, status, role')
      .eq('id', invitationId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (invitationLookupError) {
      console.error(
        'Invitation lookup failed:',
        invitationLookupError,
      );

      return json({
        error: 'Unable to verify the invitation.',
      }, 500);
    }

    if (
      !invitation ||
      invitation.status !== 'pending' ||
      !['manager', 'staff'].includes(invitation.role)
    ) {
      return json({
        error: 'This pending invitation could not be found.',
      }, 404);
    }

    const { error: revokeError } = await adminClient
      .from('business_invitations')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', invitationId)
      .eq('business_id', businessId)
      .eq('status', 'pending');

    if (revokeError) {
      console.error(
        'Invitation revocation failed:',
        revokeError,
      );

      return json({
        error: 'Unable to revoke the invitation.',
      }, 500);
    }

    return json({
      success: true,
    });
  }

  return json({
    error: 'Unsupported company employee action.',
  }, 400);
});
