# Generates the listening MP3s (natural neural voices, slower at the start, normal later). Usage: python3 tools/gen_audio.py [only-substring]
import asyncio, json, subprocess, sys, wave, os, tempfile, edge_tts
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = ['en-GB-LibbyNeural','en-GB-SoniaNeural','en-US-JennyNeural','en-GB-MaisieNeural']
M = ['en-GB-RyanNeural','en-GB-ThomasNeural','en-US-GuyNeural']
ANN = 'en-US-AriaNeural'
RATE = {1:'-22%',2:'-22%',3:'-15%',4:'-15%',5:'-10%',6:'-10%',7:'-5%',8:'-5%'}
NUM = ['','One','Two','Three','Four','Five','Six','Seven','Eight']
SR = 24000
data = json.loads(subprocess.check_output(['node', os.path.join(ROOT,'tools/dump_audio.mjs')], cwd=ROOT))
tmp = tempfile.mkdtemp()
cnt = 0
async def tts(text, voice, rate):
    global cnt; cnt += 1; p = f'{tmp}/{cnt}'
    for attempt in range(6):
        try: await edge_tts.Communicate(text, voice, rate=rate).save(p+'.mp3'); break
        except Exception as e:
            if attempt == 5: raise
            await asyncio.sleep(2 + attempt*2)
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',p+'.mp3','-ar',str(SR),'-ac','1',p+'.wav'], check=True)
    with wave.open(p+'.wav') as w: return w.readframes(w.getnframes())
sil = lambda s: b'\x00\x00' * int(SR*s)
async def build(sec):
    w = sec['week']; rate = RATE[w]; spk = sec['speakers']
    plan = []  # (kind, ...)
    async def block_audio(b, bi):
        voices = {}; fi = bi; mi = bi
        for who, _ in b['lines']:
            if who not in voices:
                if spk.get(who,'F') == 'F': voices[who] = F[fi % len(F)]; fi += 1
                else: voices[who] = M[mi % len(M)]; mi += 1
        parts = []
        for who, text in b['lines']:
            parts.append(await tts(text, voices[who], rate)); parts.append(sil(0.45))
        return b''.join(parts)
    blocks = [await block_audio(b, i) for i, b in enumerate(sec['script'])]
    many = len(sec['script']) > 1
    async def one_pass(label_first=False):
        out = []
        for i, b in enumerate(blocks):
            if many: out.append(await tts(f'Number {NUM[i+1].lower()}.', ANN, '-5%')); out.append(sil(0.5))
            out.append(b); out.append(sil(2.0 if many else 0.8))
        return b''.join(out)
    intro = await tts('Listen.' if not many else 'Listen to the conversations.', ANN, '-5%')
    again = await tts('Now listen again.', ANN, '-5%')
    p1 = await one_pass(); 
    audio = intro + sil(0.8) + p1 + sil(1.5) + again + sil(1.0) + p1 + sil(0.5) + await tts('That is the end of the recording.', ANN, '-5%')
    wavp = f'{tmp}/out_{os.path.basename(sec["audio"])}.wav'
    with wave.open(wavp,'wb') as o: o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes(audio)
    dest = os.path.join(ROOT, sec['audio']); os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',wavp,'-ac','1','-b:a','32k',dest], check=True)
    print(sec['audio'], round(len(audio)/2/SR), 's', os.path.getsize(dest)//1024, 'KB', flush=True)
async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    todo = [s for s in data if only in s['audio'] and (only or not os.path.exists(os.path.join(ROOT, s['audio'])))]
    sem = asyncio.Semaphore(2)
    async def run(s):
        async with sem: await build(s)
    await asyncio.gather(*[run(s) for s in todo])
asyncio.run(main())
