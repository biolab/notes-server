"use client";

import "./expanding-side-img.scss"
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

  const layout = useCallback(() => {
    sidenotes.current.forEach((el) => (el.style.top = ""));

    const notes = sidenotes.current
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .sort((a, b) => a.rect.top - b.rect.top);

    let prevBottom = -Infinity;
    notes.forEach(({ el, rect }) => {
      if (rect.top < prevBottom + 3) {
        const yOff = el.offsetParent
                     ? (el.offsetParent as HTMLElement).getBoundingClientRect().top
                     : 0
        el.style.top = `${prevBottom + 3 - yOff}px`;
        prevBottom = prevBottom + 3 + rect.height;
      } else {
        prevBottom = rect.bottom;
      }
    });
  }, []);

  const debouncedLayout = useMemo(() => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        layout();
      }, 100);
    };
  }, [layout]);

  const register = useCallback((sidenote: HTMLDivElement) => {
    // Prevent inserting duplicates due to React strict mode
    if (!sidenotes.current.includes(sidenote)) {
      sidenotes.current.push(sidenote);
      Array.from(sidenote.querySelectorAll("img")).forEach((img) => {
        img.addEventListener("load", debouncedLayout);
      });
    }
  }, [debouncedLayout]);

  const unregister = useCallback((sidenote: HTMLDivElement) => {
    const index = sidenotes.current.indexOf(sidenote);
    if (index > -1) {
      sidenotes.current.splice(index, 1);
    }
    Array.from(sidenote.querySelectorAll("img")).forEach((img) => {
      img.removeEventListener("load", debouncedLayout);
    });
  }, [debouncedLayout]);

  const contextValue = useMemo(() => ({
    register,
    unregister,
    layout,
    sidenotes,
  }), [register, unregister, layout]);

  return (
    <SidenoteContext.Provider value={contextValue}>
      <div style={{position: "relative"}}>
        {children}
      </div>
    </SidenoteContext.Provider>
);
};


const useSidenoteRegistration = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const {register, unregister} = React.useContext(SidenoteContext);

  React.useLayoutEffect(() => {
    let current: HTMLDivElement | null = null;
    if (ref.current) {
      current = ref.current;
      register(ref.current);
    }
    return () => {
      if (current) {
        unregister(current);
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

  return <div className="expanding-side-img-container">
    <div className="expanding-side-img" ref={ref}>
    <Image
      src={src}
      alt={alt || caption || "image"}
      className={retina ? " retina" : ""}
    />
    <div className="caption-cont">
      {caption && <div className="caption"><p>{caption}</p></div>}
      {children && <div className="children">{children}</div>}
    </div>
    </div>
    <div className="overlay">
      <div className="figure">
        <Image
          src={src}
          alt={alt || caption || "image"}
          className={retina ? " retina" : ""}
        />
        {(caption || children) &&
          <div className="caption-overlay">
            {caption && <div className="caption">{caption}</div>}
            {children && <div className="children">{children}</div>}
          </div>
        }
      </div>
    </div>
  </div>
}
