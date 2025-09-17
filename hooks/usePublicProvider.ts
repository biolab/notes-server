import React, { useState } from 'react';
import { getPublicProvider, LinkDesc } from "@/api/content";

export const usePublicProvider = (slug: string) => {
  const [provider, setProvider] = useState<LinkDesc | null>(null);
  React.useEffect(() => {
    getPublicProvider(slug).then(setProvider);
  }, [slug]);

  return provider;
}
