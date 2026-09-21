from http.server import BaseHTTPRequestHandler, HTTPServer
import sys

HTML = r'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Motion AI Readiness Advisor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap" rel="stylesheet">
  <style>
    :root { --ink:#17252a; --muted:#68777a; --paper:#f7f5ef; --panel:#fffefb; --line:#dfe4dc; --teal:#087f78; --teal-dark:#075c58; --coral:#df6b52; --yellow:#f6c85f; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:var(--paper); font:15px 'DM Sans',sans-serif; }
    .shell { max-width:1240px; margin:auto; padding:28px 40px 72px; }
    header { display:flex; justify-content:space-between; align-items:center; margin-bottom:64px; }
    .brand { display:flex; gap:12px; align-items:center; font-weight:700; letter-spacing:-.02em; }
    .mark { width:32px; height:32px; display:grid; place-items:center; background:var(--teal); color:white; border-radius:50%; font-size:16px; }
    .utility { color:var(--muted); font-size:13px; }
    .hero { display:grid; grid-template-columns:1.08fr .92fr; gap:70px; align-items:end; margin-bottom:62px; }
    h1,h2 { font-family:Newsreader,serif; font-weight:500; letter-spacing:-.035em; margin:0; }
    h1 { font-size:clamp(48px,6.5vw,82px); line-height:.94; max-width:700px; }
    h1 em { color:var(--teal); font-style:normal; }
    .intro { color:var(--muted); font-size:17px; line-height:1.65; max-width:400px; margin:0 0 6px; }
    .progress { border-top:1px solid var(--line); padding-top:18px; display:flex; gap:12px; align-items:center; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.1em; }
    .progress i { width:28px; height:4px; background:var(--teal); display:block; }
    .progress i:nth-child(n+3) { background:#cdd7d1; }
    .workspace { display:grid; grid-template-columns:1fr 310px; gap:24px; align-items:start; }
    .form-panel { background:var(--panel); border:1px solid var(--line); padding:34px 38px 38px; box-shadow:0 8px 28px #29332d08; }
    .eyebrow { color:var(--coral); text-transform:uppercase; letter-spacing:.13em; font-size:11px; font-weight:700; margin-bottom:10px; }
    h2 { font-size:35px; margin-bottom:10px; }
    .sub { color:var(--muted); line-height:1.6; margin:0 0 29px; }
    .field { border-top:1px solid var(--line); padding:22px 0; }
    .field label { display:block; font-weight:600; margin-bottom:13px; }
    .options { display:grid; gap:9px; }
    .options.two { grid-template-columns:1fr 1fr; }
    .option { border:1px solid var(--line); padding:13px 15px; cursor:pointer; display:flex; gap:10px; align-items:center; transition:.2s; background:#fff; }
    .option:hover { border-color:var(--teal); }
    .option.selected { border-color:var(--teal); background:#eaf5f2; color:var(--teal-dark); }
    .option input { accent-color:var(--teal); }
    .hint { color:var(--muted); font-size:12px; margin-top:10px; }
    .aside { padding:24px 0 0 10px; }
    .aside h3 { font:600 18px Newsreader,serif; margin:0 0 14px; }
    .aside p { color:var(--muted); line-height:1.6; font-size:13px; }
    .signal { display:flex; gap:12px; padding:14px 0; border-bottom:1px solid var(--line); font-size:13px; line-height:1.4; }
    .dot { flex:none; width:8px; height:8px; border-radius:50%; background:var(--yellow); margin-top:5px; }
    .dot.green { background:var(--teal); }
    button { border:0; background:var(--teal); color:#fff; padding:16px 22px; font:600 14px 'DM Sans'; cursor:pointer; margin-top:8px; transition:.2s; }
    button:hover { background:var(--teal-dark); transform:translateY(-1px); }
    .result { display:none; }
    .result.visible { display:block; animation:rise .35s ease both; }
    @keyframes rise { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
    .result-box { margin-top:30px; padding:28px; background:#eaf5f2; border-left:4px solid var(--teal); }
    .result-box.caution { background:#fff3df; border-color:var(--coral); }
    .result-box h3 { font:500 30px Newsreader,serif; margin:5px 0 10px; }
    .result-box p { line-height:1.6; margin:0; }
    .recommendation { margin-top:24px; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .next { border:1px solid var(--line); background:#fff; padding:17px; }
    .next strong { display:block; font-size:13px; margin-bottom:6px; }
    .next span { color:var(--muted); font-size:12px; line-height:1.5; }
    @media (max-width:800px) { .shell{padding:22px 18px 50px} header{margin-bottom:40px}.hero{display:block;margin-bottom:38px}.intro{margin-top:25px}.workspace{display:block}.aside{padding:30px 0 0}.form-panel{padding:25px 20px}.options.two,.recommendation{grid-template-columns:1fr} }
  </style>
</head>
<body>
  <main class="shell">
    <header><div class="brand"><span class="mark">✦</span> Motion / AI advisor</div><div class="utility">A practical decision tool for legal teams</div></header>
    <section class="hero"><h1>Should AI help write your <em>motion?</em></h1><p class="intro">A quick, risk-aware assessment for deciding where generative AI belongs in your document workflow. It takes about two minutes.</p></section>
    <div class="workspace">
      <section class="form-panel">
        <div class="eyebrow">Step 01 / Your motion</div><h2>Tell us what you’re working with.</h2><p class="sub">There’s no right answer. Your responses shape a recommendation, not a legal opinion.</p>
        <form id="advisorForm">
          <div class="field"><label>What kind of motion is this?</label><div class="options"><label class="option"><input type="radio" name="type" value="routine" required> Routine or procedural</label><label class="option"><input type="radio" name="type" value="substantive"> Substantive or dispositive</label><label class="option"><input type="radio" name="type" value="emergency"> Emergency or time-sensitive</label></div><div class="hint">Think about the stakes and how much the court’s decision could change the case.</div></div>
          <div class="field"><label>Does it contain sensitive or restricted information?</label><div class="options two"><label class="option"><input type="radio" name="sensitive" value="no" required> No / low sensitivity</label><label class="option"><input type="radio" name="sensitive" value="yes"> Yes</label></div><div class="hint">Examples: privileged material, personal data, trade secrets, or sealed facts.</div></div>
          <div class="field"><label>How much human review can you commit to?</label><div class="options"><label class="option"><input type="radio" name="review" value="full" required> Full review by a qualified attorney</label><label class="option"><input type="radio" name="review" value="limited"> Limited review / tight turnaround</label><label class="option"><input type="radio" name="review" value="none"> No meaningful review available</label></div></div>
          <button type="submit">See my recommendation <span aria-hidden="true">→</span></button>
        </form>
        <div id="result" class="result"><div class="result-box" id="resultBox"><div class="eyebrow">Your readout</div><h3 id="resultTitle"></h3><p id="resultText"></p><div class="recommendation"><div class="next"><strong>Good use of AI</strong><span id="goodUse"></span></div><div class="next"><strong>Keep human-led</strong><span id="humanUse"></span></div></div></div></div>
      </section>
      <aside class="aside"><h3>What we’re weighing</h3><p>The best AI workflow is usually narrower than “write the whole document.” We look for ways to get leverage while keeping judgment where it matters.</p><div class="signal"><span class="dot"></span><span><b>Confidentiality</b><br>Can the information safely enter your tool?</span></div><div class="signal"><span class="dot"></span><span><b>Consequence</b><br>What’s the cost of an unsupported claim?</span></div><div class="signal"><span class="dot green"></span><span><b>Oversight</b><br>Who will verify every citation and fact?</span></div></aside>
    </div>
  </main>
  <script>
    document.querySelectorAll('.option input').forEach(input => input.addEventListener('change', e => { document.querySelectorAll(`input[name="${e.target.name}"]`).forEach(i => i.closest('.option').classList.toggle('selected', i.checked)); }));
    document.getElementById('advisorForm').addEventListener('submit', e => { e.preventDefault(); const data = new FormData(e.target); const highRisk = data.get('sensitive') === 'yes' || data.get('review') !== 'full' || data.get('type') === 'substantive' || data.get('type') === 'emergency'; const box = document.getElementById('resultBox'); document.getElementById('resultTitle').textContent = highRisk ? 'Use AI around the motion, not as its author.' : 'AI can be a useful drafting partner.'; document.getElementById('resultText').textContent = highRisk ? 'Your answers point to a human-led workflow. You can still use AI for bounded tasks, but keep the reasoning, facts, and final language under direct attorney control.' : 'Your motion looks like a reasonable candidate for carefully supervised AI assistance. Treat its output as a first draft and verify every source, quotation, and factual assertion.'; document.getElementById('goodUse').textContent = highRisk ? 'Outline structure, surface missing issues, or turn attorney notes into a checklist.' : 'Create a first-pass outline, suggest neutral phrasing, and identify repetitive sections.'; document.getElementById('humanUse').textContent = highRisk ? 'Legal strategy, factual assertions, citations, and anything based on restricted information.' : 'Final argument, authorities, factual record, and all filing-ready language.'; box.classList.toggle('caution', highRisk); document.getElementById('result').classList.add('visible'); document.getElementById('result').scrollIntoView({behavior:'smooth', block:'nearest'}); });
  </script>
</body></html>'''

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ('/', '/index.html'):
            body = HTML.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)
    def log_message(self, format, *args):
        return

if __name__ == '__main__':
  port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
  print(f'Motion AI Advisor running at http://localhost:{port}')
  HTTPServer(('0.0.0.0', port), Handler).serve_forever()
