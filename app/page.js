'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

const RATE = 89000;

const SAMPLE = [
  { tag: 'income', label: 'Income', cat: 'Salary', amt: '+ $1,200.00', delay: 0, usd: 1200 },
  { tag: 'expense', label: 'Expense', cat: 'Dispatch cash — Ahmad', amt: '\u2212 1,780,000 LBP', delay: 650, usd: -1780000 / RATE },
  { tag: 'invest', label: 'Invest', cat: 'Gold, 2g', amt: '\u2212 $340.00', delay: 1300, usd: -340 },
  { tag: 'profit', label: 'Profit', cat: 'Sale — used generator', amt: '+ 4,500,000 LBP', delay: 1950, usd: 4500000 / RATE },
];

const TICKER_ITEMS = [
  { label: '1 USD', val: '89,000 LBP', dir: '' },
  { label: 'DISPATCH CASH', val: 'reconciled daily', dir: '' },
  { label: '1 USD', val: '89,050 LBP', dir: 'up' },
  { label: 'RENT', val: 'due, not yet paid', dir: '' },
  { label: '1 USD', val: '88,970 LBP', dir: 'down' },
  { label: 'GOLD, 1G', val: '$84.10', dir: 'up' },
];

function fmtUsd(v) {
  const s = v < 0 ? '-' : '';
  return s + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtLbp(v) {
  return Math.round(v).toLocaleString('en-US') + ' LBP';
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = checking, null = show landing
  const rowsRef = useRef(null);
  const netUsdRef = useRef(null);
  const netLbpRef = useRef(null);
  const dateRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
      else setSession(null);
    });
  }, [router]);

  useEffect(() => {
    if (session !== null) return; // only run landing effects once we know we're showing it

    if (dateRef.current) {
      dateRef.current.textContent = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    let timeouts = [];
    function playLedger() {
      if (!rowsRef.current) return;
      rowsRef.current.innerHTML = '';
      let running = 0;
      netUsdRef.current.textContent = fmtUsd(0);
      netLbpRef.current.textContent = fmtLbp(0);
      netUsdRef.current.classList.remove('neg');

      SAMPLE.forEach((row) => {
        const t = setTimeout(() => {
          if (!rowsRef.current) return;
          const el = document.createElement('div');
          el.className = 'ledger-row';
          el.innerHTML = `
            <span class="tag ${row.tag}">${row.label}</span>
            <span class="cat">${row.cat}</span>
            <span class="amt" style="color:${row.amt.startsWith('+') ? 'var(--green)' : 'var(--coral)'}">${row.amt}</span>
          `;
          rowsRef.current.appendChild(el);
          running += row.usd;
          netUsdRef.current.textContent = fmtUsd(running);
          netUsdRef.current.classList.toggle('neg', running < 0);
          netLbpRef.current.textContent = fmtLbp(running * RATE);
        }, row.delay);
        timeouts.push(t);
      });
    }

    playLedger();
    const interval = setInterval(playLedger, 7000);

    const track = document.getElementById('tickerTrack');
    if (track) {
      const row = TICKER_ITEMS.map((b) => `<span>${b.label} <span class="${b.dir}">${b.val}</span></span>`).join('');
      track.innerHTML = row + row;
    }

    const targets = document.querySelectorAll('.reveal, .reveal-stagger');
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
      );
      targets.forEach((t) => io.observe(t));
    } else {
      targets.forEach((t) => t.classList.add('in'));
    }

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
      if (io) io.disconnect();
    };
  }, [session]);

  if (session === undefined) {
    return <div style={{ minHeight: '100vh', background: 'var(--paper)' }} />;
  }

  return (
    <>
      <style>{`
        .lp * { box-sizing: border-box; }
        .lp { overflow-x: hidden; }
        .lp .mono { font-family: 'IBM Plex Mono', monospace; }
        .lp .topbar { height: 4px; background: linear-gradient(90deg, var(--green), var(--gold), var(--coral), var(--blue)); position: relative; z-index: 5; }

        .lp .stage {
          position: relative;
          background: radial-gradient(120% 140% at 50% -10%, #24374a 0%, var(--ink) 55%, #14202b 100%);
          color: var(--paper); overflow: hidden; min-height: 92vh; display: flex; flex-direction: column;
        }
        .lp .stage-grid {
          position: absolute; inset: -10% -10% -10% -10%;
          background-image: repeating-linear-gradient(0deg, rgba(247,244,236,0.05) 0px, rgba(247,244,236,0.05) 1px, transparent 1px, transparent 46px);
          animation: gridDrift 22s linear infinite; pointer-events: none;
        }
        @keyframes gridDrift { from { transform: translateY(0); } to { transform: translateY(46px); } }
        .lp .stage-glow {
          position: absolute; width: 620px; height: 620px; border-radius: 50%;
          background: radial-gradient(circle, rgba(184,137,76,0.18) 0%, rgba(184,137,76,0) 70%);
          top: -220px; right: -120px; pointer-events: none; animation: glowFloat 12s ease-in-out infinite;
        }
        @keyframes glowFloat { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px, 40px); } }
        .lp .stage-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(120% 100% at 50% 20%, transparent 40%, rgba(10,16,22,0.55) 100%);
        }

        .lp header.site {
          position: relative; z-index: 3; display: flex; align-items: center; justify-content: space-between;
          max-width: 1080px; margin: 0 auto; padding: 22px 24px 0; width: 100%;
        }
        .lp .brandmark { display: flex; align-items: baseline; gap: 10px; }
        .lp .brandmark .name { font-size: 18px; font-weight: 600; color: var(--paper); }
        .lp .brandmark .tag { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); font-family: 'IBM Plex Mono', monospace; }
        .lp .navlinks { display: flex; gap: 22px; align-items: center; }
        .lp .navlinks a { color: var(--paper); text-decoration: none; font-size: 14px; font-weight: 500; opacity: 0.85; }
        .lp .btn { display: inline-block; padding: 10px 18px; border-radius: 4px; font-weight: 600; font-size: 14px; text-decoration: none; border: 1px solid transparent; cursor: pointer; }
        .lp .btn-primary { background: var(--gold); color: var(--ink); }
        .lp .btn-ghost { background: transparent; color: var(--paper); border-color: rgba(247,244,236,0.3); }

        .lp .ticker { position: relative; z-index: 3; border-top: 1px solid rgba(247,244,236,0.12); border-bottom: 1px solid rgba(247,244,236,0.12); overflow: hidden; white-space: nowrap; margin-top: 26px; }
        .lp .ticker-track { display: inline-flex; gap: 48px; padding: 9px 0; animation: tickerScroll 26s linear infinite; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #B9C2CB; letter-spacing: 0.03em; }
        .lp .ticker-track span.up { color: var(--green); }
        .lp .ticker-track span.down { color: var(--coral); }
        @keyframes tickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        .lp .hero { position: relative; z-index: 3; max-width: 1080px; margin: 0 auto; padding: 56px 24px 60px; flex: 1; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; }
        .lp .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); margin-bottom: 14px; opacity: 0; animation: fadeUp 0.7s ease forwards; animation-delay: 0.1s; }
        .lp .hero h1 { font-size: 50px; line-height: 1.08; font-weight: 700; letter-spacing: -0.01em; color: var(--paper); margin: 0; }
        .lp .hero h1 .line { display: block; overflow: hidden; }
        .lp .hero h1 .line span { display: inline-block; opacity: 0; transform: translateY(100%); animation: lineUp 0.75s cubic-bezier(.22,1,.36,1) forwards; }
        .lp .hero h1 .line:nth-child(1) span { animation-delay: 0.25s; }
        .lp .hero h1 .line:nth-child(2) span { animation-delay: 0.42s; }
        @keyframes lineUp { to { opacity: 1; transform: translateY(0); } }
        .lp .hero p.sub { font-size: 16px; color: #B9C2CB; line-height: 1.55; margin: 20px 0 30px; max-width: 440px; opacity: 0; animation: fadeUp 0.8s ease forwards; animation-delay: 0.75s; }
        .lp .hero .ctas { display: flex; gap: 12px; flex-wrap: wrap; opacity: 0; animation: fadeUp 0.8s ease forwards; animation-delay: 0.95s; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .lp .ledger-card { background: var(--card); border: 1px solid var(--paper-line); border-radius: 6px; padding: 22px 22px 18px; position: relative; overflow: hidden; box-shadow: 0 1px 0 var(--paper-line), 0 30px 60px -22px rgba(0,0,0,0.55); opacity: 0; transform: translateY(24px) scale(0.98); animation: cardIn 0.9s cubic-bezier(.22,1,.36,1) forwards; animation-delay: 0.55s; }
        @keyframes cardIn { to { opacity: 1; transform: translateY(0) scale(1); } }
        .lp .ledger-card::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: linear-gradient(90deg, var(--green), var(--gold), var(--coral), var(--blue)); }
        .lp .ledger-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; padding-top: 6px; }
        .lp .ledger-head .title { font-family: 'Source Serif 4', serif; font-size: 15px; font-weight: 600; }
        .lp .ledger-head .date { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--slate); }
        .lp .ledger-rows { min-height: 168px; }
        .lp .ledger-row { display: grid; grid-template-columns: 74px 1fr auto; gap: 10px; align-items: baseline; padding: 7px 0; border-bottom: 1px dashed var(--paper-line); font-size: 13px; opacity: 0; transform: translateY(4px); animation: rowIn 0.45s ease forwards; }
        .lp .ledger-row .tag { font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; padding: 2px 6px; border-radius: 3px; width: fit-content; }
        .lp .ledger-row .cat { color: var(--ink); }
        .lp .ledger-row .amt { font-family: 'IBM Plex Mono', monospace; font-weight: 500; white-space: nowrap; }
        .lp .tag.income { color: var(--green); background: rgba(63,110,82,0.1); }
        .lp .tag.expense { color: var(--coral); background: rgba(176,70,63,0.1); }
        .lp .tag.invest { color: var(--gold); background: rgba(184,137,76,0.12); }
        .lp .tag.profit { color: var(--blue); background: rgba(76,122,158,0.1); }
        @keyframes rowIn { to { opacity: 1; transform: translateY(0); } }

        .lp .ledger-total { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--paper-line); display: flex; justify-content: space-between; align-items: baseline; }
        .lp .ledger-total .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--slate); }
        .lp .ledger-total .value { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; color: var(--green); transition: color 0.3s; }
        .lp .ledger-total .value.neg { color: var(--coral); }
        .lp .ledger-total .sub-value { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--slate); margin-left: 8px; }

        .lp .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1); }
        .lp .reveal.in { opacity: 1; transform: translateY(0); }
        .lp .reveal-stagger > * { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .lp .reveal-stagger.in > * { opacity: 1; transform: translateY(0); }
        .lp .reveal-stagger.in > *:nth-child(1) { transition-delay: 0s; }
        .lp .reveal-stagger.in > *:nth-child(2) { transition-delay: 0.1s; }
        .lp .reveal-stagger.in > *:nth-child(3) { transition-delay: 0.2s; }
        .lp .reveal-stagger.in > *:nth-child(4) { transition-delay: 0.3s; }

        @media (prefers-reduced-motion: reduce) {
          .lp .stage-grid, .lp .ticker-track { animation: none !important; }
          .lp .hero h1 .line span, .lp .eyebrow, .lp .hero p.sub, .lp .hero .ctas, .lp .ledger-card, .lp .ledger-row { animation: none !important; opacity: 1 !important; transform: none !important; }
          .lp .reveal, .lp .reveal-stagger, .lp .reveal-stagger > * { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        .lp section { max-width: 1080px; margin: 0 auto; padding: 54px 24px; }
        .lp section.divider { border-top: 1px solid var(--paper-line); }
        .lp .section-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 10px; }
        .lp .why { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 48px; align-items: start; }
        .lp .why h2 { font-size: 28px; font-weight: 600; line-height: 1.2; margin: 0; }
        .lp .why p { color: var(--slate); font-size: 15px; line-height: 1.65; margin-top: 14px; }

        .lp .tracks-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 26px; }
        .lp .track-card { background: var(--card); border: 1px solid var(--paper-line); border-radius: 5px; padding: 18px; border-top: 3px solid var(--ink); }
        .lp .track-card.income { border-top-color: var(--green); }
        .lp .track-card.expense { border-top-color: var(--coral); }
        .lp .track-card.invest { border-top-color: var(--gold); }
        .lp .track-card.profit { border-top-color: var(--blue); }
        .lp .track-card .k { font-family: 'Source Serif 4', serif; font-weight: 600; font-size: 17px; margin-bottom: 6px; }
        .lp .track-card .d { color: var(--slate); font-size: 13px; line-height: 1.5; }

        .lp .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; margin-top: 30px; }
        .lp .step .num { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--gold); border: 1px solid var(--paper-line); border-radius: 20px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .lp .step h3 { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
        .lp .step p { color: var(--slate); font-size: 14px; line-height: 1.55; margin: 0; }

        .lp .cta-band { background: var(--ink); color: var(--paper); border-radius: 6px; padding: 44px 40px; display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; }
        .lp .cta-band h2 { font-size: 24px; color: var(--paper); font-weight: 600; margin: 0; }
        .lp .cta-band p { color: #C9CFD6; font-size: 14px; margin-top: 8px; }
        .lp .cta-band .btn-primary { background: var(--gold); color: var(--ink); }

        .lp footer { max-width: 1080px; margin: 0 auto; padding: 28px 24px 44px; display: flex; justify-content: space-between; color: var(--slate); font-size: 12px; border-top: 1px solid var(--paper-line); }

        @media (max-width: 820px) {
          .lp .stage { min-height: unset; }
          .lp .hero { grid-template-columns: 1fr; padding-top: 30px; }
          .lp .hero h1 { font-size: 34px; }
          .lp .why { grid-template-columns: 1fr; }
          .lp .tracks-grid { grid-template-columns: repeat(2, 1fr); }
          .lp .steps { grid-template-columns: 1fr; }
          .lp .navlinks a:not(.btn) { display: none; }
          .lp .ticker { margin-top: 18px; }
        }
      `}</style>

      <div className="lp">
        <div className="topbar" />
        <div className="stage">
          <div className="stage-grid" />
          <div className="stage-glow" />
          <div className="stage-vignette" />

          <header className="site">
            <div className="brandmark">
              <span className="name">The Running Account</span>
              <span className="tag">Ledger No. 02</span>
            </div>
            <nav className="navlinks">
              <a href="#how">How it works</a>
              <a href="#track">What it tracks</a>
              <Link className="btn btn-ghost" href="/login">Log in</Link>
            </nav>
          </header>

          <div className="ticker">
            <div className="ticker-track" id="tickerTrack" />
          </div>

          <section className="hero">
            <div>
              <div className="eyebrow">Personal &amp; small business ledger — Lebanon</div>
              <h1>
                <span className="line"><span>Know your real numbers,</span></span>
                <span className="line"><span>in a currency that won&rsquo;t sit still.</span></span>
              </h1>
              <p className="sub">Log income, expenses, investments and sale profit by hand — in LBP or USD — and watch your true position take shape, month by month. No auto-fill, no assumptions. Just what you actually entered.</p>
              <div className="ctas">
                <Link className="btn btn-primary" href="/login">Log in</Link>
                <Link className="btn btn-ghost" href="/login">Create an account</Link>
              </div>
            </div>

            <div className="ledger-card">
              <div className="ledger-head">
                <span className="title">Today&rsquo;s entries</span>
                <span className="date mono" ref={dateRef} />
              </div>
              <div className="ledger-rows" ref={rowsRef} />
              <div className="ledger-total">
                <span className="label">Net today</span>
                <span>
                  <span className="value" ref={netUsdRef}>$0</span>
                  <span className="sub-value" ref={netLbpRef}>0 LBP</span>
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="divider why reveal">
          <div>
            <div className="section-label">Why manual</div>
            <h2>Habits drift.<br />Entries don&rsquo;t.</h2>
          </div>
          <p>Recurring auto-logged transactions assume rent is always on time and salaries never change — in Lebanon, neither is true. The Running Account has no automation to log a transaction for you. Every entry is typed in by the person who made it, when they made it, so the ledger reflects what actually happened, not a template of what usually does.</p>
        </section>

        <section className="divider" id="track">
          <div className="section-label reveal">What it tracks</div>
          <h2 className="reveal" style={{ fontSize: 28, fontWeight: 600 }}>Four kinds of movement</h2>
          <div className="tracks-grid reveal-stagger">
            <div className="track-card income">
              <div className="k" style={{ color: 'var(--green)' }}>Income</div>
              <div className="d">Salary, side work, anything coming in.</div>
            </div>
            <div className="track-card expense">
              <div className="k" style={{ color: 'var(--coral)' }}>Expenses</div>
              <div className="d">Rent, dispatch cash, day-to-day spend.</div>
            </div>
            <div className="track-card invest">
              <div className="k" style={{ color: 'var(--gold)' }}>Investments</div>
              <div className="d">Money put into stocks, gold, a stake in something.</div>
            </div>
            <div className="track-card profit">
              <div className="k" style={{ color: 'var(--blue)' }}>Sale profit</div>
              <div className="d">What you cleared when something was sold.</div>
            </div>
          </div>
        </section>

        <section className="divider" id="how">
          <div className="section-label reveal">How it works</div>
          <h2 className="reveal" style={{ fontSize: 28, fontWeight: 600 }}>Three steps, every time</h2>
          <div className="steps reveal-stagger">
            <div className="step">
              <div className="num">01</div>
              <h3>Log an entry</h3>
              <p>Pick a type, a category, an amount in LBP or USD. Takes seconds, no fields you don&rsquo;t need.</p>
            </div>
            <div className="step">
              <div className="num">02</div>
              <h3>See it by month</h3>
              <p>Every entry lands in its month&rsquo;s ledger — open one to see the daily detail and category split.</p>
            </div>
            <div className="step">
              <div className="num">03</div>
              <h3>Watch the trend</h3>
              <p>Net position and income-vs-expense lines build over time, so drift is visible before it&rsquo;s a problem.</p>
            </div>
          </div>
        </section>

        <section className="divider reveal">
          <div className="cta-band">
            <div>
              <h2>Start your ledger.</h2>
              <p>Free to use. Your entries are private to your account.</p>
            </div>
            <Link className="btn btn-primary" href="/login">Create an account</Link>
          </div>
        </section>

        <footer>
          <span>The Running Account</span>
          <span>Rate held at 89,000 LBP / USD</span>
        </footer>
      </div>
    </>
  );
}
