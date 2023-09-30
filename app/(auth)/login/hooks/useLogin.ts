import { useRouter } from 'next/router';  
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSupabase } from "@/lib/context/SupabaseProvider";
import { useToast } from "@/lib/hooks";
import { useEventTracking } from "@/services/analytics/useEventTracking";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const useLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { publish } = useToast();
  const { supabase, session } = useSupabase();

  const { track } = useEventTracking();

  const { t } = useTranslation(["login"]);

  const router = useRouter();
  const slackId = router.query.teamId as string | undefined; // Assuming teamId is a string. Adjust as needed.

  const handleLogin = async () => {
    setIsPending(true);
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.log(error.message)
      if (error.message.includes("Failed")) {
        publish({
          variant: "danger",
          text: t("Failedtofetch", { ns: 'login' })
        });
      } else if (error.message.includes("Invalid")) {
        publish({
          variant: "danger",
          text: t("Invalidlogincredentials", { ns: 'login' })
        });
      } else {
        publish({
          variant: "danger",
          text: error.message // seems safe since we're just showing the error message
        });
      }
    } else if (data) {
      publish({
        variant: "success",
        text: t("loginSuccess", { ns: 'login' })
      });
      const accessToken = data.session?.access_token;
      if (slackId && accessToken) {
        void supabase
          .from('slack_tokens')
          .insert([
            { slackId, access_token: accessToken },
          ]);
      }
    }
    
    setIsPending(false);
  };

  useEffect(() => {
    if (session && session.user) {
      void track("SIGNED_IN");
  
      const previousPage = sessionStorage.getItem("previous-page");
      if (!previousPage) {
        router.push("/upload");
      } else {
        sessionStorage.removeItem("previous-page");
        router.push(previousPage);
      }
    }
  }, [session?.user, router, track]);
  

  return {
    handleLogin,
    setEmail,
    setPassword,
    email,
    isPending,
    password,
  };
};
