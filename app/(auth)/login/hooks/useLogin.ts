import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from 'next/router';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { t } = useTranslation(["login"]);


  const router = useRouter();
  const slackId = router.query.teamId;

  const handleLogin = async () => {
    setIsPending(true);
    const { error, session } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) {
      console.log(error.message)
      if (error.message.includes("Failed")) {
        publish({
          variant: "danger",
          text: t("Failedtofetch",{ ns: 'login' })
        });
      } else if (error.message.includes("Invalid")) {
        publish({
          variant: "danger",
          text: t("Invalidlogincredentials",{ ns: 'login' })
        });
      } else {
        publish({
          variant: "danger",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
          text: error.message
        });
      }
    } else {
      publish({
        variant: "success",
        text: t("loginSuccess",{ ns: 'login' })
      });

      if (slackId) {
        const { error: insertError } = await supabase
          .from('slack_tokens')
          .insert([
            { slackId: slackId, access_token: session.access_token },
          ]);

        if (insertError) {
          console.error('Error storing slackId and access_token:', insertError);
          // Handle the insert error appropriately
        }
      }
    }
    
    setIsPending(false);
  };

  useEffect(() => {
    if (session?.user !== undefined) {
      void track("SIGNED_IN");
  
      const previousPage = sessionStorage.getItem("previous-page");
      if (previousPage === null) {
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
