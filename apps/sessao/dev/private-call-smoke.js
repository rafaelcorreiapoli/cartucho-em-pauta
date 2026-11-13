// Run with Playwright CLI against the local servers described in README.md.
async page => {
  return page.evaluate(async () => {
    const {RoomVoice} = await import('/src/voice.ts');
    const {Client} = await import('/node_modules/.vite/deps/@colyseus_sdk.js');
    const NativeAudio = AudioContext;
    const sources = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new NativeAudio();
      await context.resume();
      const stream = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = sources.length ? 0 : .3;
      oscillator.frequency.value = 440;
      oscillator.connect(gain).connect(stream);
      oscillator.start();
      sources.push(context);
      return stream.stream;
    };
    const NativePeer = RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeer {
      constructor(options) {
        super({...options,iceServers:[]});
        this.addEventListener('track',event=>{
          const audio = document.createElement('audio');
          audio.srcObject = new MediaStream([event.track]);
          audio.volume = 0;
          document.body.append(audio);
          void audio.play();
        });
      }
    };
    const meters = [];
    window.AudioContext = class extends NativeAudio {
      createGain() {
        const gain = super.createGain();
        const connect = gain.connect.bind(gain);
        gain.connect = target => {
          if (target!==this.destination) return connect(target);
          const analyser = this.createAnalyser();
          connect(analyser);
          const silence = super.createGain();
          silence.gain.value = 0;
          analyser.connect(silence).connect(target);
          meters.push(analyser);
          return target;
        };
        return gain;
      }
    };
    const endpoint = 'http://127.0.0.1:2597';
    const a = await new Client(endpoint).create('plenary',{nick:'Alice'});
    const b = await new Client(endpoint).joinById(a.roomId,{nick:'Bia'});
    const rooms = [a,b];
    const views = new Map();
    const routes = new Map();
    const roster = new Map();
    const voices = rooms.map(room=>{
      room.onMessage('plenary',view=>views.set(room.sessionId,view));
      room.onMessage('voice-range',route=>routes.set(room.sessionId,route));
      room.onMessage('voice-roster',ids=>roster.set(room.sessionId,ids));
      return new RoomVoice(room,()=>{});
    });
    const rms = meter=>{
      const samples = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);
    };
    const volume = ()=>Math.max(0,...meters.map(rms));
    const wait = async (label,predicate)=>{
      for(let attempt=0;attempt<100;attempt++){
        if(predicate()) return;
        await new Promise(resolve=>setTimeout(resolve,80));
      }
      throw Error(label + ' ' + JSON.stringify({meters:meters.map(rms),routes:[...routes],calls:[...views].map(([id,v])=>[id,v.phase,v.gameplay?.call]),roster:[...roster]}));
    };
    const action = (room,token,action)=>room.send('gameplay',{token,action});
    try {
      a.send('start-match',{npcs:0,token:1});
      await wait('match',()=>views.get(b.sessionId)?.phase==='negotiation');
      for(const voice of voices) await voice.start();
      await wait('out of range',()=>routes.get(a.sessionId)?.length===0 && routes.get(b.sessionId)?.length===0 && roster.get(b.sessionId)?.length===2);
      action(a,2,{kind:'call',target:b.sessionId});
      await wait('invite',()=>views.get(b.sessionId)?.gameplay?.call?.state==='incoming');
      const before = volume();
      if (before>.005 || routes.get(b.sessionId).length) throw Error('Audio leaked before consent');
      action(b,1,{kind:'answer'});
      await wait('received WebRTC audio',()=>volume()>.025 && routes.get(b.sessionId)?.[0]?.[1]===1);
      const during = volume();
      action(b,2,{kind:'hangup'});
      await wait('restored spatial audio',()=>volume()<.005 && routes.get(b.sessionId)?.length===0);
      if (sources.length!==2) throw Error('Expected one synthetic input per client');
      return {before,during,after:volume(),syntheticInputs:sources.length};
    } finally {
      voices.forEach(voice=>voice.stop());
      await Promise.all(rooms.map(room=>room.leave()));
      await Promise.all(sources.map(context=>context.close()));
    }
  });
}
