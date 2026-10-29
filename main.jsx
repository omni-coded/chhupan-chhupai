import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import Landing from './Landing.jsx';
import Play from './Play.jsx';

function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const join = path.match(/^\/join\/([A-Za-z0-9]{6})/);
  if (path.startsWith('/play') || join) return <Play joinCode={join?.[1]?.toUpperCase()} />;
  return <Landing />;
}

createRoot(document.getElementById('root')).render(<App />);

// The service worker makes the game installable ("Add to Home screen"). Production only,
// so it never caches the dev server's files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
