"use client"

import React, { useContext, useEffect, useState } from "react";

import { impersonateUser, UserContext } from "@/context/UserContextProvider";
import Layout from "@/components/Layout/Layout";
import { useIntlFromBrowser } from "@/i18n";
import { getUsers, UserList } from "@/api/user";


export default function Impersonate()  {
  const { user } = useContext(UserContext);
  const { t } = useIntlFromBrowser();

  const [users, setUsers] = useState<UserList>([]);
  useEffect(() => {
    if (user) {
      getUsers(user.accessToken).then(setUsers);
    }
    }, [user, setUsers]);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const impersonate = () => {
    impersonateUser(selectedUser!);
    window.location.href = "/";
  }

  return (
    <Layout title={t("user.impersonate")}>
      {user === null || users.length == 0 ? t("loading")
      : !user.admin ? t("impersonate.not-admin")
      : <div>
          <div className="d-flex">
            <select
              id="user" name="user"
              value={selectedUser || ""}
              onChange={(e) => { setSelectedUser(e.target.value); }}
              className="w-100 h-10 text-black bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2"
            >
              <option value="">Select a user</option>
              {users.map(({ name, accessToken }) => (
                <option key={accessToken} value={accessToken}>
                  {name}
                </option>
              ))}
            </select>
            <button
              disabled={!selectedUser}
              onClick={impersonate}
              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
              {t("user.impersonate")}
            </button>
          </div>
        </div>
      }
    </Layout>
  );
}
