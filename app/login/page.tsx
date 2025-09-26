"use client"

import React, { useContext, use } from "react";

import { UserContext } from "@/context/UserContextProvider";
import Login from "@/components/Login";
import Layout from "@/components/Layout/Layout";
import { useIntlFromBrowser } from "@/i18n";


export default function LoginPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
})  {
  const { user, logOut } = useContext(UserContext);
  const { t } = useIntlFromBrowser();
  const { redirect } = use(searchParams);

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
              redirect={redirect ? decodeURIComponent(redirect) : "/"}
              t={t}/>
          )}
    </Layout>
  );
}
