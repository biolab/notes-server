import { ToastContainer } from "react-toastify";
import "../styles/globals.scss";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <body>{children}</body>
      <ToastContainer />
    </html>
  );
}
