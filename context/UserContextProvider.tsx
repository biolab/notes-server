// import { useMutation, useQuery } from "@tanstack/react-query";
"use client";

import React, { ReactNode } from "react";
import { useHasMounted } from "../hooks/useHasMounted";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  UserService_Create,
  UserService_Get,
} from "@/server-functions/UserService";
import { logger } from "@/utils/logger";

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
  showLogin: boolean;
}>({
  user: null,
  onUserLogin: () => {},
  logOut: () => {},
  retrievingUser: true,
  showLogin: false,
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

export const UserContextProvider = ({
  children,
  requireEmail = false,
}: {
  children: ReactNode;
  requireEmail?: boolean;
}) => {
  const [user, setUser] = React.useState<User | null>(null);
  const hasMounted = useHasMounted();
  const [retrievingUser, setRetrievingUser] = React.useState(true);
  const [init, setInit] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [showLogin, setShowLogin] = React.useState(false);

  const searchParams = useSearchParams();
  const accessTokenFromQuery = searchParams.get("access_token");

  const onUserLogin = React.useCallback(
    (user: User) => {
      if (requireEmail && !user?.email) {
        setShowLogin(true);
        setRetrievingUser(false);
        return;
      }

      setUser(user);
      setRetrievingUser(false);

      if (user.admin) {
        return;
      }

      localStorage.setItem(USER_LS_KEY, JSON.stringify(user));
    },
    [requireEmail]
  );

  const createAnonymsUser = React.useCallback(async () => {
    if (requireEmail) {
      setShowLogin(true);
      setRetrievingUser(false);
      return;
    }

    try {
      const { user: _user } = await UserService_Create({ email: null });
      logger("Created anonyms user:", _user);

      onUserLogin(_user);
    } catch (error) {
      setRetrievingUser(false);
      localStorage.removeItem(USER_LS_KEY);
    }
  }, [onUserLogin, requireEmail]);

  const fetchUser = React.useCallback(
    async (access_token: string) => {
      try {
        const _user = await UserService_Get({ access_token });

        logger("Fetched user:", _user);

        if (!_user) {
          logger("User not found, creating anonyms user");
          createAnonymsUser();
          return;
        }

        onUserLogin(_user);
      } catch (error) {
        setRetrievingUser(false);
        localStorage.removeItem(USER_LS_KEY);
      }
    },
    [createAnonymsUser, onUserLogin]
  );

  React.useEffect(() => {
    if (!hasMounted || !!user || init) {
      return;
    }

    setInit(true);

    if (accessTokenFromQuery) {
      localStorage.removeItem(USER_LS_KEY);
      fetchUser(accessTokenFromQuery);

      router.replace(pathname);

      return;
    }

    const userFromLS = getUserFromLocalStorage();
    localStorage.removeItem(USER_LS_KEY);

    if (userFromLS?.access_token) {
      logger("User from local storage:", userFromLS);
      fetchUser(userFromLS.access_token);
      return;
    }

    createAnonymsUser();
  }, [
    accessTokenFromQuery,
    createAnonymsUser,
    fetchUser,
    hasMounted,
    init,
    pathname,
    requireEmail,
    router,
    user,
  ]);

  const logOut = React.useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_LS_KEY);
  }, []);

  const context = React.useMemo(
    () => ({ user, onUserLogin, retrievingUser, logOut, showLogin }),
    [user, onUserLogin, retrievingUser, logOut, showLogin]
  );

  return (
    <UserContext.Provider value={context}>{children}</UserContext.Provider>
  );
};
