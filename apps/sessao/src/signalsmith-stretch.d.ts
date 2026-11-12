declare module 'signalsmith-stretch' {
  interface StretchNode extends AudioWorkletNode {
    schedule(options: {
      active: boolean;
      semitones: number;
      formantSemitones: number;
      formantCompensation: boolean;
      formantBaseHz: number;
    }): Promise<unknown>;
  }
  export default function createStretch(context: AudioContext, options: AudioWorkletNodeOptions): Promise<StretchNode>;
}
