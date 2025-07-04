// import { useMutation, useQuery } from "@tanstack/react-query";
"use client";

import React, { ReactNode } from "react";
import { useHasMounted } from "../hooks/useHasMounted";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserService_Get } from "@/server-functions/UserService";

export interface User {
  access_token: string;
  email: string;
  id: number;
  admin?: boolean;
}

export const UserContext = React.createContext<{
  user: User | null;
  onUserLogin: (user: User) => void;
  logOut: () => void;
  retrievingUser: boolean;
}>({
  user: null,
  onUserLogin: () => {},
  logOut: () => {},
  retrievingUser: true,
});

const USER_LS_KEY = "lecture-notes::user";

const getUserFromLocalStorage = () => {
  const user = localStorage.getItem(USER_LS_KEY);

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null;
  }
};

export const UserContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const hasMounted = useHasMounted();
  const [retrievingUser, setRetrievingUser] = React.useState(true);
  const [init, setInit] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const searchParams = useSearchParams();
  const accessTokenFromQuery = searchParams.get("access_token");

  const onUserLogin = React.useCallback((user: User) => {
    setUser(user);
    setRetrievingUser(false);

    if (user.admin) {
      return;
    }

    localStorage.setItem(USER_LS_KEY, JSON.stringify(user));
  }, []);

  const fetchUser = React.useCallback(
    async (access_token: string) => {
      try {
        const _user = await UserService_Get({ access_token });
        onUserLogin(_user);
      } catch (error) {
        setRetrievingUser(false);
        localStorage.removeItem(USER_LS_KEY);
      }
    },
    [onUserLogin]
  );

  React.useEffect(() => {
    if (!hasMounted || !!user || init) {
      return;
    }

    setInit(true);

    if (accessTokenFromQuery) {
      fetchUser(accessTokenFromQuery);
      router.replace(pathname);
      return;
    }

    const userFromLS = getUserFromLocalStorage();
    console.log("User from local storage:", userFromLS);
    if (userFromLS?.access_token) {
      fetchUser(userFromLS.access_token);
      return;
    }

    setRetrievingUser(false);
  }, [
    accessTokenFromQuery,
    fetchUser,
    hasMounted,
    init,
    pathname,
    router,
    user,
  ]);

  const logOut = React.useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_LS_KEY);
  }, []);

  const context = React.useMemo(
    () => ({ user, onUserLogin, retrievingUser, logOut: logOut }),
    [user, onUserLogin, retrievingUser, logOut]
  );

  return (
    <UserContext.Provider value={context}>{children}</UserContext.Provider>
  );
};
