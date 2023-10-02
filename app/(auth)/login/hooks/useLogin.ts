import { useSearchParams , useRouter } from 'next/navigation';  
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  const searchParams = useSearchParams();
  const slackId = searchParams ? searchParams.get('teamId') : null;
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
    } else if (data && data.session) {
      console.log("Login Success:", data);
      publish({ variant: "success", text: t("loginSuccess", { ns: 'login' }) });
      const accessToken = data.session.access_token;
      console.log("Access Token:", accessToken);
      console.log("Slack ID:", slackId);

      if (slackId !== "" && accessToken !== "") {
          const insertResult = await supabase
              .from('slack_tokens')
              .insert([{ slack_id: slackId, access_token: accessToken }]);
          
          if (insertResult.error) {
              console.error('Error storing slackId and access_token:', insertResult.error);
          } else {
              console.log("Token stored successfully:", insertResult.data);
          }
      } else {
          console.warn("Either Slack ID or Access Token is missing. Skipping token storage.");
      }
  }


    setIsPending(false);
  };

  useEffect(() => {
    if (session?.user && isClient && router) { // Check for router before accessing its methods
      track("SIGNED_IN").catch(console.error);
      
      const previousPage = sessionStorage.getItem("previous-page");
      if (!previousPage || previousPage.trim() === "") {
        router.push("/upload");
      } else {
        sessionStorage.removeItem("previous-page");
        router.push(previousPage);
      }
    }
  }, [session, track, isClient]);

  return {
    handleLogin,
    setEmail,
    setPassword,
    email,
    isPending,
    password,
  };
};