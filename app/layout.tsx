import { ToastContainer } from "react-toastify";
import "../styles/globals.scss";

import type { Metadata } from "next";
import React from "react";

import { CONFIG } from "@/utils/config";
import { DevRefreshHandler } from "@/components/DevRefreshHandler";


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
        <DevRefreshHandler wsPort={CONFIG.wsPort} />
          {children}
          <ToastContainer />
      </body>
    </html>
  );
}
