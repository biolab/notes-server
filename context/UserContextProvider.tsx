"use client";

import React, { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { createUser, applyTemporaryToken, getUser, User } from "@/api/user";
import { logger } from "@/utils/logger";


export const UserContext = React.createContext<{
  user: User | null;
  userGroup: string | null;
  setUserGroup: React.Dispatch<React.SetStateAction<string | null>>;
  logOut: () => void;
}>({
  user: null,
  userGroup: null,
  setUserGroup: () => {},
  logOut: () => {},
});

export const USER_LS_KEY = "lecture-notes::user";
export const USER_REAL_KEY = "lecture-notes::real-user";

export const retrieveAccessTokenFromLocalStorage = () =>
  localStorage.getItem(USER_LS_KEY);

export const storeAccessTokenInLocalStorage = (token: string) => {
  localStorage.setItem(USER_LS_KEY, token);
}

export const impersonateUser = (token: string) => {
  const realToken = retrieveAccessTokenFromLocalStorage();
  localStorage.setItem(USER_REAL_KEY, realToken || "");
  localStorage.setItem(USER_LS_KEY, token);
}

export const getRealAccessToken = () => {
  return localStorage.getItem(USER_REAL_KEY);
}

export const stopImpersonatingUser = () => {
  const realToken = getRealAccessToken();
  if (realToken) {
    localStorage.setItem(USER_LS_KEY, realToken);
    localStorage.removeItem(USER_REAL_KEY);
  }
}

export const removeAccessTokenFromLocalStorage = () => {
  localStorage.removeItem(USER_LS_KEY);
}

export const UserContextProvider = ({ children }: {
  children: ReactNode;
}) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [userGroup, setUserGroup] = React.useState<string | null>(null);

  const onUserLogin = React.useCallback(
    (user: User) => {
      setUser(user);
      storeAccessTokenInLocalStorage(user.accessToken);
    },
    []);

  const createAnonymousUser = React.useCallback(async () => {
    createUser()
      .then((user) => {
        logger("Created anonymous user:", user);
        onUserLogin(user);
      })
      .catch((error) => {
        logger("Error creating anonymous user:", error);
        removeAccessTokenFromLocalStorage();
      });
  }, [onUserLogin]);

  const [init, setInit] = React.useState(false);
  const searchParams = useSearchParams();
  const accessTokenFromQuery = searchParams.get("token");
  const pathname = usePathname();

  React.useEffect(() => {
    if (init) {
      return;
    }
    setInit(true);

    if (accessTokenFromQuery) {
      applyTemporaryToken(accessTokenFromQuery).then((user) => {
        logger("Applied temporary token, got user:", user);
        onUserLogin(user);
        window.location.replace(pathname);
      }).catch((error) => {
        logger("Error applying temporary token:", error);
        window.location.replace(pathname);
      })
      return;
    }

    const accessToken = retrieveAccessTokenFromLocalStorage();
    if (accessToken) {
      getUser(accessToken)
        .then((user) => {
          if (user) {
            logger("Fetched user: " + JSON.stringify(user));
            onUserLogin(user);
          }
          else {
            logger("User not found, creating anonymous user");
            createAnonymousUser();
          }
        })
        .catch((error) => {
          logger("Error fetching user:", error);
          removeAccessTokenFromLocalStorage();
          createAnonymousUser();
        });
      return;
    }

    logger("No access token, creating anonymous user");
    createAnonymousUser();
  },
  [onUserLogin, accessTokenFromQuery, createAnonymousUser, init, pathname]);

  const logOut = React.useCallback(() => {
    setUser(null);
    removeAccessTokenFromLocalStorage();
    createAnonymousUser();
  }, [createAnonymousUser]);

  const context = React.useMemo(
    () => ({ user, logOut, userGroup, setUserGroup }),
    [user, logOut, userGroup, setUserGroup]
  );

  return (
    <UserContext.Provider value={context}>{children}</UserContext.Provider>
  );
};
