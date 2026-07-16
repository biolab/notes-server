"use client";

import React, { useContext } from "react";
import { UserContext } from "@/context/UserContextProvider";
import { useIntlFromBrowser } from "@/i18n";
import Layout from "@/components/Layout/Layout";
import Login from "@/components/Login";

export function LoginPage({redirect}: {
  redirect: string | undefined}
)  {
  const { user, logOut } = useContext(UserContext);
  const { t } = useIntlFromBrowser();

  let decodedRedirect: string | undefined = redirect;
  if (redirect) {
    try {
      decodedRedirect = decodeURIComponent(redirect);
    } catch {
      decodedRedirect = undefined;
    }
  }

  return (
    <Layout title={t("login")}>
      {user === null ? t("loading")
        : user.email ? (
          <div className="prose mx-auto">
            <div className="p-6 rounded mt-10">
              { t("login.already-logged-in")(logOut) }
            </div>
          </div>
        ) : (
          <Login
            requireEmail={true}
            redirect={decodedRedirect ?? "/"}
            slug={decodedRedirect ? decodedRedirect.slice(1) : undefined}
            t={t}/>
        )}
    </Layout>
  );
}
