import type { Room } from '@colyseus/sdk';
import { LiveDisguise, type Disguise } from './live-disguise';
import type { VoiceSignal } from './voice-protocol';

type Meter = { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; buffer: Float32Array<ArrayBuffer>; lastSound: number };
type Peer = {
  connection: RTCPeerConnection;
  pending: Promise<void>;
  candidates: RTCIceCandidateInit[];
  meter?: Meter;
  playback?: GainNode;
  outgoing: GainNode;
  destination: MediaStreamAudioDestinationNode;
};

function iceServers(): RTCIceServer[] {
  const configured = import.meta.env.VITE_VOICE_ICE_SERVERS;
  return configured ? JSON.parse(configured) : [{urls:'stun:stun.l.google.com:19302'}];
}

export class RoomVoice {
  private audio?: AudioContext;
  private mic?: MediaStream;
  private disguise?: LiveDisguise;
  private localMeter?: Meter;
  private peers = new Map<string,Peer>();
  private timer?: number;
  private generation = 0;
  private range?: Map<string,number>;
  private outbound = new Set<string>();
  private sendUntil = 0;

  constructor(private room: Room, private onSpeaking: (ids: Set<string>) => void) {
    room.onMessage('voice-send',(ids:string[])=>{
      this.outbound = new Set(ids);
      this.sendUntil = (this.audio?.currentTime ?? 0)+.35;
      for (const [id,peer] of this.peers) this.updateOutgoing(id,peer);
    });
    room.onDrop(()=>{
      this.outbound.clear();
      this.sendUntil = 0;
      for (const id of this.peers.keys()) this.removePeer(id);
    });
    room.onMessage('voice-range', (levels:[string,number][]) => this.setRange(new Map(levels)));
    room.onMessage('voice-roster', (ids: string[]) => this.syncPeers(ids));
    room.onMessage('voice-signal', ({from,signal}: {from:string; signal:VoiceSignal}) => {
      const peer = this.peers.get(from);
      if (peer) this.queue(peer, () => this.receive(from,peer,signal));
    });
  }

