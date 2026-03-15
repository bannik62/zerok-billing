<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<nav>
  <div class="nav-logo">zero<span>K</span>_billing<span class="dim">;</span></div>
  <div class="nav-links">
    <a href="#features">features</a>
    <a href="#stack">stack</a>
    <a href="#opensource">open source</a>
  </div>
  <div class="nav-actions">
    <button type="button" class="nav-auth" onclick={onGoToLogin}>Se connecter</button>
    <button type="button" class="nav-auth nav-auth-primary" onclick={onGoToRegister}>Créer un compte</button>
    <a href="https://github.com/bannik62/zerok-billing" class="nav-cta" target="_blank" rel="noopener noreferrer">→ GitHub</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-grid"></div>
  <div class="hero-badge">// open source · MIT license · v1.0</div>
  <h1>La facturation freelance.<br /><span class="strike">complexe</span>&nbsp;<span class="accent">zero-knowledge.</span></h1>
  <p class="hero-sub">
    Chiffrement AES-256-GCM côté client. Vos données restent vôtres —
    pas sur un serveur SaaS, pas dans un cloud opaque.
  </p>
  <div class="hero-actions">
    <a href="https://github.com/bannik62/zerok-billing" class="btn-primary" target="_blank" rel="noopener noreferrer">Voir le code →</a>
    <a href="#features" class="btn-ghost">Explorer les features</a>
  </div>
  <div class="hero-code">
    <div><span class="c-g">// initialisation</span></div>
    <div><span class="c-b">const</span> billing = <span class="c-b">new</span> <span class="c-a">ZeroKBilling</span>({'{'}</div>
    <div>&nbsp;&nbsp;encryption: <span class="c-s">'AES-256-GCM'</span>,</div>
    <div>&nbsp;&nbsp;storage: <span class="c-s">'IndexedDB'</span>,</div>
    <div>&nbsp;&nbsp;sync: <span class="c-y">true</span>,</div>
    <div>&nbsp;&nbsp;serverSideData: <span class="c-s">false</span> <span class="c-g">// never</span></div>
    <div>{'}'});</div>
    <div>&nbsp;</div>
    <div><span class="c-g">// ✓ 0 knowledge · ✓ multi-device · ✓ Stripe</span></div>
  </div>
</section>

<div class="stats-bar">
  <div class="stat-item"><div class="stat-num">0</div><div class="stat-label">données lisibles côté serveur</div></div>
  <div class="stat-item"><div class="stat-num">AES-256</div><div class="stat-label">chiffrement GCM</div></div>
  <div class="stat-item"><div class="stat-num">MIT</div><div class="stat-label">licence open source</div></div>
  <div class="stat-item"><div class="stat-num">∞</div><div class="stat-label">clients / factures</div></div>
</div>

