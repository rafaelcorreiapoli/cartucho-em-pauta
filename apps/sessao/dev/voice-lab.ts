import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';

const run = promisify(execFile);
const limit = 512 * 1024;
const models = {
  lula: ['Lula.pth', 'added_IVF502_Flat_nprobe_1_Lula_v2.index'],
  bolsonaro: ['Bolsonaro.pth', 'added_IVF354_Flat_nprobe_1_Bolsonaro_v2.index'],
} as const;

export function voiceLab(directory: string): Plugin {
  const lab = resolve(directory);
  const engine = join(lab,'rvc-mlx-realtime');
  let busy = false;

  return {
    name:'sessao-voice-lab',
    apply:'serve',
    configureServer(server) {
      server.middlewares.use('/__voice-lab',async (req,res) => {
        const reply = (status: number, message = '') => {
          res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}).end(message);
        };
        const local = ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
        const host = req.headers.host ?? '';
        const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
        if (!local || !localHost || (req.headers.origin && req.headers.origin!==`http://${host}`)) {
          return reply(403);
        }
        if (req.method==='GET' && req.url==='/') return reply(204);
        if (req.method!=='POST') return reply(405);
        const voice = (req.url ?? '').slice(1);
        if (!Object.hasOwn(models,voice)) return reply(404);
        if (busy) return reply(409,'Já tem uma conversão em andamento. Tente novamente.');
        if (Number(req.headers['content-length'])>limit) return reply(413,'A gravação é grande demais.');

        busy = true;
        let temporary: string | undefined;
        try {
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes>limit) {
              reply(413,'A gravação é grande demais.');
              return;
            }
            chunks.push(chunk);
          }
          if (!bytes) return reply(400,'Grave uma frase antes de converter.');
          temporary = await mkdtemp(join(tmpdir(),'sessao-voice-'));
          const recording = join(temporary,'recording');
          const input = join(temporary,'input.wav');
          const output = join(temporary,'output.wav');
          const [model,index] = models[voice as keyof typeof models];
          await writeFile(recording,Buffer.concat(chunks));
          await run('ffmpeg',['-nostdin','-v','error','-i',recording,'-t','10','-ac','1','-ar','16000',input],{timeout:10000});
          await run(join(engine,'.venv/bin/python'),[
            '-m','rvc_mlx_rt.cli','convert','--model',join(lab,'models',model),
            '--index',join(lab,'models',index),'--index-rate','0.35','--input',input,'--output',output,
          ],{cwd:engine,env:{...process.env,TORCH_FORCE_WEIGHTS_ONLY_LOAD:'1'},timeout:45000});
          const converted = await readFile(output);
          res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store'}).end(converted);
        } catch (error) {
          server.config.logger.error(`Teste de voz: ${error}`);
          if (!res.headersSent) reply(500,'Não foi possível converter a gravação.');
        } finally {
          busy = false;
          if (temporary) await rm(temporary,{recursive:true,force:true});
        }
      });
    },
  };
}
