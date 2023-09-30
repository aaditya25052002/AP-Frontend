import { useRouter } from 'next/router';  
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Separate groups of imports with an empty line
import { useSupabase } from "@/lib/context/SupabaseProvider";
import { useToast } from "@/lib/hooks";
import { useEventTracking } from "@/services/analytics/useEventTracking";

export const useLogin = (): {
  handleLogin: () => Promise<void>,
  setEmail: React.Dispatch<React.SetStateAction<string>>,
  setPassword: React.Dispatch<React.SetStateAction<string>>,
  email: string,
  isPending: boolean,
  password: string
} => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isPending, setIsPending] = useState<boolean>(false);
  const { publish } = useToast();
  const { supabase, session } = useSupabase();
  const { track } = useEventTracking();
  const { t } = useTranslation(["login"]);
  const router = useRouter();

  // Use nullish coalescing
  const slackId = router.query.teamId?.toString() ?? "";

  const handleLogin = async () => {
    setIsPending(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.log(error.message);
      if (error.message.includes("Failed")) {
        publish({ variant: "danger", text: t("Failedtofetch", { ns: 'login' }) });
      } else if (error.message.includes("Invalid")) {
        publish({ variant: "danger", text: t("Invalidlogincredentials", { ns: 'login' }) });
      } else {
        publish({ variant: "danger", text: error.message });
      }
    } else if (data?.session) {  // Use optional chaining
      publish({ variant: "success", text: t("loginSuccess", { ns: 'login' }) });
      const accessToken = data.session.access_token;
      if (slackId.trim() && accessToken) {
        const insertResult = await supabase
          .from('slack_tokens')
          .insert([{ slackId, access_token: accessToken }]);
        
        if (insertResult.error) {
          console.error('Error storing slackId and access_token:', insertResult.error);
        }
      }
    }

    setIsPending(false);
  };

  useEffect(() => {
    if (session?.user) {  // Use optional chaining
      track("SIGNED_IN").catch(console.error);
      
      const previousPage = sessionStorage.getItem("previous-page");
      if (!previousPage || previousPage.trim() === "") {  // Explicit empty string check
        void router.push("/upload");
      } else {
        sessionStorage.removeItem("previous-page");
        void router.push(previousPage);
      }
    }
  }, [session?.user, router, track]);  // Use optional chaining

  return {
    handleLogin,
    setEmail,
    setPassword,
    email,
    isPending,
    password,
  };
};
