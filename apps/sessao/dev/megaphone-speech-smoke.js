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
    const NativeAudio = AudioContext;
    const devices = [];
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
      signal.connect(input).connect(output);
      signal.start();
      return output.stream;
    };
    const meters = [];
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
    const rooms = new Map();
    const peers = ['a','b'].map(sessionId=>{
      const handlers = new Map();
      const room = {sessionId,onMessage:(key,fn)=>handlers.set(key,fn),onDrop:()=>{},
        send(type,body) {if(type==='voice-signal') rooms.get(body.to).get(type)?.({from:sessionId,signal:body.signal});}};
      rooms.set(sessionId,handlers);
      return new RoomVoice(room,()=>{});
    });
    const pause = ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const send = (id,key,data)=>rooms.get(id).get(key)?.(data);
    const amplitude = analyser => {
      const buffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buffer);
      return Math.sqrt(buffer.reduce((sum,v)=>sum+v*v,0)/buffer.length);
    };
    for (const peer of peers) await peer.start();
    send('b','voice-roster',['a','b']);
    send('a','voice-roster',['a','b']);
    const heartbeat = setInterval(()=>send('a','voice-send',['b']),70);
    try {
      for(let i=0;i<50 && !meters.some(m=>amplitude(m)>.01);i++) await pause(150);
      const receiver = meters.find(m=>amplitude(m)>.01);
      if (!receiver) throw Error('No WebRTC playback received');
      async function sample(name,broadcast) {
        send('b','voice-range',[['a',.85,!broadcast,broadcast]]);
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
        let peak = 0;
        let activeWindows = 0;
        let bass = 0;
        let mid = 0;
        const samples = new Float32Array(receiver.fftSize);
        const spectrum = new Float32Array(receiver.frequencyBinCount);
        const hzPerBin = receiver.context.sampleRate / receiver.fftSize;
        for (let i=0;i<110;i++) {
          receiver.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);
          if (rms>.008) activeWindows++;
          receiver.getFloatFrequencyData(spectrum);
          for (let bin=1;bin*hzPerBin<2400;bin++) {
            const hz = bin*hzPerBin;
            const energy = 10**(spectrum[bin]/10);
            if (hz>=90 && hz<=330) bass += energy;
            if (hz>=700) mid += energy;
          }
          for (const value of samples) peak = Math.max(peak,Math.abs(value));
          await pause(55);
        }
        await recorded?.();
        if (activeWindows<15 || peak>=.98) throw Error(JSON.stringify({broadcast,peak,activeWindows}));
        return {peak,activeWindows,bassToMid:bass/mid};
      }
      const normal = await sample('voz-normal',false);
      const filtered = await sample('megafone',true);
      if (filtered.bassToMid>=normal.bassToMid*.65) throw Error(JSON.stringify({normal,filtered}));
      await peers[0].setDisguise({pitch:7,style:'shifted'});
      const combined = await sample('megafone-com-modulador',true);
      const disguiseOnly = await sample('modulador',false);
      if (combined.bassToMid>=disguiseOnly.bassToMid*.65) throw Error(JSON.stringify({disguiseOnly,combined}));
      const tracksPerConnection = [...receivedTracks.values()];
      if (meters.length!==2 || devices.length!==2 || tracksPerConnection.length!==2 || tracksPerConnection.some(count=>count!==1)) {
        throw Error(JSON.stringify({streams:meters.length,microphoneSources:devices.length,tracksPerConnection}));
      }
      return {normal,filtered,combined,disguiseOnly,streams:meters.length,microphoneSources:devices.length,tracksPerConnection,recordings};
    } finally {
      clearInterval(heartbeat);
      peers.forEach(peer=>peer.stop(false));
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
