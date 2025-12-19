import React, { useMemo } from "react";

import { checkMailExists, setTemporaryData, setUserGroupAndToken } from "@/api/user";
import { mailForPath, sendEmail } from "@/api/email";
import { UserContext } from "@/context/UserContextProvider";
import { useHasMounted } from "@/hooks/useHasMounted";


function Login({title, bookId, requireEmail, redirect, slug, groups, t}: {
  title?: string;
  bookId?: number;
  requireEmail: boolean;
  slug?: string;
  redirect?: string;
  groups?: [string, string][];
  t: (key: string) => any;
}) {
  const hasMounted = useHasMounted();
  const { user } = React.useContext(UserContext);
  const [askGroup, askToken] = React.useMemo(() =>
    groups && Object.keys(groups).length > 0
      ? groups[0].map(Boolean)
      : [null, null],
    [groups]);
  const askEmail = React.useMemo(
    () => requireEmail && !user?.email,
    [requireEmail, user?.email]
  );

  const [email, setEmail] = React.useState("");
  const isValidEmail = React.useMemo(() => /.+@.+\..+/.test(email), [email]);
  const [name, setName] = React.useState("");
  const [surname, setSurname] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [token, setToken] = React.useState("");

  // A single state is preferred over multiple because it's easier to clean up
  const [message, setMessage] =
    React.useState<[("LINK" | "INVALID_TOKEN" | "SENT" | "SEND_ERROR" | "UNKNOWN_MAIL")?, string?]>([]);
  const [state, stateDetail] = useMemo(() => message, [message]);

  const onSubmit = React.useCallback(
    async (e: any, existing: boolean) => {
      e.preventDefault();
      if (!user) {
        return; // Should not happen
      }

      setMessage([]);

      if(existing && !(email && await checkMailExists(email))) {
        setMessage(["UNKNOWN_MAIL"]);
        return;
      }

      // If token is present, it is checked.
      // If token is required, new users must enter it. We let existing users
      // to log in; they might get the token from previous login
      if (token
          ? !groups!.some(([g, t]) => (!askGroup || g === group) && t === token)
          : askToken && !existing) {
        setMessage(["INVALID_TOKEN"]);
        return;
      }
      if (bookId && (group || token)) {
        await setUserGroupAndToken(user.accessToken, bookId, group, token);
      }
      if (!email) {
        // Just reload to retrieve the entered group and/or token
        window.location.reload();
        return;
      }

      // Otherwise we must send the link
      const emailToken = await setTemporaryData({
        userId: user.id, email, name, surname});
      const { origin, pathname, hash } = window.location;
      const url = `${origin}${redirect || pathname}?token=${emailToken}${hash}`;

      // In development, we just show the link
      if (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEVELOPMENT === "true") {
        setMessage(["LINK", url]);
        return;
      }

      const { subject, plain, html} = {
        subject: t("login.email-subject"),
        plain: t("login.email-plain"),
        html: t("login.email-html"),
        ...(slug && await mailForPath(slug) || {})
      }

      const format = (s: string) =>
        s.replaceAll("{title}", title || "Notes").replaceAll("{url}", url);
      try {
        await sendEmail({
          sendTo: email,
          subject: format(subject),
          text: format(plain),
          html: html && format(html)
        })
      } catch (error: any) {
        setMessage([
          "SEND_ERROR",
          error?.message || t("login.send-email-fail")
        ]);
        return;
      }
      setMessage(["SENT"]);
    },
    [t, email, name, surname, bookId, group, groups, token, user, askGroup, askToken, redirect, slug, title]
  );

  if (!hasMounted || !user) {
    return <p>
      {t("loading")}
    </p>;
  }

  return (
    <div className="prose mx-auto">
      <div className="p-6 rounded mt-10">
        <h2 className="">
          {title || t("login.page-title")}
        </h2>
        <form>
          { askEmail && (<>
              <div className="mb-4">
                { title && t("login.contains-questions")}
                { t("login.instructions") }
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    { t("login.your-email-address") }
                  </label>
                  <input
                    type="email" name="email" id="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setMessage([]);
                    }}
                    className="w-full text-black bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    disabled={!isValidEmail || !!state}
                    onClick={(e) => { onSubmit(e, true); }}
                    className="
                border-1 rounded h-10 px-4 flex items-center justify-center
                hover:border-2
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                  >
                    { t("login.existing-user-login") }
                  </button>
                </div>
              </div>
              { state === "UNKNOWN_MAIL" &&
                <div>
                  <p className="text-red-500">
                    { t("login.unknown-email") }
                  </p>
                </div>
              }
              {state === "LINK" && <p><a href={stateDetail}>{stateDetail}</a></p>}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    { t("login.first-name") }
                  </label>
                  <input
                    type="text" id="firstName" name="firstName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-black bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    { t("login.last-name") }
                  </label>
                  <input
                    type="text" id="lastName" name="lastName"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full text-black bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2"
                  />
                </div>
              </div>
            </>
          )}
          {(askGroup || askToken) && (<>
            {!askEmail &&
              <div className="mb-8">
                {askGroup ? t("login.requires-group")
                          : t("login.requires-token")}
              </div>
            }
            <div className="grid grid-cols-2 gap-4 mt-4">
              {askGroup &&
                <div>
                  <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-1">
                    { t("login.your-group") }
                  </label>
                  <select
                    id="group" name="group"
                    value={group}
                    onChange={(e) => {
                      setGroup(e.target.value);
                      setMessage([]);
                    }}
                    className="w-full h-10 text-black bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2"
                  >
                    <option value="">Select your group</option>
                    {groups!.map(([group]) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
              }
              {askToken &&
                <div>
                  <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                    { t(askGroup ? "login.group-token" : "login.book-token") }
                  </label>
                  <input
                    type="text" id="token" name="token"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      setMessage([]);
                    }}
                    className="w-full h-10 text-black bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2"
                  />
                  { state === "INVALID_TOKEN" &&
                    <p className="text-red-500" style={{margin: "8px"}}>
                      { t("login.invalid-token")(askGroup) }
                    </p>
                  }
                </div>
              }
            </div>
          </>)}

          <div className="mt-4">
            <button
              disabled={
                askEmail && (!isValidEmail || !name || !surname)
                || askGroup && !group
                || askToken && !token
                || !!state && state !== "UNKNOWN_MAIL"
              }
              onClick={(e) => { onSubmit(e, false); }}
              className="
              border-1 rounded h-10 px-4 flex items-center justify-center
              hover:border-2
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              { t(askEmail ? "login.register-user" : "login.proceed") }
            </button>
          </div>
        </form>

        {state === "SENT" &&
          <p className="text-green-500">
            { t("login.email-sent") }
          </p>
        }
        {state === "SEND_ERROR" &&
          <p className="text-green-500">{stateDetail}</p>
        }
      </div>
    </div>
  );
}

export default Login;
