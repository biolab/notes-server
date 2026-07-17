import React from "react";

import { UserContextProvider } from "@/context/UserContextProvider";
import { LoginPage } from "@/components/LoginPage";


export default async function Page({ searchParams }:
  { searchParams: Promise<{ [key: string]: string | string[] | undefined }>}
)  {
  const { redirect, token } = (await searchParams) as {
    redirect: string | string[] | undefined,
    token: string | string[] | undefined
  }

  return (
    <UserContextProvider token={Array.isArray(token) ? token[0] :  token}>
      <LoginPage redirect={Array.isArray(redirect) ? redirect[0] : redirect}/>
    </UserContextProvider>
  );
}
