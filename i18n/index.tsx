'use client';

import React from "react";
import dictJson from "./dict.json";

const dict: {[key: string]: any} = dictJson;

export const getT = (lang: string) => (key: string) => dict[lang || "en"]?.[key] || key;

const IntlContext = React.createContext<{
  t: (key: string) => string;
}>({
  t: (key: string) => dict["en"]?.[key] || key,
});

export const IntlContextProvider = ({
  children,
  lang = "en",
}: {
  children: React.ReactNode;
  lang?: string;
}) => {
  const t = React.useCallback(
    (key: string) => dict[lang || "en"]?.[key] || key,
    [lang]
  );

  const contextValue = React.useMemo(() => ({ t }), [t]);

  return <IntlContext.Provider value={contextValue}>{children}</IntlContext.Provider>;
};

export const useIntl = () => React.useContext(IntlContext);
