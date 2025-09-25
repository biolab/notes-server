"use client"

import React, { useContext } from "react";

import { UserContext } from "@/context/UserContextProvider";
import Login from "@/components/Login";
import Layout from "@/components/Layout/Layout";
import { useIntlFromBrowser } from "@/i18n";


export default function LoginPage() {
  const { user, logOut } = useContext(UserContext);
  const { t } = useIntlFromBrowser();

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
            <Login requireEmail={true} redirect="/" t={t}/>
          )}
    </Layout>
  );
}
