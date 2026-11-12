export type VoiceSignal = {
  description: { type: 'offer' | 'answer'; sdp: string };
} | {
  candidate: RTCIceCandidateInit;
};

export function readVoiceSignal(value: unknown): VoiceSignal | undefined {
  if (!value || typeof value !== 'object') return;
  if ('description' in value) {
    const d = value.description;
    if (d && typeof d === 'object' && 'type' in d && 'sdp' in d &&
      (d.type === 'offer' || d.type === 'answer') && typeof d.sdp === 'string' && d.sdp.length <= 12000) {
      return { description: { type:d.type, sdp:d.sdp } };
    }
  }
  if ('candidate' in value) {
    const c = value.candidate;
    if (c && typeof c === 'object' && 'candidate' in c && typeof c.candidate === 'string' &&
      c.candidate.length <= 1000 && 'sdpMLineIndex' in c && typeof c.sdpMLineIndex === 'number') {
      return { candidate: { candidate:c.candidate, sdpMLineIndex:c.sdpMLineIndex } };
    }
  }
}
