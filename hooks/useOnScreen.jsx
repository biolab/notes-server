'use client';

import React from "react";

export const useOnScreen = (ref) => {
  const [isIntersecting, setIntersecting] = React.useState(false);

  const observer = React.useRef();

  React.useEffect(() => {
    observer.current = new IntersectionObserver(([entry]) =>
      setIntersecting(entry.isIntersecting)
    );
    observer.current.observe(ref.current);
    return () => {
      observer.current.disconnect();
    };
  }, [observer, ref]);

  return isIntersecting;
};
