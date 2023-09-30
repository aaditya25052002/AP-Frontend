import { useRouter } from 'next/router';  
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSupabase } from "@/lib/context/SupabaseProvider";
import { useToast } from "@/lib/hooks";
import { useEventTracking } from "@/services/analytics/useEventTracking";

export const useLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { publish } = useToast();
  const { supabase, session } = useSupabase();

  const { track } = useEventTracking();
  const { t } = useTranslation(["login"]);
  const router = useRouter();
  const slackId = router.query.teamId?.toString() || "";  // Assuming `teamId` might be non-string

  const handleLogin = async () => {
    setIsPending(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.log(error.message);
      if (error.message.includes("Failed")) {
        publish({ variant: "danger", text: t("Failedtofetch",{ ns: 'login' }) });
      } else if (error.message.includes("Invalid")) {
        publish({ variant: "danger", text: t("Invalidlogincredentials",{ ns: 'login' }) });
      } else {
        publish({ variant: "danger", text: error.message });
      }
    } else if (data && data.session) {
      publish({ variant: "success", text: t("loginSuccess",{ ns: 'login' }) });
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
    if (session && session.user) {
      track("SIGNED_IN").catch(console.error);
      
      const previousPage = sessionStorage.getItem("previous-page");
      if (!previousPage || previousPage.trim() === "") {
        void router.push("/upload");
      } else {
        sessionStorage.removeItem("previous-page");
        void router.push(previousPage);
      }
    }
  }, [session, session?.user, router, track]);

  return {
    handleLogin,
    setEmail,
    setPassword,
    email,
    isPending,
    password,
  };
};
