import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { avatarSvg } from './avatar.js';

// Both tile sources are free to use with attribution and need no API key.
const BASE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' },
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
  },
};

/**
 * A Leaflet map with the zone, the upcoming zone and live player markers.
 *
 * markers: [{ id, lat, lng, cls, avatar, color, label }]  (they glide between GPS updates)
 * me: { lat, lng, acc } draws the GPS accuracy circle; catchRadius draws the jail ring around me.
 * Calls onReady(map) once so the parent can recenter it.
 */
export default function MapView({ center, zoom = 17, zone, nextZone, markers = [], me, catchRadius, onTap, onReady, fitKey, base = 'street', className = '' }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({ markers: new Map() });
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], zoom);
    m.on('click', (e) => tapRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    // Markers glide between GPS fixes, but must jump instantly while the map zooms.
    m.on('zoomstart', () => el.current?.classList.add('cc-zooming'));
    m.on('zoomend', () => setTimeout(() => el.current?.classList.remove('cc-zooming'), 60));
    map.current = m;
    onReady?.(m);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      layers.current = { markers: new Map() };
    };
    // The map is created once; later props are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base map
  useEffect(() => {
    const ly = layers.current;
    ly.base?.remove();
    const b = BASE_LAYERS[base] || BASE_LAYERS.street;
    ly.base = L.tileLayer(b.url, b.options).addTo(map.current);
    el.current.classList.toggle('warm-tiles', base === 'street');
  }, [base]);

  // Zone circles
  useEffect(() => {
    const m = map.current;
    const ly = layers.current;
    const sync = (key, z, style) => {
      if (!z) {
        ly[key]?.remove();
        ly[key] = null;
        return;
      }
      if (!ly[key]) ly[key] = L.circle([z.lat, z.lng], { radius: z.radius, interactive: false, ...style }).addTo(m);
      else {
        ly[key].setLatLng([z.lat, z.lng]);
        ly[key].setRadius(z.radius);
      }
    };
    sync('zone', zone, { color: '#ff7a00', weight: 4, fillColor: '#ff7a00', fillOpacity: 0.08 });
    sync('next', nextZone, { color: '#e0218a', weight: 3, dashArray: '10 8', fill: false });
  }, [zone?.lat, zone?.lng, zone?.radius, nextZone?.lat, nextZone?.lng, nextZone?.radius]);

  // My GPS accuracy and catch ring
  useEffect(() => {
    const m = map.current;
    const ly = layers.current;
    const sync = (key, radius, style) => {
      if (!me || !radius) {
        ly[key]?.remove();
        ly[key] = null;
        return;
      }
      if (!ly[key]) ly[key] = L.circle([me.lat, me.lng], { radius, interactive: false, ...style }).addTo(m);
      else {
        ly[key].setLatLng([me.lat, me.lng]);
        ly[key].setRadius(radius);
      }
    };
    sync('acc', me?.acc, { color: '#1c7ed6', weight: 1, fillColor: '#1c7ed6', fillOpacity: 0.12 });
    sync('catch', catchRadius, { color: '#1f4fbf', weight: 3, dashArray: '4 4', fillColor: '#1f4fbf', fillOpacity: 0.15 });
  }, [me?.lat, me?.lng, me?.acc, catchRadius]);

  // Fit to the zone when asked
  useEffect(() => {
    if (!zone || !map.current) return;
    map.current.fitBounds(L.latLng(zone.lat, zone.lng).toBounds(zone.radius * 2.2), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Markers
  useEffect(() => {
    const m = map.current;
    const known = layers.current.markers;
    const seen = new Set();
    for (const mk of markers) {
      seen.add(mk.id);
      const html = `<div class="cc-marker ${mk.cls || ''}"><span class="face">${mk.avatar ? avatarSvg(mk.avatar) : ''}</span>${mk.label ? `<span class="lbl">${escapeHtml(mk.label)}</span>` : ''}</div>`;
      const icon = () => L.divIcon({ html, className: 'cc-anim', iconSize: [42, 42], iconAnchor: [21, 21] });
      let entry = known.get(mk.id);
      if (!entry) {
        const marker = L.marker([mk.lat, mk.lng], { icon: icon(), interactive: false, zIndexOffset: mk.cls?.includes('me') ? 1000 : 0 }).addTo(m);
        entry = { marker, html };
        known.set(mk.id, entry);
      } else {
        entry.marker.setLatLng([mk.lat, mk.lng]);
        if (entry.html !== html) {
          entry.marker.setIcon(icon());
          entry.html = html;
        }
      }
    }
    for (const [id, entry] of known) {
      if (!seen.has(id)) {
        entry.marker.remove();
        known.delete(id);
      }
    }
  }, [markers]);

  return <div ref={el} className={className} style={{ width: '100%', height: '100%' }} />;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
