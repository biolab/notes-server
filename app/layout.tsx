import { ToastContainer } from "react-toastify";
import "../styles/globals.scss";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notes",
  icons: {
    icon: "/icons/default-favicon.png"
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <body>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
