export async function mountVoiceTest() {
  const panel = document.querySelector<HTMLDetailsElement>('#voice-test')!;
  const record = document.querySelector<HTMLButtonElement>('#voice-record')!;
  const convert = document.querySelector<HTMLButtonElement>('#voice-convert')!;
  const select = document.querySelector<HTMLSelectElement>('#voice-model')!;
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

  function clearResult() {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = undefined;
    result.removeAttribute('src');
    result.hidden = true;
  }

  async function applyVoice() {
    if (!recording) return;
    record.disabled = convert.disabled = select.disabled = true;
    clearResult();
    status.textContent = 'Convertendo a voz…';
    try {
      const response = await fetch('/__voice-lab/'+select.value,{method:'POST',body:recording});
      if (!response.ok) throw new Error(await response.text());
      playbackUrl = URL.createObjectURL(await response.blob());
      result.src = playbackUrl;
      result.hidden = false;
      status.textContent = 'Pronto. Aperte play para ouvir.';
    } catch (error) {
      status.textContent = error instanceof Error && error.message ?
        error.message : 'Não foi possível converter a gravação.';
    } finally {
      record.disabled = convert.disabled = select.disabled = false;
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
