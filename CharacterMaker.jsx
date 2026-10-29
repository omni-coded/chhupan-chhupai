import { useState } from 'react';
import Avatar from './Avatar.jsx';
import { BGS, HAIR_COLORS, OUTFIT_COLORS, PARTS, PART_LABELS, PRESETS, SKINS, randomAvatar } from './avatar.js';

const TABS = [
  ['ready', 'Ready-made'],
  ['face', 'Face'],
  ['hair', 'Hair'],
  ['head', 'Headwear'],
  ['outfit', 'Outfit'],
];

function Swatches({ colors, value, onPick, label }) {
  return (
    <div className="maker-row">
      <span className="maker-label">{label}</span>
      <div className="swatches">
        {colors.map((c, i) => (
          <button key={c} type="button" className={`swatch ${value === i ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(i)} aria-label={`${label} ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

function PartPicker({ part, av, onPick }) {
  return (
    <div className="part-grid">
      {PARTS[part].map((v) => (
        <button key={v} type="button" className={`part ${av[part] === v ? 'on' : ''}`} onClick={() => onPick(v)}>
          <Avatar av={{ ...av, [part]: v }} size={54} />
          <small>{PART_LABELS[part][v]}</small>
        </button>
      ))}
    </div>
  );
}

/** Build your character: ready-made picks, or mix and match every part. */
export default function CharacterMaker({ value, onChange }) {
  const [tab, setTab] = useState('ready');
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="maker card">
      <div className="maker-top">
        <Avatar av={value} size={112} className="maker-preview" key={JSON.stringify(value)} />
        <div className="maker-actions">
          <b>Your character</b>
          <small>Everyone sees this on the map.</small>
          <button type="button" className="btn small" onClick={() => onChange(randomAvatar())}>
            🎲 Shuffle
          </button>
        </div>
      </div>

      <div className="maker-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="maker-body">
        {tab === 'ready' && (
          <div className="part-grid">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" className={`part ${JSON.stringify(p.av) === JSON.stringify(value) ? 'on' : ''}`} onClick={() => onChange({ ...p.av })}>
                <Avatar av={p.av} size={54} />
                <small>{p.name}</small>
              </button>
            ))}
          </div>
        )}
        {tab === 'face' && (
          <>
            <Swatches label="Skin" colors={SKINS} value={value.skin} onPick={(skin) => set({ skin })} />
            <PartPicker part="face" av={value} onPick={(face) => set({ face })} />
            <div className="maker-label" style={{ marginTop: 10 }}>
              Extras
            </div>
            <PartPicker part="extra" av={value} onPick={(extra) => set({ extra })} />
          </>
        )}
        {tab === 'hair' && (
          <>
            <Swatches label="Colour" colors={HAIR_COLORS} value={value.hairColor} onPick={(hairColor) => set({ hairColor })} />
            <PartPicker part="hair" av={value} onPick={(hair) => set({ hair })} />
          </>
        )}
        {tab === 'head' && <PartPicker part="head" av={value} onPick={(head) => set({ head })} />}
        {tab === 'outfit' && (
          <>
            <Swatches label="Colour" colors={OUTFIT_COLORS} value={value.outfitColor} onPick={(outfitColor) => set({ outfitColor })} />
            <PartPicker part="outfit" av={value} onPick={(outfit) => set({ outfit })} />
            <Swatches label="Background" colors={BGS} value={value.bg} onPick={(bg) => set({ bg })} />
          </>
        )}
      </div>
    </div>
  );
}
