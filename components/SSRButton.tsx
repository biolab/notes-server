import { userCreate } from "@/api/user.api";
import React from "react";

const SSRButton = ({ children }: { children: React.ReactNode }) => {
  const submit = React.useCallback(async () => {
    await userCreate({ email: "mitja.potocin@gmail.com" });
  }, []);

  return <button onClick={submit}>{children}</button>;
};

export default SSRButton;
