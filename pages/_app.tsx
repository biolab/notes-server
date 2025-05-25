/* import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; 
import { UserContextProvider } from "../contexts/UserContext"; */
import Layout from "../components/layout";
import "../styles/tailwind.scss";
import "../styles/globals.scss";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/router";
import { ToastContainer } from "react-toastify";

/* const queryClient = new QueryClient(); */

function MainLayout({ children }) {
  const router = useRouter();

  if (router.pathname.startsWith("/books")) {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
}

function MyApp({ Component, pageProps }) {
    { /* <QueryClientProvider client={queryClient}> 
      <UserContextProvider>
      */ }
  return (
        <MainLayout>
          <Component {...pageProps} />
          <ToastContainer />
        </MainLayout>
  );
    { /* </UserContextProvider>
     </QueryClientProvider> */ }
}

export default MyApp;