  get active() { return !!this.mic; }
  get muted() { return this.mic?.getAudioTracks().every(track => !track.enabled) ?? false; }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('O microfone precisa de HTTPS ou localhost.');
    const generation = ++this.generation;
    const audio = new AudioContext();
    this.audio = audio;
    try {
      void audio.resume().catch(() => {});
      const mic = await navigator.mediaDevices.getUserMedia({audio:{
        echoCancellation:true,noiseSuppression:true,autoGainControl:true,
      }});
      if (generation !== this.generation) {
        mic.getTracks().forEach(track => track.stop());
        return;
      }
      this.mic = mic;
      this.disguise = new LiveDisguise(audio,mic);
      this.localMeter = this.meter(mic);
      this.timer = window.setInterval(() => this.measure(),80);
      this.room.send('voice-join');
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop(false);
      throw error;
    }
  }

  setDisguise(effect?: Disguise) {
    return this.disguise?.setEffect(effect);
  }

  toggleMute() {
    const enabled = this.muted;
    this.mic?.getAudioTracks().forEach(track => { track.enabled = enabled; });
    if (this.disguise) this.disguise.output.gain.value = enabled ? 1 : 0;
    void this.audio?.resume().catch(() => {});
    this.measure();
  }

  setRange(range?: Map<string,number>) {
    this.range = range;
    for (const [id,peer] of this.peers) this.updateGain(id,peer);
  }

  private volume(id:string) { return this.range ? this.range.get(id) ?? 0 : 1; }

  private updateOutgoing(id:string, peer:Peer) {
    const now = this.audio!.currentTime;
    const gain = peer.outgoing.gain;
    const allowed = this.outbound.has(id) && now<this.sendUntil;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(allowed ? 1 : 0,now);
    if (allowed) gain.setValueAtTime(0,this.sendUntil);
  }

  private updateGain(id:string, peer:Peer) {
    peer.playback?.gain.setTargetAtTime(this.volume(id),this.audio!.currentTime,.025);
  }

  stop(notify = true) {
    ++this.generation;
    if (notify && this.mic) this.room.send('voice-leave');
    window.clearInterval(this.timer);
    for (const id of this.peers.keys()) this.removePeer(id);
    this.mic?.getTracks().forEach(track => track.stop());
    this.mic = undefined;
    this.outbound.clear();
    this.disguise?.stop();
    this.disguise = undefined;
    this.localMeter = undefined;
    if (this.audio) void this.audio.close().catch(() => {});
    this.audio = undefined;
    this.onSpeaking(new Set());
  }

  private syncPeers(ids: string[]) {
    if (!this.disguise || !ids.includes(this.room.sessionId)) return;
    for (const id of this.peers.keys()) if (!ids.includes(id)) this.removePeer(id);
    for (const id of ids) {
      if (id !== this.room.sessionId && !this.peers.has(id)) this.addPeer(id);
    }
  }

  private removePeer(id: string) {
    const peer = this.peers.get(id)!;
    const now = this.audio!.currentTime;
    peer.outgoing.gain.cancelScheduledValues(now);
    peer.outgoing.gain.setValueAtTime(0,now);
    this.disguise?.output.disconnect(peer.outgoing);
    peer.outgoing.disconnect();
    for (const track of peer.destination.stream.getTracks()) track.stop();
    peer.connection.close();
    peer.playback?.disconnect();
    peer.meter?.source.disconnect();
    peer.meter?.analyser.disconnect();
    this.peers.delete(id);
  }

  private addPeer(id:string) {
    const connection = new RTCPeerConnection({iceServers:iceServers()});
    const audio = this.audio!;
    const outgoing = audio.createGain();
    outgoing.gain.value = 0;
    const destination = audio.createMediaStreamDestination();
    destination.channelCount = 1;
    this.disguise!.output.connect(outgoing).connect(destination);
    const peer: Peer = {connection, pending:Promise.resolve(), candidates:[],outgoing,destination};
    this.peers.set(id,peer);
    this.updateOutgoing(id,peer);
    for (const track of destination.stream.getAudioTracks()) connection.addTrack(track,destination.stream);
    connection.onicecandidate = ({candidate}) => {
      if (candidate) this.signal(id,peer,{candidate:candidate.toJSON()});
    };
    connection.ontrack = ({track,streams}) => {
      if (track.kind !== 'audio' || this.peers.get(id) !== peer || peer.playback) return;
      const stream = streams[0] ?? new MediaStream([track]);
      const audio = this.audio!;
      const playback = audio.createGain();
      playback.gain.value = this.volume(id);
      peer.playback = playback;
      peer.meter = this.meter(stream);
      peer.meter.source.connect(playback);
      playback.connect(audio.destination);
    };
    if (this.room.sessionId < id) {
      this.queue(peer,async () => {
        await connection.setLocalDescription(await connection.createOffer());
        this.sendDescription(id,peer);
      });
    }
  }

  private queue(peer: Peer, action: () => Promise<void>) {
    peer.pending = peer.pending.then(async () => {
      if (peer.connection.signalingState !== 'closed') await action();
    }).catch(error => console.warn('Falha na conexão de voz',error));
  }

  private signal(id: string, peer: Peer, signal: VoiceSignal) {
    if (this.peers.get(id) === peer) this.room.send('voice-signal',{to:id,signal});
  }

  private sendDescription(id: string, peer: Peer) {
    const {localDescription:d} = peer.connection;
    if (d && (d.type === 'offer' || d.type === 'answer')) {
      this.signal(id,peer,{description:{type:d.type,sdp:d.sdp}});
    }
  }

  private async receive(id: string, peer: Peer, signal: VoiceSignal) {
    const {connection,candidates} = peer;
    if ('candidate' in signal) {
      if (connection.remoteDescription) await connection.addIceCandidate(signal.candidate);
      else candidates.push(signal.candidate);
      return;
    }
    await connection.setRemoteDescription(signal.description);
    for (const candidate of candidates.splice(0)) await connection.addIceCandidate(candidate);
    if (signal.description.type === 'offer') {
      await connection.setLocalDescription(await connection.createAnswer());
      this.sendDescription(id,peer);
    }
  }

  private meter(stream: MediaStream): Meter {
    const audio = this.audio!;
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    return {source,analyser,buffer:new Float32Array(analyser.fftSize),lastSound:-Infinity};
  }

  private measure() {
    const now = performance.now();
    const speaking = new Set<string>();
    const sample = (id:string, meter?: Meter) => {
      if (!meter) return;
      meter.analyser.getFloatTimeDomainData(meter.buffer);
      const meanSquare = meter.buffer.reduce((sum,n) => sum+n*n,0)/meter.buffer.length;
      if (meanSquare > .0002) meter.lastSound = now;
      if (now-meter.lastSound<260) speaking.add(id);
    };
    if (!this.muted) sample(this.room.sessionId,this.localMeter);
    for (const [id,peer] of this.peers) if (this.volume(id)>0) sample(id,peer.meter);
    this.onSpeaking(speaking);
  }
}
