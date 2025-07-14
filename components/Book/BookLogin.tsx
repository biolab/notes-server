import React from "react";

import { useHasMounted } from "../../hooks/useHasMounted";
import { UserContext } from "@/context/UserContextProvider";
import { _registerUser } from "@/api/UserService";

function BookLogin({
  title,
  loginSubtitle = "Please authenticate with your email to gain access.",
  emailContent,
}: {
  title: string;
  loginSubtitle?: string;
  emailContent?: { subject: string; body: string };
}) {
  const hasMounted = useHasMounted();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState(null);
  const [message, setMessage] = React.useState("");

  const { retrievingUser } = React.useContext(UserContext);

  const onSubmit = React.useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const { link } = await _registerUser({
          email,
          emailContent,
          url: window.location.href,
        });
        setMessage(link ?? "Email has been sent. Please check your inbox.");
      } catch (error) {
        setMessage("");
        setError(error?.message || "An error occurred");

        return;
      }
    },
    [email, emailContent]
  );

  if (!hasMounted || retrievingUser) {
    return <p>Loading...</p>;
  }
  return (
    <div className="prose mx-auto admin-page">
      <div className="bg-slate-800 text-white p-6 rounded mt-10">
        <h2 className="text-white mt-0">
          <b>{title}</b> is locked.
        </h2>
        <p className="subtitle">{loginSubtitle}</p>

        <form onSubmit={onSubmit}>
          <div className="mt-4">
            <label htmlFor="email">Email</label>
            <input
              className="text-black bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2"
              type="email"
              name="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <button className="border-white border-2 rounded p-2" type="submit">
              Login
            </button>
          </div>
        </form>

        {message && <p className="text-green-500">{message}</p>}
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </div>
  );
}

export default BookLogin;
