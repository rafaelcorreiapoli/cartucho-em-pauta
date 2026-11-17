// Use the bundled Brazilian Portuguese speech fixture without a physical microphone.
// Open with ?captureVoice=1 to save the four received clips for listening.
async page => {
  await page.reload();
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'speech-fixture';
    input.type = 'file';
    input.hidden = true;
    document.body.append(input);
  });
  await page.locator('#speech-fixture').setInputFiles('dev/fixtures/megaphone-pt-br.flac');
  const {recordings,...measurements} = await page.evaluate(async () => {
    const capture = new URLSearchParams(location.search).get('captureVoice')==='1';
    const recordings = {};
    const speech = await document.querySelector('#speech-fixture').files[0].arrayBuffer();
    const {RoomVoice} = await import('/src/voice.ts');
    const {voiceModulatorDisguise} = await import('/src/live-disguise.ts');
    const NativeAudio = AudioContext;
    const devices = [];
    const inputs = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new NativeAudio();
      await context.resume();
      const output = context.createMediaStreamDestination();
      const signal = context.createBufferSource();
      signal.buffer = await context.decodeAudioData(speech.slice(0));
      signal.loop = true;
      const input = context.createGain();
      input.gain.value = devices.length ? 0 : 1;
      devices.push(context);
      inputs.push(input);
      signal.connect(input).connect(output);
      signal.start();
      return output.stream;
    };
    const meters = [];
    const playbackContexts = [];
    const receivedTracks = new Map();
    const NativePeer = RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeer { constructor(options) { super({...options,iceServers:[]});
      this.addEventListener('track',event=>{
        if (event.track.kind==='audio') receivedTracks.set(this,(receivedTracks.get(this) ?? 0)+1);
        const audio = document.createElement('audio');
        audio.srcObject = new MediaStream([event.track]);
        audio.volume = 0;
        document.body.append(audio);
        void audio.play();
      }); } };
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        playbackContexts.push(this);
      }
      createGain() {
        const gain = super.createGain();
        const connect = gain.connect.bind(gain);
        gain.connect = target => {
          if (target===this.destination) {
            const analyser = this.createAnalyser();
            analyser.fftSize=4096;
            connect(analyser);
            meters.push(analyser);
            const silent = super.createGain();
            silent.gain.value = 0;
            analyser.connect(silent).connect(target);
            return target;
          }
          return connect(target);
        };
        return gain;
      }
    };
    const {Client,server} = await import('/dev/megaphone-speech-client.ts');
    const client = new Client(server);
    const host = await client.create('plenary',{nick:'Emissor'});
    const listener = await client.joinById(host.roomId,{nick:'Ouvinte'});
    const observer = await client.joinById(host.roomId,{nick:'Observador distante'});
    const rooms = [host,listener,observer];
    let observedSpeakers = new Set();
    const peers = rooms.map(room=>new RoomVoice(room,speakers=>{
      if (room===observer) observedSpeakers = speakers;
    }));
    const pause = ms=>new Promise(resolve=>setTimeout(resolve,ms));
    async function waitFor(predicate,message) {
      for (let i=0;i<100;i++) {
        if (predicate()) return;
        await pause(80);
      }
      throw Error(message);
    }
    let view;
    let route;
    let observerRoutes;
    let listenerView;
    let listenerRecipients;
    let token = 0;
    host.onMessage('plenary',snapshot=>{ view = snapshot; });
    listener.onMessage('voice-range',levels=>{ route = levels.find(([id])=>id===host.sessionId); });
    listener.onMessage('plenary',snapshot=>{ listenerView = snapshot; });
    listener.onMessage('voice-send',ids=>{ listenerRecipients = ids; });
    observer.onMessage('voice-range',levels=>{ observerRoutes = levels; });
    for (const room of rooms) room.onMessage('*',()=>{});
    const act = action=>host.send('gameplay',{action,token:++token});
    const gear = ()=>view?.gameplay;
    async function buyAndEquip(kind) {
      act({kind:'shop-buy',target:kind,token:gear()?.dialogue?.token});
      await waitFor(()=>gear()?.equipped?.some(item=>item.kind===kind),'Item não comprado e equipado: '+kind);
    }
    const amplitude = analyser => {
      const buffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buffer);
      return Math.sqrt(buffer.reduce((sum,v)=>sum+v*v,0)/buffer.length);
    };
    try {
      host.send('start-match',{npcs:0,token:++token});
      await waitFor(()=>view?.phase==='negotiation','Partida não iniciou');
      await pause(200);
      act({kind:'open-shop',target:'vendor'});
      await waitFor(()=>gear()?.dialogue?.shop,'Loja indisponível');
      await buyAndEquip('megaphone');
      await buyAndEquip('voiceModulator');
      for (const peer of peers) await peer.start();
      await waitFor(()=>route?.[2]===true,'Rota de proximidade indisponível');
      const [hostAudio,listenerAudio,observerAudio] = playbackContexts;
      const receivingSpeech = context=>meters.find(m=>m.context===context && amplitude(m)>.01);
      await waitFor(()=>receivingSpeech(listenerAudio),'Áudio WebRTC inaudível');
      const receiver = receivingSpeech(listenerAudio);
      if (!receiver) throw Error('No WebRTC playback received');
      let distantReceiver;
      async function sample(name,broadcast) {
        const distant = broadcast ? distantReceiver : undefined;
        await waitFor(()=>!!route && (broadcast ? route[3]===true && route[2]===false : route[2]===true && !route[3]),'Rota de áudio inesperada: '+name);
        await pause(250);
        let recorded;
        if (capture) {
          const output = receiver.context.createMediaStreamDestination();
          receiver.connect(output);
          const recorder = new MediaRecorder(output.stream,{mimeType:'audio/webm;codecs=opus'});
          const chunks = [];
          recorder.ondataavailable = event=>chunks.push(event.data);
          const stopped = new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
          recorder.start();
          recorded = async()=>{
            recorder.stop();
            await stopped;
            receiver.disconnect(output);
            output.stream.getTracks().forEach(track=>track.stop());
            const clip = new Blob(chunks,{type:recorder.mimeType});
            if (!clip.size) throw Error('Empty recording: '+name);
            recordings[name] = await new Promise((resolve,reject)=>{
              const reader = new FileReader();
              reader.onload = ()=>resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(clip);
            });
          };
        }
        const measure = async meter=>{
          let peak = 0;
          let activeWindows = 0;
          let bass = 0;
          let mid = 0;
          const samples = new Float32Array(meter.fftSize);
          const spectrum = new Float32Array(meter.frequencyBinCount);
          const hzPerBin = meter.context.sampleRate / meter.fftSize;
          for (let i=0;i<110;i++) {
            meter.getFloatTimeDomainData(samples);
            const rms = Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);
            if (rms>.008) activeWindows++;
            meter.getFloatFrequencyData(spectrum);
            for (let bin=1;bin*hzPerBin<2400;bin++) {
              const hz = bin*hzPerBin;
              const energy = 10**(spectrum[bin]/10);
              if (hz>=90 && hz<=330) bass += energy;
              if (hz>=700) mid += energy;
            }
            for (const value of samples) peak = Math.max(peak,Math.abs(value));
            await pause(55);
          }
          if (activeWindows<15 || peak>=.98) throw Error(JSON.stringify({name,peak,activeWindows}));
          return {peak,activeWindows,bassToMid:bass/mid};
        };
        const [nearby,far] = await Promise.all([measure(receiver),distant && measure(distant)]);
        await recorded?.();
        return {...nearby,distant:far};
      }
      const normal = await sample('voz-normal',false);
      await waitFor(()=>observerRoutes?.length===0,'Observador deve estar fora da proximidade');
      act({kind:'call',target:listener.sessionId});
      await waitFor(()=>listenerView?.gameplay?.call?.state==='incoming','Chamada privada não chegou');
      listener.send('gameplay',{action:{kind:'answer'},token:1});
      await waitFor(()=>gear()?.call?.state==='connected' && listenerRecipients?.includes(host.sessionId),'Chamada não conectou');
      act({kind:'toggle-megaphone'});
      await waitFor(()=>observerRoutes?.some(([id,volume,local,filtered])=>id===host.sessionId && volume>0 && !local && filtered),
        'Observador distante não recebeu rota global');
      await waitFor(()=>receivingSpeech(observerAudio),'Áudio global não chegou ao terceiro cliente');
      if (observerRoutes.length!==1 || listenerRecipients.includes(observer.sessionId) || observedSpeakers.has(host.sessionId)) {
        throw Error('Megafone expôs a chamada ou a identidade do emissor');
      }
      const distantRoute = observerRoutes.find(([id])=>id===host.sessionId);
      if (route[1]!==distantRoute[1]) throw Error('Volume global depende da distância');
      peers[0].toggleMute();
      await waitFor(()=>meters.every(m=>amplitude(m)<.003),'O mute não silenciou a transmissão');
      inputs[1].gain.value = 1;
      const activePlayback = ()=>meters.filter(m=>amplitude(m)>.01);
      await waitFor(()=>receivingSpeech(hostAudio),'O interlocutor não chegou ao emissor');
      let privateAudioWindows = 0;
      for (let i=0;i<8;i++) {
        const audible = activePlayback();
        if (audible.some(m=>m.context!==hostAudio)) throw Error('O áudio privado do interlocutor vazou');
        if (audible.length===1) privateAudioWindows++;
        await pause(50);
      }
      if (!privateAudioWindows) throw Error('O teste não detectou áudio privado');
      inputs[1].gain.value = 0;
      peers[0].toggleMute();
      await waitFor(()=>receivingSpeech(listenerAudio) && receivingSpeech(observerAudio),'A transmissão não voltou após o mute');
      distantReceiver = receivingSpeech(observerAudio);
      if (!distantReceiver) throw Error('Áudio distante não chegou ao medidor');
      const filtered = await sample('megafone',true);
      if (filtered.bassToMid>=normal.bassToMid*.65) throw Error(JSON.stringify({normal,filtered}));
      act({kind:'toggle-modulator'});
      await waitFor(()=>gear()?.modulator?.active,'Modulador não ativado');
      await peers[0].setDisguise(voiceModulatorDisguise);
      const combined = await sample('megafone-com-modulador',true);
      act({kind:'toggle-megaphone'});
      await waitFor(()=>observerRoutes?.length===0,'Rota global permaneceu após desligar o megafone');
      if (!gear()?.modulator?.active) throw Error('Desligar o megafone desligou também o Modulador');
      if (gear()?.call?.state!=='connected') throw Error('Desligar o megafone encerrou a chamada');
      const disguiseOnly = await sample('modulador',false);
      if (combined.bassToMid>=disguiseOnly.bassToMid*.65) throw Error(JSON.stringify({disguiseOnly,combined}));
      if (filtered.distant.bassToMid>=normal.bassToMid*.65 || combined.distant.bassToMid>=disguiseOnly.bassToMid*.65) {
        throw Error(JSON.stringify({normal,filtered,disguiseOnly,combined}));
      }
      if (amplitude(distantReceiver)>=.003) throw Error('Áudio distante permaneceu após desligar o Megafone');
      const tracksPerConnection = [...receivedTracks.values()];
      if (meters.length!==6 || devices.length!==3 || tracksPerConnection.length!==6 || tracksPerConnection.some(count=>count!==1)) {
        throw Error(JSON.stringify({streams:meters.length,microphoneSources:devices.length,tracksPerConnection}));
      }
      return {normal,filtered,combined,disguiseOnly,privateAudioWindows,streams:meters.length,microphoneSources:devices.length,tracksPerConnection,recordings};
    } finally {
      peers.forEach(peer=>peer.stop());
      await Promise.all(rooms.map(room=>room.leave()));
      devices.forEach(device=>device.close());
    }
  });
  for (const [name,url] of Object.entries(recordings)) {
    const download = page.waitForEvent('download');
    await page.evaluate(({name,url})=>{
      const link = document.createElement('a');
      link.href = url;
      link.download = name+'.webm';
      link.click();
    },{name,url});
    await (await download).saveAs('/tmp/sessao-megaphone-'+name+'.webm');
  }
  return measurements;
}
