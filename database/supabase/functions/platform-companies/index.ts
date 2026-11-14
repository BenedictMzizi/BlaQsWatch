import { createClient } from "@supabase/supabase-js";

const corsHeaders = {

  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":

    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",

  "Access-Control-Allow-Methods": "POST, OPTIONS",

};

type BusinessRow = {

  id: string;

  name: string;

  active: boolean;

  created_at: string;

  updated_at?: string;

};

type MembershipCountRow = {

  business_id: string;

};

type CompanyProfile = {

  full_name: string | null;

  email: string | null;

  active: boolean | null;

};

type CompanyMemberRow = {

  id: string;

  user_id: string;

  role: string;

  active: boolean;

  created_at: string;

  profiles: CompanyProfile | CompanyProfile[] | null;

};

type BusinessRelation =

  | { name: string | null }

  | { name: string | null }[]

  | null;

type EmployeeMembershipRow = {

  id: string;

  business_id: string;

  user_id: string;

  role: string;

  active: boolean;

  created_at: string;

  profiles: CompanyProfile | CompanyProfile[] | null;

  businesses: BusinessRelation;

};

type InvitationRow = {

  id: string;

  business_id: string;

  email: string;

  full_name: string;

  role: string;

  status: string;

  expires_at: string;

  created_at: string;

  businesses: BusinessRelation;

};

const json = (body: unknown, status = 200) =>

  new Response(JSON.stringify(body), {

    status,

    headers: {

      ...corsHeaders,

      "Content-Type": "application/json",

    },

  });

const fail = (message: string, status = 400) =>

  json({ error: message }, status);

const isValidEmail = (email: string) =>

  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidRole = (

  role: unknown,

): role is "admin" | "manager" | "staff" =>

  role === "admin" || role === "manager" || role === "staff";

const invitationExpiry = () =>

  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const getAuthCallbackUrl = (): string | null => {
  const appUrl = Deno.env.get("APP_URL")?.replace(/\/+$/, "");
  return appUrl ? `${appUrl}/auth/callback` : null;
};

const getProfile = (

  profile: CompanyProfile | CompanyProfile[] | null | undefined,

): CompanyProfile | null => {

  if (Array.isArray(profile)) {

    return profile[0] ?? null;

  }

  return profile ?? null;

};

const getBusinessName = (

  business: BusinessRelation | undefined,

): string => {

  if (Array.isArray(business)) {

    return business[0]?.name || "";

  }

  return business?.name || "";

};

