import React from "react";

// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMountEffect = (fun: () => void) => React.useEffect(fun, []);
