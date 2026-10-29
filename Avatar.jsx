import { useMemo } from 'react';
import { avatarSvg } from './avatar.js';

/** A drawn character in a circle. */
export default function Avatar({ av, size = 40, className = '', bg = true }) {
  const html = useMemo(() => avatarSvg(av, { bg }), [JSON.stringify(av), bg]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className={`avatar ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}
