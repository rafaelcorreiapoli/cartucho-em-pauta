export type Disguise = { pitch:number; style:'preserved'|'shifted'|'radio' };

export const voiceModulatorDisguise:Disguise = {pitch:-6,style:'radio'};

export class LiveDisguise {
  private input: MediaStreamAudioSourceNode;
  readonly output: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private radio: GainNode;
  private processor?: ReturnType<typeof this.createProcessor>;
  private revision = 0;

  constructor(private context: AudioContext, mic: MediaStream) {
    this.input = context.createMediaStreamSource(mic);
    this.output = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    this.radio = context.createGain();
    this.wet.gain.value = this.radio.gain.value = 0;
    this.input.connect(this.dry).connect(this.output);
    this.wet.connect(this.output);
    const high = new BiquadFilterNode(context,{type:'highpass',frequency:400});
    const low = new BiquadFilterNode(context,{type:'lowpass',frequency:2900});
    const compression = new DynamicsCompressorNode(context,{threshold:-18,ratio:4});
    this.radio.connect(high).connect(low).connect(compression).connect(this.output);
  }

  private async createProcessor() {
    const { default:createStretch } = await import('signalsmith-stretch');
    const stretch = await createStretch(this.context,{
      numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,
    });
    this.input.connect(stretch);
    stretch.connect(this.wet);
    stretch.connect(this.radio);
    return stretch;
  }

  async setEffect(effect?: Disguise) {
    const revision = ++this.revision;
    this.dry.gain.value = effect ? 0 : 1;
    if (!effect) {
      this.wet.gain.value = this.radio.gain.value = 0;
      return;
    }
    try {
      this.processor ??= this.createProcessor();
      const stretch = await this.processor;
      if (revision!==this.revision) return;
      await stretch.schedule({
        active:true, semitones:effect.pitch, formantSemitones:0,
        formantCompensation:effect.style==='preserved', formantBaseHz:0,
      });
      if (revision===this.revision) {
        this.wet.gain.value = effect.style==='radio' ? 0 : 1;
        this.radio.gain.value = effect.style==='radio' ? 1 : 0;
      }
    } catch (error) {
      this.processor = undefined;
      if (revision===this.revision) throw error;
    }
  }

  stop() {
    ++this.revision;
    this.output.disconnect();
  }
}
