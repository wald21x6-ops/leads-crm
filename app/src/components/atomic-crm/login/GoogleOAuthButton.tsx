import { useState } from "react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "../providers/supabase/supabase";

export const GoogleOAuthButton = () => {
  const [pending, setPending] = useState(false);
  const notify = useNotify();
  const signIn = async () => {
    setPending(true);
    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + import.meta.env.BASE_URL,
        },
      });
      if (error) throw error;
    } catch {
      notify("Google sign-in failed. Please try again.", { type: "error" });
      setPending(false);
    }
  };
  return (
    <Button
      type="button"
      className="w-full"
      disabled={pending}
      onClick={signIn}
    >
      Sign in with Google
    </Button>
  );
};
