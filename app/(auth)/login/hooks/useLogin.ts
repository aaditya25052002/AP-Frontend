import { useRouter, useSearchParams } from "next/navigation";

import { useEffect, useState } from "react";

import { useSupabase } from "@/lib/context/SupabaseProvider";

import { useToast } from "@/lib/hooks";

import { useTranslation } from "react-i18next";

import { useEventTracking } from "@/services/analytics/useEventTracking";

import { useAuthApi } from "@/lib/api/auth/useAuthApi";

export const useLogin = (): {
  handleLogin: () => Promise<void>;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  email: string;
  isPending: boolean;
  password: string;
} => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isPending, setIsPending] = useState<boolean>(false);
  const { publish } = useToast();
  const { supabase, session } = useSupabase();
  const { track } = useEventTracking();
  const { t } = useTranslation(["login"]);
  const router = useRouter();
  const { createApiKey } = useAuthApi();
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const searchParams = useSearchParams();
  const slackId = searchParams ? searchParams.get("teamId") : null;

  async function handleLogin() {
    setIsPending(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.log(error.message);
      if (error.message.includes("Failed")) {
        publish({ variant: "danger", text: t("Failedtofetch", { ns: "login" }) });
      } else if (error.message.includes("Invalid")) {
        publish({ variant: "danger", text: t("Invalidlogincredentials", { ns: "login" }) });
      } else {
        publish({ variant: "danger", text: error.message });
      }
    } else if (data && data?.session) {
      console.log("Login Success:", data);
      publish({ variant: "success", text: t("loginSuccess", { ns: "login" }) });
      const accessToken = data.session.access_token;
      const apiKey = await createApiKey();
      console.log("Access Token:", apiKey);
      console.log("Slack ID:", slackId);

      if (slackId !== "" && apiKey !== "") {
        const insertResult = await supabase
          .from("slack_tokens")
          .insert([{ slack_id: slackId, access_token: apiKey }]);

        if (insertResult.error) {
          console.error("Error storing slackId and access_token:", insertResult.error);
        } else {
          console.log("Token stored successfully:", insertResult.data);
        }
      } else {
        console.warn("Either Slack ID or Access Token is missing. Skipping token storage.");
      }
    }

    setIsPending(false);
  };

  // Added router to the dependency array to fix the "React Hook useEffect has a missing dependency: 'router'" linting error.
  useEffect(() => {
    if (session?.user && isClient) {
      track("SIGNED_IN").catch(console.error);

      const previousPage = sessionStorage.getItem("previous-page");
      if (!previousPage?.trim()) {
        router.push("/upload");
      } else {
        sessionStorage.removeItem("previous-page");
        router.push(previousPage);
      }
    }
  }, [session, track, isClient, router]);

  return {
    handleLogin,
    setEmail,
    setPassword,
    email,
    isPending,
    password,
  };
};