<section id="features">
  <div class="container">
    <div class="reveal">
      <div class="section-label">// 01 — FONCTIONNALITÉS</div>
      <h2>Conçu pour des gens<br />qui savent ce qu'ils font.</h2>
      <p class="section-sub">Pas de compromis entre sécurité et ergonomie. Les deux, par design.</p>
    </div>
    <div class="features-grid reveal">
      {#each features as f}
        <div class="feat-card">
          <div class="feat-icon">{f.tag}</div>
          <div class="feat-title">{f.title}</div>
          <p class="feat-desc">{f.desc}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<section id="stack" class="stack-section">
  <div class="container">
    <div class="split">
      <div class="reveal">
        <div class="section-label">// 02 — STACK TECHNIQUE</div>
        <h2>Construit sur<br />des fondations solides.</h2>
        <p class="section-sub">Chaque choix technologique est justifié. Pas de magic framework, pas de dette cachée.</p>
        <div class="stack-grid">
          {#each stack as s}
            <span class="stack-pill" class:hl={s.hl}>{s.name}</span>
          {/each}
        </div>
      </div>
      <div class="terminal-block reveal">
        <div class="terminal-bar">
          <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
        </div>
        <div class="terminal-body">
          <div><span class="t-prompt">$ </span><span class="t-cmd">zerok status --verbose</span></div>
          <div>&nbsp;</div>
          <div><span class="t-out">backend&nbsp;&nbsp;&nbsp;&nbsp; </span><span class="t-ok">✓ running</span><span class="t-out"> :3000</span></div>
          <div><span class="t-out">database&nbsp;&nbsp;&nbsp; </span><span class="t-ok">✓ connected</span></div>
          <div><span class="t-out">encryption&nbsp; </span><span class="t-ok">✓ AES-256-GCM</span></div>
          <div><span class="t-out">stripe&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span><span class="t-ok">✓ webhook active</span></div>
          <div>&nbsp;</div>
          <div><span class="t-prompt">$ </span><span class="t-cmd">zerok invoice create</span></div>
          <div><span class="t-out">→ client&nbsp;&nbsp;&nbsp;&nbsp; </span><span class="t-val">ACME Corp</span></div>
          <div><span class="t-out">→ montant&nbsp;&nbsp;&nbsp; </span><span class="t-val">2 400,00 €</span></div>
          <div><span class="t-out">→ encrypted&nbsp; </span><span class="t-ok">✓ locally</span></div>
          <div><span class="t-out">→ PDF&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span><span class="t-ok">✓ generated</span></div>
          <div><span class="t-out">→ stripe&nbsp;&nbsp;&nbsp;&nbsp; </span><span class="t-ok">✓ link ready</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="opensource" class="oss-section">
  <div class="container">
    <div class="section-label reveal">// 03 — OPEN SOURCE</div>
    <h2 class="reveal">Le code est là.<br />Lisez, forkez, contribuez.</h2>
    <p class="oss-sub reveal">Pas de black box. Pas d'abonnement SaaS. Un projet de portfolio qui tourne en prod — MIT licensed, documentation incluse.</p>
    <div class="oss-actions reveal">
      <a href="https://github.com/bannik62/zerok-billing" class="btn-primary" target="_blank" rel="noopener noreferrer">Voir sur GitHub →</a>
      <a href="https://opensource.org/licenses/MIT" class="gh-badge" target="_blank" rel="noopener noreferrer"><div class="gh-dot"></div> MIT License</a>
      <a href="https://github.com/bannik62/zerok-billing/discussions/13" class="gh-badge" target="_blank" rel="noopener noreferrer"><div class="gh-dot"></div> Contributions welcome</a>
      <a href="https://notebooklm.google.com/notebook/55ad0cf8-fed0-445a-b88a-22a81e52ca30" class="gh-badge gh-badge-doc" target="_blank" rel="noopener noreferrer"><div class="gh-dot"></div> NotebookLM doc</a>
    </div>
  </div>
</section>

<footer>
  <div class="footer-logo">zeroK_billing<span class="dim">;</span></div>
  <div class="footer-links">
    <a href="https://github.com/bannik62/zerok-billing" target="_blank" rel="noopener noreferrer">GitHub</a>
    <a href="#opensource" class="footer-placeholder">Documentation</a>
    <a href="#opensource" class="footer-placeholder">Démo live</a>
  </div>
  <div class="footer-copy">built by Yohann · Calais, FR</div>
</footer>

<script>
  import { onMount } from 'svelte';

  const { onGoToLogin, onGoToRegister } = $props();

  onMount(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });

  const features = [
    { tag: 'CRYPTO',   title: 'Chiffrement zero-knowledge',  desc: "Toutes vos données sont chiffrées en AES-256-GCM avant d'être stockées ou synchronisées. La clé ne quitte jamais votre appareil." },
    { tag: 'SYNC',     title: 'Multi-device sécurisé',       desc: "Synchronisation cross-device via signature cryptographique. Chaque appareil vérifie l'intégrité des données avant import." },
    { tag: 'STRIPE',   title: 'Paiement intégré',            desc: "Génération de liens de paiement Stripe directement depuis l'interface. Encaissement, suivi, webhooks — tout est là." },
    { tag: 'PROSPECT', title: "Recherche d'entreprises",     desc: "Recherche conversationnelle via les APIs publiques françaises (SIRENE, INPI, BODACC). Zéro abonnement Pappers." },
    { tag: 'OFFLINE',  title: 'Fonctionne hors-ligne',       desc: "Basé sur IndexedDB. Vos factures sont accessibles même sans connexion. La synchro reprend automatiquement." },
    { tag: 'EXPORT',   title: 'Export PDF / CSV',            desc: "Génération de factures conformes au format légal français. Export comptable en un clic pour votre expert." },
  ];

  const stack = [
    { name: 'Node.js',     hl: true  },
    { name: 'Express',     hl: true  },
    { name: 'Svelte 5',    hl: true  },
    { name: 'Prisma',      hl: false },
    { name: 'PostgreSQL',  hl: false },
    { name: 'Tailwind',    hl: false },
    { name: 'Docker',      hl: false },
    { name: 'Stripe API',  hl: false },
    { name: 'AES-256-GCM', hl: true  },
    { name: 'IndexedDB',   hl: false },
    { name: 'JWT',         hl: false },
    { name: 'MCP',         hl: false },
  ];
</script>

<style>
  :global(html) { scroll-behavior: smooth; }

  :global(body.landing-visible) {
    background: #0a0c0f;
    color: #e8eaf0;
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
  }

  :global(body.landing-visible *) {
    --bg: #0a0c0f; --bg2: #111318; --bg3: #1a1d24;
    --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.13);
    --text: #e8eaf0; --muted: #7a7f8e; --accent: #00e5a0;
    --danger: #ff4d6a;
    --mono: 'Space Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }

  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap;
    padding: 0 2rem; height: 56px;
    gap: 0.75rem;
    background: rgba(10,12,15,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 0.5px solid var(--border);
  }
  @media (max-width: 640px) {
    nav {
      padding: 0.5rem 1rem;
      height: auto;
      min-height: 56px;
      gap: 0.5rem;
    }
    .nav-links { order: 2; }
    .nav-actions {
      order: 3;
      flex-wrap: wrap;
      flex-basis: 100%;
      justify-content: flex-start;
      padding-top: 0.25rem;
      border-top: 0.5px solid var(--border);
    }
  }
  .nav-logo { font-family: var(--mono); font-size: 14px; color: var(--accent); letter-spacing: 0.02em; flex-shrink: 0; }
  .nav-logo span { color: var(--muted); }
  .dim { color: rgba(255,255,255,0.15); }
  .nav-links { display: flex; gap: 1.5rem; flex-shrink: 0; }
  .nav-links a { font-family: var(--mono); font-size: 12px; color: var(--muted); text-decoration: none; letter-spacing: 0.05em; transition: color 0.2s; }
  .nav-links a:hover { color: var(--text); }
  @media (max-width: 640px) {
    .nav-links { gap: 1rem; }
  }
  .nav-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; flex-shrink: 0; }
  .nav-auth {
    font-family: var(--mono); font-size: 12px; color: var(--muted); background: transparent;
    border: none; padding: 6px 12px; cursor: pointer; text-decoration: none;
    letter-spacing: 0.05em; transition: color 0.2s;
  }
  .nav-auth:hover { color: var(--text); }
  .nav-auth-primary { color: var(--accent); border: 0.5px solid var(--accent); padding: 6px 16px; border-radius: 3px; }
  .nav-auth-primary:hover { background: var(--accent); color: #000; }
  .nav-cta { font-family: var(--mono); font-size: 12px; color: var(--accent); text-decoration: none; border: 0.5px solid var(--accent); padding: 6px 16px; border-radius: 3px; transition: background 0.2s, color 0.2s; }
  .nav-cta:hover { background: var(--accent); color: #000; }

  .hero {
    padding: 100px 2rem 3rem;
    display: flex; flex-direction: column; align-items: center;
    text-align: center; position: relative; overflow: hidden;
  }
  .hero-grid {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(0,229,160,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,160,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
  }
  .hero-badge { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; color: var(--accent); border: 0.5px solid rgba(0,229,160,0.3); background: rgba(0,229,160,0.06); padding: 5px 14px; border-radius: 2px; margin-bottom: 1.5rem; display: inline-block; animation: fadeUp 0.6s ease both; }
  h1 { font-family: var(--mono); font-size: clamp(2rem, 5vw, 3.6rem); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; color: var(--text); max-width: 820px; animation: fadeUp 0.6s 0.1s ease both; }
  .accent { color: var(--accent); }
  .strike { position: relative; color: var(--muted); }
  .strike::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: var(--danger); transform: rotate(-2deg); }
  .hero-sub { font-size: 1.05rem; color: var(--muted); max-width: 540px; margin: 1.25rem auto 0; font-weight: 300; animation: fadeUp 0.6s 0.2s ease both; }
  .hero-actions { display: flex; gap: 1rem; margin-top: 2rem; flex-wrap: wrap; justify-content: center; animation: fadeUp 0.6s 0.3s ease both; }

  .btn-primary { font-family: var(--mono); font-size: 13px; background: var(--accent); color: #000; border: none; padding: 12px 28px; border-radius: 3px; cursor: pointer; text-decoration: none; font-weight: 700; letter-spacing: 0.04em; transition: opacity 0.2s, transform 0.15s; display: inline-block; }
  .btn-primary:hover { opacity: 0.85; transform: translateY(-1px); }
  .btn-ghost { font-family: var(--mono); font-size: 13px; background: transparent; color: var(--text); border: 0.5px solid var(--border2); padding: 12px 28px; border-radius: 3px; cursor: pointer; text-decoration: none; letter-spacing: 0.04em; transition: border-color 0.2s; display: inline-block; }
  .btn-ghost:hover { border-color: var(--text); }

  .hero-code {
    margin-top: 2.5rem; font-family: var(--mono); font-size: 12px;
    background: var(--bg2); border: 0.5px solid var(--border2);
    border-radius: 6px; padding: 1.25rem 1.5rem;
    text-align: left; max-width: 520px; width: 100%; line-height: 1.9;
    animation: fadeUp 0.6s 0.4s ease both; position: relative;
  }
  .hero-code::before { content: ''; position: absolute; top: -1px; left: 24px; right: 24px; height: 1px; background: linear-gradient(90deg, transparent, var(--accent), transparent); }
  .c-g { color: var(--muted); } .c-a { color: var(--accent); } .c-b { color: #79b8ff; } .c-s { color: #f97583; } .c-y { color: #ffea7f; }

  .stats-bar { border-top: 0.5px solid var(--border); border-bottom: 0.5px solid var(--border); background: var(--bg2); display: flex; justify-content: center; flex-wrap: wrap; }
  .stat-item { padding: 1.5rem 3rem; text-align: center; border-right: 0.5px solid var(--border); }
  .stat-item:last-child { border-right: none; }
  .stat-num { font-family: var(--mono); font-size: 1.8rem; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: 12px; color: var(--muted); letter-spacing: 0.06em; font-family: var(--mono); margin-top: 2px; }

  section { padding: 6rem 2rem; }
  .container { max-width: 1100px; margin: 0 auto; }
  .section-label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.15em; color: var(--accent); margin-bottom: 0.75rem; }
  h2 { font-family: var(--mono); font-size: clamp(1.5rem, 3vw, 2.4rem); font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; color: var(--text); margin-bottom: 1rem; }
  .section-sub { color: var(--muted); font-size: 1rem; max-width: 500px; font-weight: 300; margin-bottom: 3rem; }

  .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1px; background: var(--border); border: 0.5px solid var(--border); border-radius: 8px; overflow: hidden; }
  .feat-card { background: var(--bg); padding: 2rem; transition: background 0.2s; }
  .feat-card:hover { background: var(--bg2); }
  .feat-icon { font-family: var(--mono); font-size: 11px; color: var(--accent); letter-spacing: 0.1em; margin-bottom: 1rem; padding: 4px 10px; border: 0.5px solid rgba(0,229,160,0.2); display: inline-block; border-radius: 2px; background: rgba(0,229,160,0.05); }
  .feat-title { font-family: var(--mono); font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; }
  .feat-desc { font-size: 0.875rem; color: var(--muted); font-weight: 300; line-height: 1.7; }

  .stack-section { background: var(--bg2); }
  .stack-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; }
  .stack-pill { font-family: var(--mono); font-size: 12px; padding: 6px 16px; border: 0.5px solid var(--border2); border-radius: 2px; color: var(--text); letter-spacing: 0.05em; background: var(--bg3); transition: border-color 0.2s, color 0.2s; }
  .stack-pill:hover { border-color: var(--accent); color: var(--accent); }
  .stack-pill.hl { border-color: rgba(0,229,160,0.4); color: var(--accent); background: rgba(0,229,160,0.05); }

  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; }
  @media (max-width: 768px) { .split { grid-template-columns: 1fr; gap: 3rem; } }

  .terminal-block { background: var(--bg2); border: 0.5px solid var(--border2); border-radius: 6px; overflow: hidden; }
  .terminal-bar { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-bottom: 0.5px solid var(--border); background: var(--bg3); }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot-r { background: #ff5f57; } .dot-y { background: #ffbd2e; } .dot-g { background: #28ca41; }
  .terminal-body { padding: 1.25rem 1.5rem; font-family: var(--mono); font-size: 12px; line-height: 2; }
  .t-prompt { color: var(--accent); } .t-cmd { color: var(--text); } .t-out { color: var(--muted); } .t-val { color: #79b8ff; } .t-ok { color: var(--accent); }

  .oss-section { text-align: center; padding: 7rem 2rem; position: relative; overflow: hidden; }
  .oss-section::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(0,229,160,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,160,0.03) 1px, transparent 1px); background-size: 32px 32px; }
  .oss-section .container { position: relative; }
  .oss-section h2 { margin: 0 auto 1rem; max-width: 700px; }
  .oss-sub { color: var(--muted); max-width: 480px; margin: 0 auto 2.5rem; font-weight: 300; }
  .oss-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
  .gh-badge { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 12px; color: var(--muted); border: 0.5px solid var(--border2); padding: 8px 18px; border-radius: 3px; text-decoration: none; background: var(--bg2); transition: border-color 0.2s, color 0.2s; }
  .gh-badge:hover { border-color: var(--text); color: var(--text); }
  .gh-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }

  footer { border-top: 0.5px solid var(--border); padding: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
  .footer-logo { font-family: var(--mono); font-size: 13px; color: var(--muted); }
  .footer-copy { font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: 0.06em; }
  .footer-links { display: flex; gap: 1.5rem; }
  .footer-links a { font-family: var(--mono); font-size: 11px; color: var(--muted); text-decoration: none; letter-spacing: 0.06em; transition: color 0.2s; }
  .footer-links a:hover { color: var(--text); }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

  :global(.reveal) {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  :global(.reveal.visible) {
    opacity: 1;
    transform: none;
  }
</style>
