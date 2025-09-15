"use client";

import React, { ReactNode, createContext, useRef, useCallback, useMemo } from "react";
import Image from "@/components/Image";

type SidenoteContextType = {
  register: (sidenote: HTMLDivElement) => void;
  unregister: (sidenote: HTMLDivElement) => void;
  layout: () => void;
  sidenotes: React.RefObject<HTMLDivElement[]>;
};

export const SidenoteContext = createContext<SidenoteContextType>({
  register: () => {},
  unregister: () => {},
  sidenotes: { current: [] },
  layout: () => {},
});

export const SidenoteProvider = ({ children }: { children: ReactNode }) => {
  const sidenotes = useRef<HTMLDivElement[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const register = useCallback((sidenote: HTMLDivElement) => {
    // Prevent inserting duplicates due to React strict mode
    if (!sidenotes.current.includes(sidenote)) {
      sidenotes.current.push(sidenote);
    }
  }, []);

  const unregister = useCallback((sidenote: HTMLDivElement) => {
    const index = sidenotes.current.indexOf(sidenote);
    if (index > -1) {
      sidenotes.current.splice(index, 1);
    }
  }, []);

  const layout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;

    sidenotes.current.forEach((el) => (el.style.top = ""));

    const notes = sidenotes.current
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .sort((a, b) => a.rect.top - b.rect.top);

    let prevBottom = 0;

    notes.forEach(({ el, rect }) => {
      if (rect.top - containerTop < prevBottom + 3) {
        el.style.top = `${prevBottom + 3}px`;
        prevBottom = prevBottom + 3 + rect.height;
      } else {
        prevBottom = rect.bottom - containerTop;
      }
    });
  }, []);

  const contextValue = useMemo(() => ({
    register,
    unregister,
    layout,
    sidenotes,
  }), [register, unregister, layout]);

  return (
    <SidenoteContext.Provider value={contextValue}>
      <div ref={containerRef} style={{position: "relative"}}>
        {children}
      </div>
    </SidenoteContext.Provider>
);
};


const useSidenoteRegistration = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const {register, unregister} = React.useContext(SidenoteContext);

  React.useEffect(() => {
    if (ref.current) {
      register(ref.current);
    }
    return () => {
      if (ref.current) {
        unregister(ref.current);
      }
    }
  }, [register, unregister]);

  return ref;
}

export const Sidenote = ({ children }: { children: React.ReactNode }) => {
  const ref = useSidenoteRegistration();
  return (
    <div ref={ref} className="float-aside">
      {children}
    </div>
  );
};

export const ExpandingSideImg = ({src, alt, retina, caption, children}: {
  src: string;
  caption?: string;
  children?: React.ReactNode;
  alt?: string;
  retina?: boolean;
}) => {
  const ref = useSidenoteRegistration();

  return <div className="expanding-side-img" ref={ref}>
    <Image
      src={src}
      alt={alt || caption || "image"}
      className={retina ? " retina" : ""}
    />
    {caption && <div className="caption">{caption}</div>}
    {children && <div className="children">{children}</div>}
  </div>
}