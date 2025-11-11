"use client"

import React, { useContext } from "react";
import { useSearchParams } from 'next/navigation';

import { UserContext } from "@/context/UserContextProvider";
import Login from "@/components/Login";
import Layout from "@/components/Layout/Layout";
import { useIntlFromBrowser } from "@/i18n";


export default function LoginPage()  {
  const { user, logOut } = useContext(UserContext);
  const { t } = useIntlFromBrowser();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

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
              slug={redirect ? decodeURIComponent(redirect).slice(1) : undefined}
              t={t}/>
          )}
    </Layout>
  );
}