Deno.serve(async (req: Request) => {

  if (req.method === "OPTIONS") {

    return new Response("ok", { headers: corsHeaders });

  }

  if (req.method !== "POST") {

    return fail("Method not allowed.", 405);

  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {

    return fail("Server configuration is incomplete.", 500);

  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {

    return fail("Authentication required.", 401);

  }

  const token = authHeader.slice(7);

  const authClient = createClient(supabaseUrl, anonKey, {

    auth: {

      persistSession: false,

      autoRefreshToken: false,

    },

  });

  const { data: userData, error: userError } =

    await authClient.auth.getUser(token);

  if (userError || !userData.user) {

    return fail("Your session is invalid or expired.", 401);

  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {

    auth: {

      persistSession: false,

      autoRefreshToken: false,

    },

  });

  // Verify platform administrator access.

  const { data: platformAdmin, error: platformError } = await admin

    .from("platform_admins")

    .select("user_id")

    .eq("user_id", userData.user.id)

    .eq("active", true)

    .maybeSingle();

  if (platformError) {

    return fail("Unable to verify platform permissions.", 500);

  }

  if (!platformAdmin) {

    return fail("Platform administrator access is required.", 403);

  }

  let body: Record<string, unknown>;

  try {

    body = await req.json();

  } catch {

    return fail("Invalid request body.");

  }

  const action = body.action;

  // --------------------------------------------------

  // LIST COMPANIES

  // --------------------------------------------------

  if (action === "list") {

    const { data: businesses, error } = await admin

      .from("businesses")

      .select("id,name,active,created_at,updated_at")

      .order("created_at", { ascending: false });

    if (error) {

      return fail("Unable to retrieve companies.", 500);

    }

    const businessRows = (businesses ?? []) as BusinessRow[];

    const ids = businessRows.map((business) => business.id);

    let counts: Record<string, number> = {};

    if (ids.length) {

      const { data: memberships, error: membershipError } = await admin

        .from("business_members")

        .select("business_id")

        .in("business_id", ids)

        .eq("active", true);

      if (membershipError) {

        return fail(

          "Unable to retrieve company membership counts.",

          500,

        );

      }

      const membershipRows =

        (memberships ?? []) as MembershipCountRow[];

      counts = membershipRows.reduce(

        (acc: Record<string, number>, row) => {

          acc[row.business_id] = (acc[row.business_id] || 0) + 1;

          return acc;

        },

        {},

      );

    }

    return json({

      companies: businessRows.map((business) => ({

        ...business,

        member_count: counts[business.id] || 0,

      })),

    });

  }

  // --------------------------------------------------

  // COMPANY DETAILS AND MEMBERS

  // --------------------------------------------------

  if (action === "details") {

    const businessId =

      typeof body.businessId === "string" ? body.businessId : "";

    if (!businessId) {

      return fail("A company ID is required.");

    }

    const { data: business, error: businessError } = await admin

      .from("businesses")

      .select("id,name,active,created_at,updated_at")

      .eq("id", businessId)

      .maybeSingle();

    if (businessError) {

      return fail("Unable to retrieve company details.", 500);

    }

    if (!business) {

      return fail("Company not found.", 404);

    }

    const { data: memberships, error: membershipError } = await admin

      .from("business_members")

      .select(

        "id,user_id,role,active,created_at,profiles(full_name,email,active)",

      )

      .eq("business_id", businessId)

      .order("created_at", { ascending: true });

    if (membershipError) {

      return fail("Unable to retrieve company members.", 500);

    }

    const memberRows =

      (memberships ?? []) as unknown as CompanyMemberRow[];

    return json({

      business,

      members: memberRows.map((member) => {

        const profile = getProfile(member.profiles);

        return {

          id: member.id,

          user_id: member.user_id,

          role: member.role,

          active: member.active && profile?.active !== false,

          full_name: profile?.full_name || "",

          email: profile?.email || "",

        };

      }),

    });

  }

  // --------------------------------------------------

  // ACTIVATE / DEACTIVATE COMPANY

  // --------------------------------------------------

  if (action === "set_status") {

    const businessId =

      typeof body.businessId === "string" ? body.businessId : "";

    if (!businessId || typeof body.active !== "boolean") {

      return fail(

        "A company ID and valid active status are required.",

      );

    }

    const { data: existing, error: findError } = await admin

      .from("businesses")

      .select("id,name,active")

      .eq("id", businessId)

      .maybeSingle();

    if (findError) {

      return fail("Unable to retrieve company.", 500);

    }

    if (!existing) {

      return fail("Company not found.", 404);

    }

    const { data: updated, error: updateError } = await admin

      .from("businesses")

      .update({ active: body.active })

      .eq("id", businessId)

      .select("id,name,active,updated_at")

      .single();

    if (updateError) {

      return fail("Unable to update company status.", 500);

    }

    return json({ company: updated });

  }

  // --------------------------------------------------

  // LIST GLOBAL EMPLOYEE DIRECTORY

  // --------------------------------------------------

  if (action === "list_employees") {

    // Expire outstanding invitations whose expiry date has passed.

    const now = new Date().toISOString();

    const { error: expiryError } = await admin

      .from("business_invitations")

      .update({

        status: "expired",

        updated_at: now,

      })

      .eq("status", "pending")

      .lte("expires_at", now);

    if (expiryError) {

      return fail("Unable to update expired invitations.", 500);

    }

    const { data: memberships, error: membershipError } = await admin

      .from("business_members")

      .select(

        "id,business_id,user_id,role,active,created_at,profiles(full_name,email,active),businesses(name)",

      )

      .order("created_at", { ascending: false });

    if (membershipError) {

      return fail("Unable to retrieve the employee directory.", 500);

    }

    const rows =

      (memberships ?? []) as unknown as EmployeeMembershipRow[];

    const { data: invitations, error: invitationError } = await admin

      .from("business_invitations")

      .select(

        "id,business_id,email,full_name,role,status,expires_at,created_at,businesses(name)",

      )

      .eq("status", "pending")

      .order("created_at", { ascending: false });

    if (invitationError) {

      return fail("Unable to retrieve pending invitations.", 500);

    }

    const invitationRows =

      (invitations ?? []) as unknown as InvitationRow[];

    return json({

      employees: rows.map((member) => {

        const profile = getProfile(member.profiles);

        return {

          membership_id: member.id,

          user_id: member.user_id,

          business_id: member.business_id,

          business_name: getBusinessName(member.businesses),

          full_name: profile?.full_name || "",

          email: profile?.email || "",

          role: member.role,

          active: member.active && profile?.active !== false,

          profile_active: profile?.active !== false,

          created_at: member.created_at,

        };

      }),

      invitations: invitationRows.map((invitation) => ({

        id: invitation.id,

        business_id: invitation.business_id,

        business_name: getBusinessName(invitation.businesses),

        email: invitation.email,

        full_name: invitation.full_name,

        role: invitation.role,

        status: invitation.status,

        expires_at: invitation.expires_at,

        created_at: invitation.created_at,

      })),

    });

  }

  // --------------------------------------------------

  // INVITE A NEW EMPLOYEE

  // --------------------------------------------------

  if (action === "invite_employee") {

    const businessId =

      typeof body.businessId === "string" ? body.businessId : "";

    const fullName =

      typeof body.fullName === "string" ? body.fullName.trim() : "";

    const email =

      typeof body.email === "string"

        ? body.email.trim().toLowerCase()

        : "";

    const role = body.role;

    if (!businessId) {

      return fail("Select a company.");

    }

    if (!fullName || fullName.length > 120) {

      return fail(

        "Enter the employee's full name (maximum 120 characters).",

      );

    }

    if (!isValidEmail(email) || email.length > 254) {

      return fail("Enter a valid employee email address.");

    }

    if (!isValidRole(role)) {

      return fail("Select a valid employee role.");

    }

    const { data: business, error: businessError } = await admin

      .from("businesses")

      .select("id,name,active")

      .eq("id", businessId)

      .maybeSingle();

    if (businessError) {

      return fail("Unable to verify the selected company.", 500);

    }

    if (!business) {

      return fail("Company not found.", 404);

    }

    if (!business.active) {

      return fail(

        "Employees cannot be invited to a suspended company.",

      );

    }

    const { data: existingProfile, error: profileLookupError } =

      await admin

        .from("profiles")

        .select("id,email")

        .ilike("email", email)

        .maybeSingle();

    if (profileLookupError) {

      return fail("Unable to check the employee account.", 500);

    }

    if (existingProfile) {

      return json(

        {

          error:

            "This email already has a BlaQsWatch account. Use the existing-employee assignment action instead.",

          code: "EXISTING_USER",

          userId: existingProfile.id,

        },

        409,

      );

    }

    const { data: pendingInvitation, error: pendingError } =

      await admin

        .from("business_invitations")

        .select("id")

        .eq("business_id", businessId)

        .ilike("email", email)

        .eq("status", "pending")

        .maybeSingle();

    if (pendingError) {

      return fail("Unable to check existing invitations.", 500);

    }

    if (pendingInvitation) {

      return fail(

        "There is already a pending invitation for this employee.",

        409,

      );

    }

    const redirectTo = getAuthCallbackUrl();

    if (!redirectTo) {
      return fail("The invitation redirect URL is not configured.", 500);
    }

    const { data: invitation, error: inviteError } =

      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {

          full_name: fullName,

          invited_for: "company_employee",

          business_id: businessId,

        },

      });

    if (inviteError || !invitation.user) {

      return fail(

        inviteError?.message ||

          "Unable to send the employee invitation.",

        400,

      );

    }

    const invitedUserId = invitation.user.id;

    const { error: profileError } = await admin.from("profiles").insert({

      id: invitedUserId,

      full_name: fullName,

      email,

      role,

      active: true,

    });

    if (profileError) {

      await admin.auth.admin.deleteUser(invitedUserId);

      return fail(

        "The invitation was sent, but the employee profile could not be prepared. The operation was rolled back.",

        500,

      );

    }

    // IMPORTANT:

    // A newly invited employee must not receive company access

    // until the invitation acceptance trigger activates membership.

    const { error: membershipError } = await admin

      .from("business_members")

      .insert({

        business_id: businessId,

        user_id: invitedUserId,

        role,

        active: false,

      });

    if (membershipError) {

      await admin

        .from("profiles")

        .delete()

        .eq("id", invitedUserId);

      await admin.auth.admin.deleteUser(invitedUserId);

      return fail(

        "The invitation was sent, but company membership could not be prepared. The operation was rolled back.",

        500,

      );

    }

    const { data: invitationRecord, error: invitationRecordError } =

      await admin

        .from("business_invitations")

        .insert({

          business_id: businessId,

          email,

          full_name: fullName,

          role,

          invited_by: userData.user.id,

          status: "pending",

          expires_at: invitationExpiry(),

        })

        .select("id,email,role,status,expires_at")

        .single();

    if (invitationRecordError) {

      await admin

        .from("business_members")

        .delete()

        .eq("business_id", businessId)

        .eq("user_id", invitedUserId);

      await admin

        .from("profiles")

        .delete()

        .eq("id", invitedUserId);

      await admin.auth.admin.deleteUser(invitedUserId);

      return fail(

        "The invitation was sent, but its tracking record could not be saved. The operation was rolled back.",

        500,

      );

    }

    return json(

      {

        invitation: invitationRecord,

        message: "Employee invitation sent successfully.",

      },

      201,

    );

  }

  // --------------------------------------------------

  // ASSIGN AN EXISTING EMPLOYEE TO A COMPANY

  // --------------------------------------------------

  if (action === "assign_existing_employee") {

    const businessId =

      typeof body.businessId === "string" ? body.businessId : "";

    const userId =

      typeof body.userId === "string" ? body.userId : "";

    const role = body.role;

    if (!businessId || !userId) {

      return fail(

        "A company and existing employee are required.",

      );

    }

    if (!isValidRole(role)) {

      return fail("Select a valid employee role.");

    }

    const { data: business, error: businessError } = await admin

      .from("businesses")

      .select("id,active")

      .eq("id", businessId)

      .maybeSingle();

    if (businessError) {

      return fail("Unable to verify the selected company.", 500);

    }

    if (!business) {

      return fail("Company not found.", 404);

    }

    if (!business.active) {

      return fail(

        "Employees cannot be assigned to a suspended company.",

      );

    }

    const { data: profile, error: profileError } = await admin

      .from("profiles")

      .select("id,full_name,email,active")

      .eq("id", userId)

      .maybeSingle();

    if (profileError) {

      return fail("Unable to retrieve the employee account.", 500);

    }

    if (!profile) {

      return fail("Employee account not found.", 404);

    }

    if (profile.active === false) {

      return fail("This employee's account is inactive.");

    }

    const { data: existingMembership, error: membershipLookupError } =

      await admin

        .from("business_members")

        .select("id")

        .eq("business_id", businessId)

        .eq("user_id", userId)

        .maybeSingle();

    if (membershipLookupError) {

      return fail(

        "Unable to check existing company membership.",

        500,

      );

    }

    if (existingMembership) {

      return fail(

        "This employee is already assigned to this company.",

        409,

      );

    }

    // Existing accounts are assigned directly and remain active.

    const { data: membership, error: insertError } = await admin

      .from("business_members")

      .insert({

        business_id: businessId,

        user_id: userId,

        role,

        active: true,

      })

      .select("id,business_id,user_id,role,active,created_at")

      .single();

    if (insertError) {

      return fail(

        "Unable to assign the employee to this company.",

        500,

      );

    }

    return json(

      {

        membership,

        employee: {

          id: profile.id,

          full_name: profile.full_name,

          email: profile.email,

        },

      },

      201,

    );

  }

  // --------------------------------------------------

  // UPDATE A COMPANY MEMBERSHIP

  // --------------------------------------------------

  if (action === "update_member") {

    const membershipId =

      typeof body.membershipId === "string"

        ? body.membershipId

        : "";

    const hasRole = Object.prototype.hasOwnProperty.call(

      body,

      "role",

    );

    const hasActive = Object.prototype.hasOwnProperty.call(

      body,

      "active",

    );

    if (!membershipId || (!hasRole && !hasActive)) {

      return fail(

        "A membership ID and at least one change are required.",

      );

    }

    if (hasRole && !isValidRole(body.role)) {

      return fail("Select a valid employee role.");

    }

    if (hasActive && typeof body.active !== "boolean") {

      return fail("A valid membership status is required.");

    }

    const { data: existing, error: findError } = await admin

      .from("business_members")

      .select("id,business_id,user_id,role,active")

      .eq("id", membershipId)

      .maybeSingle();

    if (findError) {

      return fail(

        "Unable to retrieve the company membership.",

        500,

      );

    }

    if (!existing) {

      return fail("Company membership not found.", 404);

    }

    // Prevent manual activation of a membership while its

    // corresponding invitation is still pending.

    if (hasActive && body.active === true) {

      const { data: memberProfile, error: memberProfileError } =

        await admin

          .from("profiles")

          .select("email")

          .eq("id", existing.user_id)

          .maybeSingle();

      if (memberProfileError) {

        return fail(

          "Unable to verify the employee's invitation status.",

          500,

        );

      }

      if (memberProfile?.email) {

        const { data: pendingInvitation, error: pendingError } =

          await admin

            .from("business_invitations")

            .select("id")

            .eq("business_id", existing.business_id)

            .ilike("email", memberProfile.email)

            .eq("status", "pending")

            .maybeSingle();

        if (pendingError) {

          return fail(

            "Unable to verify the employee's invitation status.",

            500,

          );

        }

        if (pendingInvitation) {

          return fail(

            "This employee still has a pending invitation. They must accept the email invitation before their company membership can be activated.",

            409,

          );

        }

      }

    }

    const nextRole = hasRole ? body.role : existing.role;

    const nextActive = hasActive ? body.active : existing.active;

    // Prevent removing the last active Company Administrator.

    const removingAdmin =

      existing.role === "admin" &&

      existing.active &&

      (nextRole !== "admin" || nextActive === false);

    if (removingAdmin) {

      const { count, error: countError } = await admin

        .from("business_members")

        .select("id", { count: "exact", head: true })

        .eq("business_id", existing.business_id)

        .eq("role", "admin")

        .eq("active", true)

        .neq("id", membershipId);

      if (countError) {

        return fail(

          "Unable to verify company administrator coverage.",

          500,

        );

      }

      if (!count || count < 1) {

        return fail(

          "This is the company's last active administrator. Assign another administrator before changing this membership.",

          409,

        );

      }

    }

    const updates: Record<string, unknown> = {};

    if (hasRole) updates.role = body.role;

    if (hasActive) updates.active = body.active;

    const { data: updated, error: updateError } = await admin

      .from("business_members")

      .update(updates)

      .eq("id", membershipId)

      .select("id,business_id,user_id,role,active,created_at")

      .single();

    if (updateError) {

      return fail(

        "Unable to update the employee's company membership.",

        500,

      );

    }

    return json({ membership: updated });

  }

  // --------------------------------------------------

  // REVOKE A PENDING INVITATION

  // --------------------------------------------------

  if (action === "revoke_invitation") {

    const invitationId =

      typeof body.invitationId === "string"

        ? body.invitationId

        : "";

    if (!invitationId) {

      return fail("An invitation ID is required.");

    }

    const { data: invitation, error: findError } = await admin

      .from("business_invitations")

      .select("id,business_id,email,status")

      .eq("id", invitationId)

      .maybeSingle();

    if (findError) {

      return fail("Unable to retrieve the invitation.", 500);

    }

    if (!invitation) {

      return fail("Invitation not found.", 404);

    }

    if (invitation.status !== "pending") {

      return fail(

        "Only pending invitations can be revoked.",

        409,

      );

    }

    const { data: revoked, error: revokeError } = await admin

      .from("business_invitations")

      .update({

        status: "revoked",

        revoked_at: new Date().toISOString(),

      })

      .eq("id", invitationId)

      .eq("status", "pending")

      .select("id,status,revoked_at")

      .maybeSingle();

    if (revokeError) {

      return fail("Unable to revoke the invitation.", 500);

    }

    if (!revoked) {

      return fail(

        "The invitation is no longer pending.",

        409,

      );

    }

    // Disable only the membership associated with this invitation.

    // Do not deactivate the global profile or other company memberships.

    const { data: profile, error: profileError } = await admin

      .from("profiles")

      .select("id")

      .ilike("email", invitation.email)

      .maybeSingle();

    if (profileError) {

      return fail(

        "The invitation was revoked, but its prepared membership could not be checked.",

        500,

      );

    }

    if (profile) {

      const { error: membershipError } = await admin

        .from("business_members")

        .update({ active: false })

        .eq("business_id", invitation.business_id)

        .eq("user_id", profile.id);

      if (membershipError) {

        return fail(

          "The invitation was revoked, but its prepared membership could not be deactivated.",

          500,

        );

      }

    }

    return json({

      invitation: revoked,

      message: "Invitation revoked successfully.",

    });

  }

  // --------------------------------------------------

  // CREATE COMPANY AND INVITE FIRST ADMINISTRATOR

  // --------------------------------------------------

  if (action === "create") {

    const companyName =

      typeof body.companyName === "string"

        ? body.companyName.trim()

        : "";

    const administratorName =

      typeof body.administratorName === "string"

        ? body.administratorName.trim()

        : "";

    const administratorEmail =

      typeof body.administratorEmail === "string"

        ? body.administratorEmail.trim().toLowerCase()

        : "";

    if (!companyName || companyName.length > 120) {

      return fail(

        "Enter a company name (maximum 120 characters).",

      );

    }

    if (

      !administratorName ||

      administratorName.length > 120

    ) {

      return fail(

        "Enter the administrator's full name (maximum 120 characters).",

      );

    }

    if (

      !isValidEmail(administratorEmail) ||

      administratorEmail.length > 254

    ) {

      return fail(

        "Enter a valid administrator email address.",

      );

    }

    const { data: existingProfile, error: profileLookupError } =

      await admin

        .from("profiles")

        .select("id,email")

        .ilike("email", administratorEmail)

        .maybeSingle();

    if (profileLookupError) {

      return fail(

        "Unable to check the administrator account.",

        500,

      );

    }

    if (existingProfile) {

      return fail(

        "This email already has a BlaQsWatch profile. Use the existing-employee assignment workflow instead.",

        409,

      );

    }

    const redirectTo = getAuthCallbackUrl();

    if (!redirectTo) {
      return fail("The invitation redirect URL is not configured.", 500);
    }

    const { data: business, error: businessError } = await admin

      .from("businesses")

      .insert({

        name: companyName,

        active: true,

        created_by: userData.user.id,

      })

      .select("id,name,active,created_at")

      .single();

    if (businessError) {

      return fail("Unable to create the company.", 500);

    }

    const { data: invitation, error: inviteError } =

      await admin.auth.admin.inviteUserByEmail(

        administratorEmail,

        {
          redirectTo,
          data: {

            full_name: administratorName,

            invited_for: "company_admin",

            business_id: business.id,

          },

        },

      );

    if (inviteError || !invitation.user) {

      await admin

        .from("businesses")

        .delete()

        .eq("id", business.id);

      return fail(

        inviteError?.message ||

          "Unable to send the administrator invitation.",

        400,

      );

    }

    const invitedUserId = invitation.user.id;

    const { error: profileError } = await admin

      .from("profiles")

      .insert({

        id: invitedUserId,

        full_name: administratorName,

        email: administratorEmail,

        role: "admin",

        active: true,

      });

    if (profileError) {

      await admin.auth.admin.deleteUser(invitedUserId);

      await admin

        .from("businesses")

        .delete()

        .eq("id", business.id);

      return fail(

        "The invitation was created, but the administrator profile could not be prepared. The operation was rolled back.",

        500,

      );

    }

    // IMPORTANT:

    // The first Company Admin must also accept their invitation

    // before receiving access to the newly created company.

    const { error: membershipError } = await admin

      .from("business_members")

      .insert({

        business_id: business.id,

        user_id: invitedUserId,

        role: "admin",

        active: false,

      });

    if (membershipError) {

      await admin

        .from("profiles")

        .delete()

        .eq("id", invitedUserId);

      await admin.auth.admin.deleteUser(invitedUserId);

      await admin

        .from("businesses")

        .delete()

        .eq("id", business.id);

      return fail(

        "The invitation was created, but company membership could not be prepared. The operation was rolled back.",

        500,

      );

    }

    const { error: invitationRecordError } = await admin

      .from("business_invitations")

      .insert({

        business_id: business.id,

        email: administratorEmail,

        full_name: administratorName,

        role: "admin",

        invited_by: userData.user.id,

        status: "pending",

        expires_at: invitationExpiry(),

      });

    if (invitationRecordError) {

      await admin

        .from("business_members")

        .delete()

        .eq("business_id", business.id)

        .eq("user_id", invitedUserId);

      await admin

        .from("profiles")

        .delete()

        .eq("id", invitedUserId);

      await admin.auth.admin.deleteUser(invitedUserId);

      await admin

        .from("businesses")

        .delete()

        .eq("id", business.id);

      return fail(

        "The invitation was created, but its tracking record could not be saved. The operation was rolled back.",

        500,

      );

    }

    return json(

      {

        company: business,

        invitation: {

          email: administratorEmail,

          status: "pending",

        },

      },

      201,

    );

  }

  return fail("Unsupported action.");

});
