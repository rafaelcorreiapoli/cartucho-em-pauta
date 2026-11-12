export async function mountVoiceTest() {
  const panel = document.querySelector<HTMLDetailsElement>('#voice-test')!;
  const record = document.querySelector<HTMLButtonElement>('#voice-record')!;
  const convert = document.querySelector<HTMLButtonElement>('#voice-convert')!;
  const select = document.querySelector<HTMLSelectElement>('#voice-model')!;
  const profile = document.querySelector<HTMLSelectElement>('#voice-profile')!;
  const disguise = document.querySelector<HTMLFieldSetElement>('#disguise-controls')!;
  const pitch = document.querySelector<HTMLInputElement>('#disguise-pitch')!;
  const pitchValue = document.querySelector<HTMLOutputElement>('#disguise-pitch-value')!;
  const style = document.querySelector<HTMLSelectElement>('#disguise-style')!;
  const result = document.querySelector<HTMLAudioElement>('#voice-result')!;
  const status = document.querySelector<HTMLElement>('#voice-test-status')!;
  let recorder: MediaRecorder | undefined;
  let mic: MediaStream | undefined;
  let recording: Blob | undefined;
  let playbackUrl: string | undefined;
  let timer: number | undefined;

  const available = await fetch('/__voice-lab/').then(response => response.status===204).catch(() => false);
  if (!available || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
  panel.hidden = false;
  const updateProfile = () => {
    disguise.hidden = select.value!=='disfarce';
    profile.disabled = !disguise.hidden || select.value==='original';
  };
  select.addEventListener('change',updateProfile);
  updateProfile();
  pitch.addEventListener('input',() => {
    const value = pitch.valueAsNumber;
    pitchValue.value = (value>0 ? '+' : '') + value + (Math.abs(value)===1 ? ' semitom' : ' semitons');
  });

  function clearResult() {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = undefined;
    result.removeAttribute('src');
    result.hidden = true;
  }

  async function applyVoice() {
    if (!recording) return;
    record.disabled = convert.disabled = select.disabled = profile.disabled = disguise.disabled = true;
    clearResult();
    status.textContent = 'Convertendo a voz…';
    try {
      const options = new URLSearchParams({profile:profile.value});
      if (select.value==='disfarce') {
        options.set('pitch',pitch.value);
        options.set('style',style.value);
      }
      const response = await fetch('/__voice-lab/'+select.value+'?'+options,{method:'POST',body:recording});
      if (!response.ok) throw new Error(await response.text());
      playbackUrl = URL.createObjectURL(await response.blob());
      result.src = playbackUrl;
      result.hidden = false;
      status.textContent = 'Pronto. Aperte play para ouvir.';
    } catch (error) {
      status.textContent = error instanceof Error && error.message ?
        error.message : 'Não foi possível converter a gravação.';
    } finally {
      record.disabled = convert.disabled = select.disabled = disguise.disabled = false;
      updateProfile();
    }
  }

  function stopMicrophone() {
    window.clearTimeout(timer);
    mic?.getTracks().forEach(track => track.stop());
    mic = undefined;
  }

  convert.onclick = () => void applyVoice();
  record.onclick = async () => {
    if (recorder?.state==='recording') {
      recorder.stop();
      return;
    }
    record.disabled = true;
    convert.disabled = true;
    status.textContent = 'Aguardando permissão do microfone…';
    try {
      mic = await navigator.mediaDevices.getUserMedia({audio:true});
      const current = new MediaRecorder(mic);
      recorder = current;
      const chunks: Blob[] = [];
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      current.onstop = () => {
        stopMicrophone();
        recorder = undefined;
        record.textContent = 'Gravar frase';
        recording = new Blob(chunks,{type:current.mimeType});
        if (recording.size) void applyVoice();
        else {
          record.disabled = false;
          status.textContent = 'Grave uma frase antes de converter.';
        }
      };
      current.start();
      clearResult();
      record.textContent = 'Parar gravação';
      record.disabled = false;
      status.textContent = 'Gravando por até 10 segundos…';
      timer = window.setTimeout(() => {
        if (current.state==='recording') current.stop();
      },10000);
    } catch {
      stopMicrophone();
      record.disabled = false;
      convert.disabled = !recording;
      status.textContent = 'Não foi possível acessar o microfone.';
    }
  };

  window.addEventListener('pagehide',() => {
    if (recorder) recorder.onstop = null;
    stopMicrophone();
    clearResult();
  });
}
