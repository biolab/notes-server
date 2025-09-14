"use client"

import React, { useContext } from "react";

import { UserContext } from "@/context/UserContextProvider";
import Login from "@/components/Login";
import Layout from "@/components/Layout/Layout";


export default function LoginPage() {
  const { user, logOut } = useContext(UserContext);

  return (
    <Layout title="Login">
      {user === null ? "Loading..."
      : user.email ? (
        <div className="prose mx-auto">
          <div className="p-6 rounded mt-10">
            <h2>You are already in.</h2>
            <p>To log in with a different account,
              please <a href="#" onClick={() => logOut()}>log out</a> first.
            </p>
          </div>
        </div>
      ) : (
            <Login requireEmail={true} redirect="/" />
          )}
    </Layout>
  );
}