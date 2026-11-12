import type { Room } from '@colyseus/sdk';
import type { VoiceSignal } from './voice-protocol';

type Meter = { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; buffer: Float32Array<ArrayBuffer>; lastSound: number };
type Peer = {
  connection: RTCPeerConnection;
  pending: Promise<void>;
  candidates: RTCIceCandidateInit[];
  meter?: Meter;
  playback?: HTMLAudioElement;
};

function iceServers(): RTCIceServer[] {
  const configured = import.meta.env.VITE_VOICE_ICE_SERVERS;
  return configured ? JSON.parse(configured) : [{urls:'stun:stun.l.google.com:19302'}];
}

export class RoomVoice {
  private audio?: AudioContext;
  private mic?: MediaStream;
  private localMeter?: Meter;
  private peers = new Map<string,Peer>();
  private timer?: number;
  private generation = 0;

  constructor(private room: Room, private onSpeaking: (ids: Set<string>) => void,
    private onConnections: (connected: number, peers: number) => void) {
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
      this.localMeter = this.meter(mic);
      this.timer = window.setInterval(() => this.measure(),80);
      this.room.send('voice-join');
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop(false);
      throw error;
    }
  }

  toggleMute() {
    const enabled = this.muted;
    this.mic?.getAudioTracks().forEach(track => { track.enabled = enabled; });
    for (const peer of this.peers.values()) void peer.playback?.play().catch(() => {});
    this.measure();
  }

  stop(notify = true) {
    ++this.generation;
    if (notify && this.mic) this.room.send('voice-leave');
    window.clearInterval(this.timer);
    for (const id of this.peers.keys()) this.removePeer(id);
    this.mic?.getTracks().forEach(track => track.stop());
    this.mic = undefined;
    this.localMeter = undefined;
    if (this.audio) void this.audio.close().catch(() => {});
    this.audio = undefined;
    this.onSpeaking(new Set());
  }

  private syncPeers(ids: string[]) {
    if (!this.mic || !ids.includes(this.room.sessionId)) return;
    for (const id of this.peers.keys()) if (!ids.includes(id)) this.removePeer(id);
    for (const id of ids) {
      if (id !== this.room.sessionId && !this.peers.has(id)) this.addPeer(id,this.mic);
    }
    this.report();
  }

  private report() {
    const connected = [...this.peers.values()].filter(peer => peer.connection.connectionState === 'connected').length;
    this.onConnections(connected,this.peers.size);
  }

  private removePeer(id: string) {
    const peer = this.peers.get(id)!;
    peer.connection.onconnectionstatechange = null;
    peer.connection.close();
    if (peer.playback) {
      peer.playback.pause();
      peer.playback.srcObject = null;
    }
    peer.meter?.source.disconnect();
    peer.meter?.analyser.disconnect();
    this.peers.delete(id);
  }

  private addPeer(id: string, mic: MediaStream) {
    const connection = new RTCPeerConnection({iceServers:iceServers()});
    const peer: Peer = {connection, pending:Promise.resolve(), candidates:[]};
    this.peers.set(id,peer);
    for (const track of mic.getAudioTracks()) connection.addTrack(track,mic);
    connection.onicecandidate = ({candidate}) => {
      if (candidate) this.signal(id,peer,{candidate:candidate.toJSON()});
    };
    connection.onconnectionstatechange = () => this.report();
    connection.ontrack = ({track,streams}) => {
      if (track.kind !== 'audio' || this.peers.get(id) !== peer || peer.playback) return;
      const stream = streams[0] ?? new MediaStream([track]);
      const playback = new Audio();
      playback.srcObject = stream;
      peer.playback = playback;
      peer.meter = this.meter(stream);
      void playback.play().catch(() => {});
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
    for (const [id,peer] of this.peers) sample(id,peer.meter);
    this.onSpeaking(speaking);
  }
}
