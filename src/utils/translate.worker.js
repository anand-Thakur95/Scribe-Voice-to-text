/* eslint-disable no-restricted-globals */
import { Pipeline, env } from '@xenova/transformers';

env.useBrowserCache = false;

let translator = null;

async function loadModel() {
  if (!translator) {
    translator = await Pipeline.fromPretrained('Xenova/nllb-200-distilled-600M');
  }
}

self.addEventListener('message', async (event) => {
  const { text, src_lang, tgt_lang } = event.data;

  try {
    await loadModel();

    self.postMessage({ status: 'initiate' });

    const output = await translator(text.join(' '), {
      src_lang: src_lang,
      tgt_lang: tgt_lang,
    });

    self.postMessage({ status: 'update', results: output });

    self.postMessage({ status: 'complete' });
  } catch (error) {
    self.postMessage({ status: 'error', message: error.message });
  }
});
