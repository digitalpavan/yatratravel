import type { ReactNode } from 'react';
import { PageTransition } from '@/components/motion';

// Templates re-mount on every navigation, which is what triggers the shared page transition.
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
