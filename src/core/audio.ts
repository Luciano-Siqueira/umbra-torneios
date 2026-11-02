// ============================================================
// Beeps via Web Audio API (sem arquivos externos)
// ============================================================

let ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function beep(freq: number, durMs: number, tipo: OscillatorType = "sine"): Promise<void> {
  return new Promise((resolve) => {
    try {
      const c = getCtx();
      if (c.state === "suspended") c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = tipo;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, c.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durMs / 1000);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + durMs / 1000);
      setTimeout(resolve, durMs);
    } catch {
      resolve();
    }
  });
}

async function sequencia(freq: number, durMs: number, n: number, pausa = 100) {
  for (let i = 0; i < n; i++) {
    await beep(freq, durMs);
    if (i < n - 1) await new Promise((r) => setTimeout(r, pausa));
  }
}

/** Aviso discreto: 1 beep curto (10 min antes do fim normal) */
export function beepCurto() { void beep(1000, 250); }

/** Aviso medio: 3 beeps de intensidade media (fim do tempo normal) */
export function beepLongo() { void sequencia(800, 500, 3, 150); }

/** Aviso longo: 6 beeps (rodada finalizada por tempo) */
export function beepFinal() { void sequencia(600, 700, 6, 150); }
