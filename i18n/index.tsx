import React from "react";
import dict from "./dict.json";

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
  lang: string;
}) => {
  const t = React.useCallback(
    (key: string) => dict[lang]?.[key] || key,
    [lang]
  );

  const contextValue = React.useMemo(() => ({ t }), [t]);

  return <IntlContext.Provider value={contextValue}>{children}</IntlContext.Provider>;
};

export const useIntl = () => React.useContext(IntlContext);
