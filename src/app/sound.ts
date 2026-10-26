// Soft synthesized move sounds, so no audio files need to ship or load.
let ctx: AudioContext | null = null;

export function playMoveSound(capture: boolean) {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(capture ? 330 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(capture ? 180 : 380, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(capture ? 0.18 : 0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // Audio unavailable: stay silent.
  }
}
