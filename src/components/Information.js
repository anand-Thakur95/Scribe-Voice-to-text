import React, { useState, useEffect, useRef } from 'react';
import Transcription from './Transcription';
import Translation from './Translation';

function Information(props) {
  const { output } = props;
  const [tab, setTab] = useState('transcription');
  const [translation, setTranslation] = useState(null);
  const [translating, setTranslating] = useState(null);
  const [toLanguage, setToLanguage] = useState('Select language');
  console.log(output);

  const worker = useRef();

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('../utils/translate.worker.js', import.meta.url), {
        type: 'module',
      });
    }
    const onMessageReceived = async (e) => {
      switch (e.data.status) {
        case 'initiate':
          console.log('DOWNLOADING');
          break;
        case 'progress':
          console.log('LOADING');
          break;
        case 'update':
          setTranslation(e.data.results);
          console.log(e.data.results);
          break;
        case 'complete':
          setTranslating(false);
          console.log('DONE');
          break;
        default:
      }
    };

    worker.current.addEventListener('message', onMessageReceived);

    return () => worker.current.removeEventListener('message', onMessageReceived);
  }, []);

  function handleCopy() {
    const text = Array.isArray(textElement) ? textElement.join(' ') : textElement;
    navigator.clipboard.writeText(text);
  }

  function handleDownload() {
    const text = Array.isArray(textElement) ? textElement.join('\n') : textElement;
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Freescribe_${new Date().toDateString()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  function generateTranslation() {
    if (translating || toLanguage === 'Select language') {
      return;
    }

    setTranslating(true);

    worker.current.postMessage({
      text: output.map((val) => val.text),
      src_lang: 'eng_Latn',
      tgt_lang: toLanguage,
    });
  }

  const textElement = tab === 'transcription' ? output.map((val) => val.text) : 'Transcription' || 'No translation';

  return (
    <main className="flex-1 p-4 flex flex-col gap-3 sm:gap-4 text-center justify-center pb-20 max-w-prose w-full mx-auto">
      <h1 className="font-semibold text-4xl sm:text-5xl md:text-6xl whitespace-nowrap">
        Your <span className="text-blue-400 bold">Transcription</span>
      </h1>

      <div className="grid grid-cols-2 mx-auto bg-white shadow rounded-full overflow-hidden items-center">
        <button
          onClick={() => setTab('transcription')}
          className={
            'px-4 duration-200 py-1  ' +
            (tab === 'transcription' ? ' bg-blue-400 text-white' : ' text-blue-300 hover:text-blue-400')
          }
        >
          Transcription
        </button>

        <button
          onClick={() => setTab('translation')}
          className={
            'px-4 duration-200 py-1 ' +
            (tab === 'translation' ? ' bg-blue-400 text-white' : ' text-blue-300 hover:text-blue-400')
          }
        >
          Translation
        </button>
      </div>

      <div className="my-8 flex flex-col">
        {tab === 'transcription' ? (
          <Transcription {...props} textElement={textElement} />
        ) : (
          <Translation
            {...props}
            toLanguage={toLanguage}
            translating={translating}
            textElement={textElement}
            setTranslating={setTranslating}
            setTranslation={setTranslation}
            setToLanguage={setToLanguage}
            generateTranslation={generateTranslation}
          />
        )}
      </div>

      <div className="flex items-center gap-4 mx-auto">
        <button
          title="Copy"
          onClick={handleCopy}
          className="bg-white hover:text-blue-500 duration-200 text-blue-300 px-2 aspect-square grid place-items-center rounded"
        >
          <i className="fa-solid fa-copy"></i>
        </button>

        <button
          title="Download"
          onClick={handleDownload}
          className="bg-white hover:text-blue-500 duration-200 text-blue-300 px-2 aspect-square grid place-items-center rounded"
        >
          <i className="fa-solid fa-download"></i>
        </button>
      </div>
    </main>
  );
}

export default Information;
