export function normalizeAudioFile(file, targetVolume) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const arrayBuffer = e.target.result;
            const audioContext = new AudioContext();
            try {
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                // 全チャンネルからピーク値（絶対値の最大値）を取得
                let peak = 0;
                for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                    const channelData = audioBuffer.getChannelData(i);
                    for (let j = 0; j < channelData.length; j++) {
                        const absVal = Math.abs(channelData[j]);
                        if (absVal > peak) {
                            peak = absVal;
                        }
                    }
                }
                if (peak === 0) {
                    reject('Audio is silent.');
                    return;
                }
                // 目標音量に合わせるためのゲインを計算
                const gain = targetVolume / peak;
                // 各チャンネルに対してゲインを適用（正規化）
                for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                    const channelData = audioBuffer.getChannelData(i);
                    for (let j = 0; j < channelData.length; j++) {
                        channelData[j] *= gain;
                    }
                }
                // 正規化済みAudioBufferをWAV形式のArrayBufferへ変換
                const wavBuffer = audioBufferToWav(audioBuffer);
                resolve(wavBuffer);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

/**
 * AudioBufferからWAVファイル形式のArrayBufferに変換する関数
 */
function audioBufferToWav(buffer, options) {
    options = options || {};
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    // ここでは16bit PCM形式として出力
    const bitDepth = 16;
    let samples;
    if (numChannels === 2) {
        samples = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        samples = buffer.getChannelData(0);
    }
    return encodeWAV(samples, numChannels, sampleRate, bitDepth);
}

/**
 * 2チャンネルの場合、左右のチャンネルデータをインターリーブします
 */
function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0,
        inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

/**
 * WAVファイルのバイナリデータ（ArrayBuffer）を生成する
 */
function encodeWAV(samples, numChannels, sampleRate, bitDepth) {
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    // RIFFヘッダ
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(view, 8, 'WAVE');
    // fmtチャンク
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    // dataチャンク
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * bytesPerSample, true);

    // サンプルデータの書き込み（16bit PCMの場合）
    floatTo16BitPCM(view, 44, samples);
    return buffer;
}

/**
 * DataViewに文字列を書き込み
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Float32Arrayのサンプルを16bit PCMに変換してDataViewに書き込み
 */
function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}