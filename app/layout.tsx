import { ToastContainer } from "react-toastify";
import "../styles/globals.scss";

import type { Metadata } from "next";
import React, { Suspense } from "react";

import { UserContextProvider } from "@/context/UserContextProvider";
import { SidenoteProvider } from "@/components/Book/Sidenote";


export const metadata: Metadata = {
  title: "Notes",
  icons: {
    icon: "/icons/default-favicon.png"
  },
};

export default function RootLayout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <body>
        <Suspense>
          <UserContextProvider>
            <SidenoteProvider>
              {children}
              <ToastContainer />
            </SidenoteProvider>
          </UserContextProvider>
        </Suspense>
      </body>
    </html>
  );
}
