/* global globalThis */
import { pipeline, env } from "@xenova/transformers";
import { MessageTypes } from "./presets";

env.allowLocalModels = false;
env.useBrowserCache = false;


let output_token_ids;


class MyTranscriptionpipeline {
    static task = 'automatic-speech-recognition';
    static model = 'openai/whisper-tiny.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, null, {
                progress_callback 
            });
        }
        return this.instance;
    }
}

// In a worker, we use `self` to refer to the worker context.
globalThis.addEventListener('message', async (event) => {
    const { type, audio } = event.data;
    if (type === MessageTypes.INFERENCE_REQUEST) {
        await transcribe(audio);
    }
});

async function transcribe(audio) {
    sendLoadingMessage('loading');

    let pipeline;

    try {
        pipeline = await MyTranscriptionpipeline.getInstance(load_model_callback);
    } catch (err) {
        console.log(err.message);
        return;
    }

    sendLoadingMessage('success');

    const stride_length_s = 5

    const generationTracker = new GenerationTracker(pipeline, stride_length_s);
    await pipeline(audio, {
        top_k: 0,
        do_sample: false,
        chunk_length: 30,
        stride_length_s,
        return_timestamps: true,
        callback_function: generationTracker.callbackFunction.bind(generationTracker),
        chunk_callback: generationTracker.chunkCallback.bind(generationTracker)
    });

    generationTracker.sendFinalResult();
}

async function load_model_callback(data) {
    const { status } = data;

    if (status === 'progress') {
        const { file, progress, loaded, total } = data;
        sendDownloadingMessage(file, progress, loaded, total);
    }
}

function sendLoadingMessage(status) {
    globalThis.postMessage({
        type: MessageTypes.LOADING,
        status
    });
}

async function sendDownloadingMessage(file, progress, loaded, total) {
    globalThis.postMessage({
        type: MessageTypes.DOWNLOADING,
        file,
        progress,
        loaded,
        total
    });
}

class GenerationTracker {
    constructor(pipeline, stride_length_s) {
        this.pipeline = pipeline;
        this.stride_length_s = stride_length_s;
        this.chunks = [];
        this.time_precision = pipeline?.processor.feature_extractor.config.chunk_length / pipeline.model.config.max_source_positions;
        this.processed_chunks = [];
        this.callbackFunctionCounter = 0;
    }

    sendFinalResult() {
        globalThis.postMessage({ type: MessageTypes.INFERENCE_DONE });
    }

    callbackFunction(beams) {
        this.callbackFunctionCounter += 1;
        if (this.callbackFunctionCounter % 10 !== 0) {
            return;
        }
        const bestBeams = beams[0];
    
        console.log('bestBeams:', bestBeams);
        if (!Array.isArray(bestBeams) || bestBeams.length === 0 || !bestBeams.every(Number.isInteger)) {
            console.error('bestBeams is not a valid array of integers');
            return;
        }
    
        let text = this.pipeline.tokenizer.decode(bestBeams, {
            skip_special_tokens: true,
        });
    
        const result = {
            text,
            start: this.getLastChunkTimestamp(),
            end: undefined
        };
    
        createPartialResultMessage(result);
    }

    chunkCallback(data) {
        this.chunks.push(data);
        const [text, { chunks }] = this.pipeline.tokenizer._decode_asr(
            this.chunks,
            {
                time_precision: this.time_precision,
                return_timestamps: true,
                force_full_sequence: false
            }
        );
        this.processed_chunks = chunks.map((chunk, index) => {
            return this.processChunk(chunk, index);
        });

        createResultMessage(
            this.processed_chunks, false, this.getLastChunkTimestamp()
        );
    }

    getLastChunkTimestamp() {
        if (this.processed_chunks.length === 0) {
            return 0;
        }
        // Add the following line to return the end timestamp of the last chunk
        return this.processed_chunks[this.processed_chunks.length - 1].end;
    }
        

    processChunk(chunk, index) {
        const { text, timestamp } = chunk;
        const [start, end] = timestamp;

        return {
            index,
            text: `${text.trim()}`,
            start: Math.round(start),
            end: Math.round(end) || Math.round(start + 0.9 * this.stride_length_s)
        };
    }
}

function createResultMessage(results, isDone, completedUntilTimestramp) {
    globalThis.postMessage({
        type: MessageTypes.RESULT,
        results,
        isDone,
        completedUntilTimestramp
    });
}

function createPartialResultMessage(result) {
    globalThis.postMessage({
        type: MessageTypes.RESULT_PARTIAL,
        result
    });
}
