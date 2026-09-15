import { useEffect, useState } from 'react';
import {
  createTrackedObjectUrl,
  revokeTrackedObjectUrl,
} from '../services/objectUrlRegistry';

/** Preview URL tracked para revoke en purga D.1 / unmount. */
export function useTrackedObjectUrl(file: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = createTrackedObjectUrl(file);
    setUrl(next);
    return () => {
      revokeTrackedObjectUrl(next);
    };
  }, [file]);

  return url;
}
