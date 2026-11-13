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
  profiles: CompanyProfile | null;
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

    const ids = businessRows.map(
      (business: BusinessRow) => business.id
    );

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
          500
        );
      }

      const membershipRows =
        (memberships ?? []) as MembershipCountRow[];

      counts = membershipRows.reduce(
        (
          acc: Record<string, number>,
          row: MembershipCountRow
        ) => {
          acc[row.business_id] =
            (acc[row.business_id] || 0) + 1;

          return acc;
        },
        {}
      );
    }

    return json({
      companies: businessRows.map((business: BusinessRow) => ({
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
      typeof body.businessId === "string"
        ? body.businessId
        : "";

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

    const { data: memberships, error: membershipError } =
      await admin
        .from("business_members")
        .select(
          "id,user_id,role,active,created_at,profiles(full_name,email,active)"
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
      members: memberRows.map((member: CompanyMemberRow) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        active:
          member.active && member.profiles?.active !== false,
        full_name: member.profiles?.full_name || "",
        email: member.profiles?.email || "",
      })),
    });
  }

  // --------------------------------------------------
  // ACTIVATE / DEACTIVATE COMPANY
  // --------------------------------------------------

  if (action === "set_status") {
    const businessId =
      typeof body.businessId === "string"
        ? body.businessId
        : "";

    if (
      !businessId ||
      typeof body.active !== "boolean"
    ) {
      return fail(
        "A company ID and valid active status are required."
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
        "Enter a company name (maximum 120 characters)."
      );
    }

    if (
      !administratorName ||
      administratorName.length > 120
    ) {
      return fail(
        "Enter the administrator's full name (maximum 120 characters)."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(administratorEmail) ||
      administratorEmail.length > 254
    ) {
      return fail(
        "Enter a valid administrator email address."
      );
    }

    // Check whether the email already has a BlaQsWatch profile.
    const { data: existingProfile, error: profileLookupError } =
      await admin
        .from("profiles")
        .select("id,email")
        .ilike("email", administratorEmail)
        .maybeSingle();

    if (profileLookupError) {
      return fail(
        "Unable to check the administrator account.",
        500
      );
    }

    if (existingProfile) {
      return fail(
        "This email already has a BlaQsWatch profile. Existing-user company assignment will be handled in the user-management workflow.",
        409
      );
    }

    // Create the company.
    const { data: business, error: businessError } =
      await admin
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

    // Send the first administrator invitation.
    const { data: invitation, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(
        administratorEmail,
        {
          data: {
            full_name: administratorName,
            invited_for: "company_admin",
            business_id: business.id,
          },
        }
      );

    if (inviteError || !invitation.user) {
      await admin
        .from("businesses")
        .delete()
        .eq("id", business.id);

      return fail(
        inviteError?.message ||
          "Unable to send the administrator invitation.",
        400
      );
    }

    const invitedUserId = invitation.user.id;

    // Prepare the administrator profile.
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
        500
      );
    }

    // Assign the administrator to the new company.
    const { error: membershipError } = await admin
      .from("business_members")
      .insert({
        business_id: business.id,
        user_id: invitedUserId,
        role: "admin",
        active: true,
      });

    if (membershipError) {
      await admin.auth.admin.deleteUser(invitedUserId);

      await admin
        .from("businesses")
        .delete()
        .eq("id", business.id);

      return fail(
        "The invitation was created, but company membership could not be prepared. The operation was rolled back.",
        500
      );
    }

    return json(
      {
        company: business,
        invitation: {
          email: administratorEmail,
          status: "sent",
        },
      },
      201
    );
  }

  return fail("Unsupported action.");
});
