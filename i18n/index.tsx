'use client';

import React from "react";
import dict from "./dict";

export const getT = (lang: string) => (key: string) => dict[lang || "en"]?.[key] || key;

const IntlContext = React.createContext<{
  t: (key: string) => any;
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

export const useIntl = () => {
  const ctx = React.useContext(IntlContext);
  if (!ctx) {
    return {t: getT("en") }
  }
  return ctx;
}

export const useIntlFromBrowser = () => {
  const [intl, setIntl] = React.useState<{t: (key: string) => any}>({t: getT("en")});

  React.useEffect(() => {
      if (typeof window !== "undefined") {
        const lang = navigator.language.split("-")[0];
        if (dict[lang]) {
          setIntl({t: getT(lang)});
        }
      }
  }, []);

  return intl;
}
