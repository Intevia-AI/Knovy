import { createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function TestAuthPage() {
  const supabase = await createServerClient();

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Test querying user_sessions as this user
  let sessionData = null;
  let sessionError = null;
  if (user) {
    const result = await supabase.from("user_sessions").select("*");
    sessionData = result.data;
    sessionError = result.error;
  }

  // Get user profile to check role
  let profileData = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profileData = data;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Authentication Test</h1>

      <div className="space-y-4">
        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">User Status</h2>
          <pre className="text-sm bg-black/20 p-4 rounded overflow-auto">
            {user ? JSON.stringify(user, null, 2) : "Not authenticated"}
          </pre>
          {userError && (
            <div className="text-red-600 mt-2">Error: {userError.message}</div>
          )}
        </div>

        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Profile Data (Role)</h2>
          <pre className="text-sm bg-black/20 p-4 rounded overflow-auto">
            {profileData ? JSON.stringify(profileData, null, 2) : "No profile found"}
          </pre>
        </div>

        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Query Test: user_sessions</h2>
          <pre className="text-sm bg-black/20 p-4 rounded overflow-auto">
            {sessionData
              ? `Found ${sessionData.length} sessions:\n${JSON.stringify(sessionData, null, 2)}`
              : "No sessions found"}
          </pre>
          {sessionError && (
            <div className="text-red-600 mt-2">Error: {sessionError.message}</div>
          )}
        </div>

        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Cookies</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Check browser DevTools → Application → Cookies for:
          </p>
          <ul className="text-sm list-disc list-inside">
            <li>sb-access-token</li>
            <li>sb-refresh-token</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
