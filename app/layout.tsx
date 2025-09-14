import { ToastContainer } from "react-toastify";
import "../styles/globals.scss";

import type { Metadata } from "next";
import { Suspense } from "react";

import { UserContextProvider } from "@/context/UserContextProvider";


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
            {children}
            <ToastContainer />
          </UserContextProvider>
        </Suspense>
      </body>
    </html>
  );
}
