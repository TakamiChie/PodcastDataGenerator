import { normalizeAudioFile } from './filters/normalizeAudioFile.js';

const audioFile = document.getElementById('audioFile');
const audioCanvas = document.getElementById('audioCanvas');
const audioContext = new AudioContext();
const canvasContext = audioCanvas.getContext('2d');
const downloadButton = document.getElementById('download');
const gainInput = document.getElementById('gain');

audioFile.addEventListener('change', (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    audioContext.decodeAudioData(e.target.result).then((buffer) => {
      const channelData = buffer.getChannelData(0);
      const dataLength = channelData.length;
      const canvasWidth = audioCanvas.width;
      const canvasHeight = audioCanvas.height;
      const step = Math.ceil(dataLength / canvasWidth);
      const amp = canvasHeight / 2;

      canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
      canvasContext.beginPath();
      canvasContext.moveTo(0, canvasHeight / 2);

      for (let i = 0; i < canvasWidth; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += Math.abs(channelData[i * step + j]);
        }
        const average = sum / step;
        const y = amp - average * amp * 4;
        canvasContext.lineTo(i, y);
      }

      canvasContext.strokeStyle = 'blue';
      canvasContext.stroke();
      downloadButton.disabled = false;
    });
  };
  reader.readAsArrayBuffer(file);
});

gainInput.addEventListener('input', () => {
  const gainValue = document.getElementById('gainValue');
  gainValue.textContent = gainInput.value;
});

gainInput.dispatchEvent(new Event('input'));

downloadButton.addEventListener('click', async () => {
  const file = audioFile.files[0];
  if (!file) {
    alert('先に音声ファイルをアップロードしてください');
    return;
  }
  const wav = await normalizeAudioFile(file, gainInput.value);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modified_audio.wav';
  a.click();
  URL.revokeObjectURL(url);
});