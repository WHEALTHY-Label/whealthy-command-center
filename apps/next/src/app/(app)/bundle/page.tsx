import { redirect } from 'next/navigation';

/**
 * `gateDestination('bundle')` sends an un-bundled member here, but the bundle
 * flow itself is `/claim`, which is a full port of the live claim page. Rather
 * than keep two copies of the same screen, this route forwards and the gate
 * contract stays intact.
 */
export default function BundlePage() {
  redirect('/claim');
}
