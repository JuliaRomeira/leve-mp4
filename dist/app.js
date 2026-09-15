'use strict';
const $ = (id) => document.getElementById(id);
const preview = $('preview');
let file = null, sourceURL = '', resultURL = '', loading = false, busy = false, job = null, loadVersion = 0;
const supported = typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
const bytes = (n) => n < 1000000 ? `${(n / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 0})} KB` : `${(n / 1000000).toLocaleString('pt-BR', {maximumFractionDigits: 1})} MB`;
const duration = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
function notice(text = '') { $('message').textContent = text; $('message').hidden = !text; }
function updateControls() {
  $('compress').disabled = !file || loading || busy || !supported;
  $('settings').disabled = busy;
  $('replace').disabled = busy || loading;
  $('choose').disabled = busy || loading;
  $('hint').textContent = busy ? 'Compactação em andamento' : loading ? 'Lendo seu vídeo…' : !supported ? 'Compactação indisponível neste navegador' : file ? 'Tudo pronto. Pode compactar.' : 'Selecione um vídeo para começar';
}
function clearResult() {
  $('result').hidden = true;
  $('output-preview').pause();
  $('output-preview').removeAttribute('src');
  $('output-preview').load();
  if (resultURL) URL.revokeObjectURL(resultURL);
  resultURL = '';
}
function waitFor(element, event, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const done = () => { clean(); resolve(); };
    const fail = () => { clean(); reject(new Error('Este vídeo não pôde ser lido. Tente outro arquivo MP4, MOV ou WebM compatível com seu navegador.')); };
    const timer = setTimeout(fail, timeout);
    function clean() { clearTimeout(timer); element.removeEventListener(event, done); element.removeEventListener('error', fail); }
    element.addEventListener(event, done, {once:true}); element.addEventListener('error', fail, {once:true});
  });
}
async function selectFile(candidate) {
  if (!candidate || busy || loading) return;
  notice();
  if (!/\.(mp4|mov|webm)$/i.test(candidate.name)) { notice('Escolha um vídeo MP4, MOV ou WebM.'); return; }
  if (candidate.size > 500000000) { notice('Escolha um vídeo de até 500 MB para compactar neste dispositivo.'); return; }
  if (!candidate.size) { notice('O arquivo está vazio. Escolha outro vídeo.'); return; }
  const version = ++loadVersion;
  loading = true; file = null; clearResult(); updateControls();
  preview.pause(); if (sourceURL) URL.revokeObjectURL(sourceURL);
  sourceURL = URL.createObjectURL(candidate);
  try {
    const ready = waitFor(preview, 'loadeddata'); preview.src = sourceURL; preview.load(); await ready;
    if (version !== loadVersion) return;
    if (!Number.isFinite(preview.duration) || preview.duration <= 0 || !preview.videoWidth) throw new Error('Não foi possível identificar a duração e a imagem do vídeo. Tente outro arquivo.');
    file = candidate; $('filename').textContent = file.name;
    $('filemeta').textContent = `${bytes(file.size)} · ${duration(preview.duration)} · ${preview.videoWidth} × ${preview.videoHeight}`;
    $('dropzone').hidden = true; $('selected').hidden = false;
  } catch (error) {
    notice(error.message); $('dropzone').hidden = false; $('selected').hidden = true;
  } finally { loading = false; updateControls(); }
}
$('choose').onclick = $('replace').onclick = () => { $('file').value = ''; $('file').click(); };
$('file').onchange = (event) => selectFile(event.target.files[0]);
for (const name of ['dragenter','dragover']) $('dropzone').addEventListener(name, (e) => { e.preventDefault(); if (!busy) $('dropzone').classList.add('dragging'); });
for (const name of ['dragleave','drop']) $('dropzone').addEventListener(name, (e) => { e.preventDefault(); $('dropzone').classList.remove('dragging'); });
$('dropzone').addEventListener('drop', (e) => { if(e.dataTransfer.files.length > 1) notice('Selecione apenas um vídeo por vez.'); else selectFile(e.dataTransfer.files[0]); });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
function setProgress(value) { const p = Math.min(99, Math.max(0, Math.floor(value * 100))); $('progress').value = p; $('percent').textContent = `${p}%`; }
async function compress() {
  if (!file || busy || !supported) return;
  busy = true; clearResult(); notice(); updateControls();
  $('processing').hidden = false; setProgress(0);
  $('progress-title').textContent = 'Preparando seu vídeo…';
  $('cancel').disabled = false;
  preview.pause(); preview.controls = false;
  const current = {cancelled:false, conversion:null, input:null};
  job = current;
  try {
    const {Input, Output, BlobSource, ALL_FORMATS, BufferTarget, Mp4OutputFormat, Conversion, Quality} = await import('./mediabunny.js');
    if (current.cancelled) return;
    const input = new Input({source:new BlobSource(file),formats:ALL_FORMATS});
    current.input = input;
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!videoTrack) throw new Error('Nenhuma faixa de vídeo foi encontrada neste arquivo.');
    const limit = Number($('resolution').value);
    const ratio = limit ? Math.min(1, limit / Math.min(preview.videoWidth, preview.videoHeight)) : 1;
    const width = Math.max(2, Math.round(preview.videoWidth * ratio / 2) * 2);
    const height = Math.max(2, Math.round(preview.videoHeight * ratio / 2) * 2);
    const quality = document.querySelector('input[name="quality"]:checked').value;
    const keepAudio = $('audio').checked;
    const originalRate = file.size * 8 / preview.duration;
    const baseline = width * height * 30 * {small:.035,balanced:.065,high:.11}[quality];
    const cap = Math.max(80000, originalRate * {small:.35,balanced:.6,high:.85}[quality] - (keepAudio ? 128000 : 0));
    const bitrate = Math.round(Math.max(80000, Math.min(baseline, cap)));
    const target = new BufferTarget();
    const output = new Output({target, format:new Mp4OutputFormat({fastStart:'in-memory'})});
    const conversion = await Conversion.init({
      input,output,tracks:'primary',tags:{},
      video:{codec:'avc',width,height,fit:'contain',quality:new Quality({bitrate}),forceTranscode:true},
      audio:keepAudio ? {codec:'aac'} : {discard:true}
    });
    current.conversion = conversion;
    if (current.cancelled) { await conversion.cancel(); return; }
    if (!conversion.isValid || !conversion.utilizedTracks.includes(videoTrack)) {
      throw new Error('O navegador não consegue compactar este formato em H.264. Tente outro vídeo ou abra o app no Chrome, Edge ou Safari atualizado.');
    }
    if (keepAudio && audioTrack && !conversion.utilizedTracks.includes(audioTrack)) {
      throw new Error('O áudio deste arquivo não é compatível com a conversão neste navegador. Tente outro navegador ou desative “Manter áudio” para gerar um vídeo sem som.');
    }
    conversion.onProgress = setProgress;
    $('progress-title').textContent = 'Deixando seu vídeo mais leve…';
    await conversion.execute();
    if (current.cancelled) return;
    const blob = new Blob([target.buffer], {type:'video/mp4'});
    if (blob.size < 100) throw new Error('O vídeo final ficou vazio. Tente outro arquivo ou navegador.');
    const signature = new TextDecoder().decode(await blob.slice(4,8).arrayBuffer());
    if (signature !== 'ftyp') throw new Error('Não foi possível gerar um MP4 válido. Tente outro arquivo.');
    resultURL = URL.createObjectURL(blob);
    $('download').href = resultURL; $('download').download = `${file.name.replace(/\.[^.]+$/, '')}-leve.mp4`;
    $('original-size').textContent = bytes(file.size); $('final-size').textContent = bytes(blob.size);
    const saved = Math.round((1 - blob.size / file.size) * 100);
    $('saving').textContent = saved > 0 ? `${saved}% menor` : 'MP4 gerado';
    $('result-title').textContent = saved > 0 ? 'Um vídeo mais leve.' : 'Seu MP4 está pronto.';
    $('result-note').textContent = saved > 0 ? `Você economizou ${bytes(file.size - blob.size)}. Confira a prévia antes de baixar.` : 'Este vídeo já estava otimizado. O arquivo final não ficou menor; experimente “Menor arquivo” e uma resolução mais baixa.';
    $('output-preview').src = resultURL; $('result').hidden = false;
    $('result').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch (error) {
    if (!current.cancelled) notice(error.message || 'Não foi possível compactar. Tente outro vídeo ou uma resolução menor.');
  } finally {
    if (current.conversion && !['done','canceled'].includes(current.conversion.state)) await current.conversion.cancel().catch(()=>{});
    current.input?.dispose();
    preview.controls = true;
    job = null; busy = false; $('processing').hidden = true; updateControls();
  }
}
$('compress').onclick = compress;
$('cancel').onclick = async () => {
  if (!job) return;
  job.cancelled = true; $('cancel').disabled = true;
  if (job.conversion) await job.conversion.cancel().catch(()=>{});
  notice('Compactação cancelada. Você pode ajustar as opções e tentar novamente.');
};
window.addEventListener('beforeunload', e => { if (busy) { e.preventDefault(); e.returnValue = ''; } });
if (!supported) notice('Este navegador não oferece os recursos necessários para compactar vídeos. Abra o app no Chrome, Edge ou Safari atualizado. A compatibilidade depende do dispositivo e do formato do vídeo.');
updateControls();
