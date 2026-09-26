import { useMemo } from 'react';

export type Tema = 'notte' | 'giorno';

/** Generatore deterministico: le stelle sono sempre nello stesso posto. */
function pseudoCasuale(seme: number) {
  let a = seme;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

const CIELO_NOTTE = 'linear-gradient(180deg, #05070f 0%, #0b1026 45%, #16204a 80%, #1f2a5c 100%)';
const CIELO_GIORNO = 'linear-gradient(180deg, #f6ebcd 0%, #efdcae 55%, #e3c587 100%)';

/**
 * Sfondo animato: cielo, luna e sole, nebbia, villaggio, vignetta e grana.
 * Cambiando `tema` la luna tramonta dietro il villaggio e sorge il sole (e viceversa).
 * Occupa il contenitore (absolute) oppure lo schermo (`fisso`).
 */
export function Sfondo({ tema = 'notte', fisso = false }: { tema?: Tema; fisso?: boolean }) {
  const notte = tema === 'notte';
  const stelle = useMemo(() => {
    const r = pseudoCasuale(7);
    return Array.from({ length: 110 }, (_, i) => ({
      x: r() * 400,
      y: r() * 560,
      raggio: 0.35 + r() * r() * 1.3,
      viva: i % 3 === 0,
      ritardo: -r() * 4,
    }));
  }, []);

  return (
    <div aria-hidden className={`pointer-events-none inset-0 overflow-hidden ${fisso ? 'fixed' : 'absolute'}`}>
      <div className="absolute inset-0" style={{ background: CIELO_GIORNO }} />
      <div className="cielo-strato absolute inset-0" style={{ background: CIELO_NOTTE, opacity: notte ? 1 : 0 }} />

      {/* viewBox verticale: sul telefono si vede tutto, su schermi larghi si taglia solo in basso */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice">
        <defs>
          <radialGradient id="alone-luna">
            <stop offset="0" stopColor="#dfe6ff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#dfe6ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="disco-luna" cx="0.4" cy="0.35">
            <stop offset="0" stopColor="#fbfaf3" />
            <stop offset="0.7" stopColor="#dde2ec" />
            <stop offset="1" stopColor="#b7bfd0" />
          </radialGradient>
          <radialGradient id="alone-sole">
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="cielo-strato" style={{ opacity: notte ? 1 : 0 }}>
          {stelle.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.raggio}
              fill="#e8ecff"
              opacity={s.viva ? undefined : 0.6}
              className={s.viva ? 'stella-viva' : undefined}
              style={s.viva ? { animationDelay: `${s.ritardo}s` } : undefined}
            />
          ))}
        </g>

        {/* Luna: di giorno scende dietro il villaggio */}
        <g className="astro" style={{ transform: notte ? 'none' : 'translate(40px, 640px)', opacity: notte ? 1 : 0 }}>
          <circle cx="318" cy="92" r="80" fill="url(#alone-luna)" />
          <circle cx="318" cy="92" r="34" fill="url(#disco-luna)" />
          <circle cx="308" cy="83" r="6" fill="#9aa3b8" opacity="0.25" />
          <circle cx="328" cy="104" r="8" fill="#9aa3b8" opacity="0.2" />
          <circle cx="326" cy="79" r="3.5" fill="#9aa3b8" opacity="0.25" />
        </g>

        {/* Sole: di notte è sotto l'orizzonte */}
        <g className="astro" style={{ transform: notte ? 'translate(-40px, 640px)' : 'none', opacity: notte ? 0 : 1 }}>
          <circle cx="92" cy="120" r="120" fill="url(#alone-sole)" />
          <circle cx="92" cy="120" r="30" fill="#f7c65a" />
        </g>
      </svg>

      <div className="nebbia" style={{ bottom: '14%' }} />
      <div className="nebbia" style={{ bottom: '4%', animationDuration: '52s', animationDelay: '-20s' }} />
      <Villaggio tema={tema} />
      <div className="vignetta cielo-strato" style={{ opacity: notte ? 1 : 0.35 }} />
      <div className="grana" />
    </div>
  );
}

/** Profilo del villaggio: bosco, case, campanile. Di notte con le finestre accese. */
export function Villaggio({ tema = 'notte' }: { tema?: Tema }) {
  const notte = tema === 'notte';
  return (
    <svg
      className="absolute bottom-0 left-0 w-full"
      style={{ height: 'min(30vh, 230px)' }}
      viewBox="0 0 400 140"
      preserveAspectRatio="xMidYMax slice"
    >
      <path className="villaggio-sagoma" style={{ fill: notte ? '#0a0f24' : '#b08a52' }} d="M0 104 Q50 86 110 96 T230 90 T330 94 T400 88 V140 H0 Z" />
      <g className="villaggio-sagoma" style={{ fill: notte ? '#03050c' : '#4a2f18' }}>
        {/* bosco a sinistra: abeti */}
        <path d="M0 140 V96 L8 78 L16 96 L12 96 L22 70 L32 96 L27 96 L38 64 L50 96 L45 96 L54 80 L62 104 L66 140 Z" />
        {/* casa 1 */}
        <path d="M66 140 V112 L64 112 L86 92 L108 112 L106 112 V140 Z" />
        <rect x="80" y="84" width="5" height="12" />
        {/* casa 2, più bassa */}
        <path d="M104 140 V120 L102 120 L120 106 L138 120 L136 120 V140 Z" />
        {/* campanile */}
        <path d="M150 140 V66 L147 66 L162 26 L177 66 L174 66 V140 Z" />
        <rect x="161" y="12" width="2" height="16" />
        <rect x="157" y="17" width="10" height="2" />
        {/* chiesa */}
        <path d="M174 140 V96 L171 96 L194 78 L217 96 L214 96 V140 Z" />
        {/* case a destra */}
        <path d="M214 140 V108 L211 108 L236 88 L261 108 L258 108 V140 Z" />
        <rect x="244" y="84" width="6" height="12" />
        <path d="M258 140 V118 L256 118 L274 104 L292 118 L290 118 V140 Z" />
        <path d="M290 140 V110 L288 110 L306 96 L324 110 L322 110 V140 Z" />
        {/* alberi tondi e abeti a destra */}
        <circle cx="336" cy="104" r="14" />
        <rect x="334" y="110" width="4" height="30" />
        <path d="M346 140 L360 74 L374 140 Z" />
        <path d="M366 140 L382 86 L398 140 Z" />
        <circle cx="398" cy="100" r="12" />
        <rect x="0" y="134" width="400" height="6" />
      </g>
      <g className="villaggio-finestre" fill="#f3c86a" style={{ opacity: notte ? 1 : 0 }}>
        <rect className="fiammella" x="76" y="118" width="4" height="6" />
        <rect x="93" y="118" width="4" height="6" opacity="0.8" />
        <rect className="fiammella" x="160" y="84" width="4" height="7" style={{ animationDelay: '-0.7s' }} />
        <rect x="190" y="104" width="3" height="10" opacity="0.7" />
        <rect x="197" y="104" width="3" height="10" opacity="0.7" />
        <rect className="fiammella" x="228" y="114" width="5" height="6" style={{ animationDelay: '-1.1s' }} />
        <rect x="300" y="116" width="4" height="6" opacity="0.85" />
      </g>
    </svg>
  );
}
