import { navigate } from './router.js';
import Avatar from './Avatar.jsx';
import { PRESETS } from './avatar.js';

const go = (to) => (e) => {
  e.preventDefault();
  navigate(to);
};

export function Logo({ light }) {
  return (
    <a className="logo" href="/" onClick={go('/')} style={{ color: light ? '#fff' : 'var(--ink)' }}>
      <span className="logo-mark">
        <Avatar av={PRESETS[0].av} size={34} />
      </span>
      <span>
        <span style={{ fontSize: 24 }}>Chhupan Chhupai</span>
        <small>Police vs Chor</small>
      </span>
    </a>
  );
}

const STEPS = [
  ['Host', 'Draw the zone on the map and share the code.'],
  ['Join', 'Friends open the link. Teams are random.'],
  ['Chhupo', 'Chors run and hide. Police count.'],
  ['Pakdo', 'Police within 5 m? Chor goes to jail.'],
];

const FAQ = [
  ['Kitne players?', '3 to 70. Everyone needs their own phone with location on.'],
  ['Team kaun choose karta hai?', 'Nobody. Teams are drawn at random every round.'],
  ['Different Wi-Fi or mobile data?', 'No problem. Once the game is online, anyone with internet can join with the code.'],
  ['Free hai?', 'Yes, completely free. No account, no ads.'],
];

function PhoneMock() {
  const pins = [
    [PRESETS[1].av, '30%', '46%', 'chor'],
    [PRESETS[2].av, '68%', '62%', 'chor'],
    [PRESETS[5].av, '52%', '30%', 'chor'],
    [PRESETS[3].av, '42%', '68%', 'police'],
  ];
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-screen">
        <div className="phone-notif">
          <b>Chhupan Chhupai · now</b>
          <br />
          🚨 Police 6 m door hai. Bhaago!
        </div>
        <div className="fake-map">
          <div className="park" />
          <div className="lake" />
        </div>
        <div className="fake-zone" />
        {pins.map(([av, left, top, team], i) => (
          <div key={i} className={`fake-pin ${team}`} style={{ left, top }}>
            <Avatar av={av} size={34} />
          </div>
        ))}
        <div className="phone-hud">
          <div>
            <small>TIME LEFT</small>
            <span className="clock">27:07</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <small>NEAREST POLICE</small>
            <span className="clock" style={{ fontSize: 20 }}>6 m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <header className="nav">
        <div className="nav-inner">
          <Logo light />
          <nav className="nav-links">
            <a href="#how">How to play</a>
            <a href="#install">Install</a>
            <a className="btn small" href="/play" onClick={go('/play')}>
              Play now
            </a>
          </nav>
        </div>
      </header>

      <section className="hero rangoli-bg">
        <div className="wrap hero-grid">
          <div>
            <div className="kicker">Real-life Police vs Chor</div>
            <h1>
              Chhupan chhupai, <em>poore mohalle ke saath.</em>
            </h1>
            <p className="sub">Run on real streets with your friends. The phone shows the map, keeps time and catches the chors.</p>
            <div className="hero-ctas">
              <a className="btn" href="/play" onClick={go('/play')}>
                🚩 Host a game
              </a>
              <a className="btn cream" href="/play" onClick={go('/play')}>
                🔑 Join with code
              </a>
            </div>
            <div className="hero-chips">
              <span className="chip">3–70 players</span>
              <span className="chip">Real GPS map</span>
              <span className="chip">Free</span>
            </div>
          </div>
          <PhoneMock />
        </div>
      </section>
      <div className="toran on-saffron" style={{ transform: 'scaleY(-1)' }} />

      <section id="how">
        <div className="wrap">
          <h2 className="section-title">Kaise khelein?</h2>
          <div className="steps">
            {STEPS.map(([title, body], i) => (
              <div className="card step" key={title}>
                <div className="num">{i + 1}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <div className="teams">
            <div className="card team-card police">
              <Avatar av={PRESETS[3].av} size={72} className="team-av" />
              <h3>Police</h3>
              <p>Chase chors on the live map. Get within 5 m to catch them.</p>
            </div>
            <div className="card team-card chor">
              <Avatar av={PRESETS[2].av} size={72} className="team-av" />
              <h3>Chor</h3>
              <p>Hide inside the zone. Stay free till time runs out to win.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="install" className="install">
        <div className="wrap">
          <h2 className="section-title">Phone pe app jaisa.</h2>
          <p className="lede">No Play Store needed. Open the game link on your phone and add it to your home screen.</p>
          <div className="install-grid">
            <div className="card">
              <h3>Android (Chrome)</h3>
              <p>Tap ⋮ menu → <b>Add to Home screen</b> or <b>Install app</b>.</p>
            </div>
            <div className="card">
              <h3>iPhone (Safari)</h3>
              <p>
                Tap the Share button → <b>Add to Home Screen</b>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2 className="section-title">Sawaal?</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details className="card" key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <span>Play safe. Stay off busy roads.</span>
          <span className="truck-art">PING OK PLEASE</span>
        </div>
      </footer>
    </div>
  );
}
