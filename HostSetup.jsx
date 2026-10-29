import { useEffect, useMemo, useRef, useState } from 'react';
import { CATCH_RADIUS_M, DEFAULT_SETTINGS, DEFAULT_CENTER, fmtDur } from './game.js';
import MapView from './MapView.jsx';

const ROUND = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map((m) => m * 60);
const PING = [0, 1, 2, 3, 5, 10, 15, 20, 30].map((m) => m * 60);
const FLASH_EVERY = [30, 45, 60, 90, 120, 180, 300];
const FLASH_FOR = [2, 3, 5, 8];
const HEAD = [0, 1, 2, 3, 5, 10, 15, 20, 30].map((m) => m * 60);
const ZONE = [50, 75, 100, 150, 200, 300, 420, 500, 750, 1000, 1500]; // radius in metres

const across = (r) => (r * 2 >= 1000 ? `${(r * 2) / 1000} km across` : `${r * 2} m across`);
const nearest = (steps, v) => steps.reduce((best, s, i) => (Math.abs(s - v) < Math.abs(steps[best] - v) ? i : best), 0);

function StepSlider({ label, steps, value, onChange, fmt }) {
  const i = nearest(steps, value);
  return (
    <div className="rule">
      <div className="rule-head">
        <span>{label}</span>
        <b>{fmt(steps[i])}</b>
      </div>
      <input type="range" min={0} max={steps.length - 1} value={i} onChange={(e) => onChange(steps[+e.target.value])} aria-label={label} />
      <div className="rule-ends">
        <span>{fmt(steps[0])}</span>
        <span>{fmt(steps[steps.length - 1])}</span>
      </div>
    </div>
  );
}

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function HostSetup({ initial, submitLabel, onSubmit, onBack, busy, error }) {
  const [s, setS] = useState(() => ({ ...DEFAULT_SETTINGS, ...initial, center: initial?.center || null }));
  const [locMsg, setLocMsg] = useState('');
  const mapRef = useRef(null);
  const set = (patch) => setS((old) => ({ ...old, ...patch }));
  const center = s.center || DEFAULT_CENTER;
  const zone = useMemo(() => ({ ...center, radius: s.radius }), [center.lat, center.lng, s.radius]);
  const [fitKey, setFitKey] = useState(0);
  const [base, setBase] = useState('street');

  // Start the zone on the host's real location.
  useEffect(() => {
    if (!initial?.center) useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return setLocMsg('This browser has no location access.');
    setLocMsg('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set({ center: { lat: p.coords.latitude, lng: p.coords.longitude } });
        setFitKey((k) => k + 1);
        setLocMsg('');
      },
      (err) => setLocMsg(err.code === 1 ? 'Location blocked. Tap the map to place the zone instead.' : "Couldn't get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...s, center });
      }}
    >
      <h1 className="screen-title">Draw the maidan</h1>
      <p className="screen-sub">Tap the map to move the zone. Keep it away from busy roads.</p>

      <div className="setup-map">
        <MapView center={center} zone={zone} base={base} onTap={(c) => set({ center: c })} onReady={(m) => (mapRef.current = m)} fitKey={fitKey} />
        <span className="map-hint">Tap to move the zone</span>
      </div>
      <div className="row-gap" style={{ marginBottom: 6 }}>
        <button type="button" className="btn small cream" onClick={useMyLocation}>
          📍 Use my location
        </button>
        <button type="button" className="btn small cream" onClick={() => setBase(base === 'street' ? 'satellite' : 'street')}>
          {base === 'street' ? '🛰️ Satellite' : '🗺️ Street map'}
        </button>
        {!s.center && <span className="note" style={{ alignSelf: 'center' }}>Showing India Gate until we find you.</span>}
      </div>
      {locMsg && <p className="note">{locMsg}</p>}

      <div className="card rule-panel" style={{ margin: '18px 0' }}>
        <StepSlider
          label="ZONE SIZE"
          steps={ZONE}
          value={s.radius}
          fmt={across}
          onChange={(radius) => {
            set({ radius, finalRadius: Math.min(s.finalRadius, radius) });
            setFitKey((k) => k + 1);
          }}
        />
        <StepSlider label="ROUND LENGTH" steps={ROUND} value={s.roundSec} fmt={fmtDur} onChange={(roundSec) => set({ roundSec })} />
        <StepSlider label="HEAD START" steps={HEAD} value={s.headStartSec} fmt={(v) => (v ? fmtDur(v) : 'None')} onChange={(headStartSec) => set({ headStartSec })} />
      </div>

      <div className="card rule-panel" style={{ marginBottom: 18 }}>
        <div className="rule">
          <div className="rule-head" style={{ marginBottom: 6 }}>
            <span>WHO SEES WHOM</span>
          </div>
          <Seg
            value={s.visibility}
            onChange={(visibility) => set({ visibility })}
            options={[
              ['flash', '👀 Flash'],
              ['pings', '📍 Pings'],
              ['live', '🛰️ All live'],
            ]}
          />
          <p className="note" style={{ margin: '6px 0 0' }}>
            {s.visibility === 'flash'
              ? `Chors are hidden. Every ${fmtDur(s.flashEverySec)} police see them for ${s.flashForSec} seconds${s.hints ? ', with direction hints in between' : ''}. Recommended.`
              : s.visibility === 'live'
                ? `Every player is on the map in real time. Pure chase: easy for police.`
                : `Police only see where chors were at each ping. Chors never see police.`}{' '}
            Caught within {CATCH_RADIUS_M} m in every mode.
          </p>
        </div>
        {s.visibility === 'flash' && (
          <>
            <StepSlider label="FLASH EVERY" steps={FLASH_EVERY} value={s.flashEverySec} fmt={fmtDur} onChange={(flashEverySec) => set({ flashEverySec })} />
            <StepSlider label="CHORS VISIBLE FOR" steps={FLASH_FOR} value={s.flashForSec} fmt={(v) => `${v} seconds`} onChange={(flashForSec) => set({ flashForSec })} />
            <label className="toggle rule">
              <span>
                Hints for police
                <br />
                <small className="note">Direction and rough distance to the nearest chor, every 15 s.</small>
              </span>
              <input type="checkbox" checked={s.hints} onChange={(e) => set({ hints: e.target.checked })} />
            </label>
          </>
        )}
        {s.visibility === 'pings' && (
          <StepSlider label="PING EVERY" steps={PING} value={s.pingSec} fmt={(v) => (v ? fmtDur(v) : 'No pings')} onChange={(pingSec) => set({ pingSec })} />
        )}
        <label className="toggle rule">
          <span>
            Shrinking zone (Lakshman Rekha)
            <br />
            <small className="note">Closes in 4 times during the round, with a 1-minute warning.</small>
          </span>
          <input type="checkbox" checked={s.shrink} onChange={(e) => set({ shrink: e.target.checked })} />
        </label>
        {s.shrink && (
          <StepSlider
            label="FINAL ZONE SIZE"
            steps={ZONE.filter((r) => r <= s.radius)}
            value={s.finalRadius}
            fmt={across}
            onChange={(finalRadius) => set({ finalRadius })}
          />
        )}
        <div className="rule">
          <div className="rule-head" style={{ marginBottom: 6 }}>
            <span>WHEN A CHOR IS CAUGHT</span>
          </div>
          <Seg
            value={s.onJailed}
            onChange={(onJailed) => set({ onJailed })}
            options={[
              ['spectate', '🔒 Jail, they watch'],
              ['switch', '🚨 They join Police'],
            ]}
          />
        </div>
        {s.onJailed === 'spectate' && (
          <div className="rule">
            <div className="rule-head" style={{ marginBottom: 6 }}>
              <span>JAILED PLAYERS SEE</span>
            </div>
            <Seg
              value={s.spectate}
              onChange={(spectate) => set({ spectate })}
              options={[
                ['live', 'Live'],
                ['delayed', '1 min behind'],
                ['off', 'Nothing'],
              ]}
            />
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
      <button className="btn saffron block" disabled={busy}>
        {submitLabel}
      </button>
      <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={onBack}>
        Back
      </button>
    </form>
  );
}
