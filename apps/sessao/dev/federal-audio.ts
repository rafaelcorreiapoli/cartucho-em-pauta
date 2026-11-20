import type {Plugin} from 'vite';

// Mixkit permits incorporation in the game, but not redistribution of the samples
// as source assets. Vite emits them into the finished game and serves them in dev.
const samples = {
  'cassation-summons.mp3':'https://assets.mixkit.co/active_storage/sfx/677/677-preview.mp3',
  'federal-siren.mp3':'https://assets.mixkit.co/active_storage/sfx/1643/1643-preview.mp3',
  'federal-trombone.mp3':'https://assets.mixkit.co/active_storage/sfx/471/471-preview.mp3',
};

export function federalAudio():Plugin {
  let build=false;
  const downloads = new Map<string,Promise<Uint8Array>>();
  const download=(file:keyof typeof samples)=>{
    if (!downloads.has(file)) downloads.set(file,fetch(samples[file]).then(async response=>{
      if (!response.ok) throw new Error(`Falha ao carregar ${file}: ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    }));
    return downloads.get(file)!;
  };
  return {
    name:'federal-audio',
    configResolved(config) {build=config.command==='build';},
    async buildStart() {
      if (build) await Promise.all((Object.keys(samples) as (keyof typeof samples)[]).map(async file=>{
        this.emitFile({type:'asset',fileName:`assets/audio/${file}`,source:await download(file)});
      }));
    },
    configureServer(server) {
      for (const file of Object.keys(samples) as (keyof typeof samples)[]) {
        server.middlewares.use(`/assets/audio/${file}`,(_request,response,next)=>{
          download(file).then(bytes=>{
            response.setHeader('Content-Type','audio/mpeg');
            response.end(Buffer.from(bytes));
          }).catch(next);
        });
      }
    },
  };
}
