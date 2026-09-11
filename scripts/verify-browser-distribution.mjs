import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {JSDOM} from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="editor"></div></body></html>', {
  pretendToBeVisual: true,
  runScripts: 'outside-only',
  url: 'http://localhost/',
})
const {window} = dom
const nodeWebGlobals = Object.fromEntries([
  'fetch',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'Blob',
  'ReadableStream',
  'TextEncoder',
  'TextDecoder',
].map((key) => [key, globalThis[key]]))

for (const key of [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'Element',
  'HTMLElement',
  'HTMLAudioElement',
  'HTMLCanvasElement',
  'HTMLImageElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'HTMLVideoElement',
  'DocumentFragment',
  'DOMParser',
  'MutationObserver',
  'Range',
  'Selection',
  'Event',
  'EventTarget',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'File',
  'FileReader',
  'AbortController',
  'AbortSignal',
]) {
  Object.defineProperty(globalThis, key, {configurable: true, value: window[key]})
}

Object.defineProperty(globalThis, 'getComputedStyle', {
  configurable: true,
  value: window.getComputedStyle.bind(window),
})
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  configurable: true,
  value: window.requestAnimationFrame.bind(window),
})
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  configurable: true,
  value: window.cancelAnimationFrame.bind(window),
})
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return false },
})
window.HTMLElement.prototype.scrollIntoView = () => undefined
window.HTMLCanvasElement.prototype.getContext = () => null
for (const [key, value] of Object.entries(nodeWebGlobals)) {
  Object.defineProperty(window, key, {configurable: true, value})
}

const browserPackage = await import('../dist/browser.js')
assert.equal(typeof browserPackage.AiEditor, 'function', 'Browser ESM export is missing')
const editor = new browserPackage.AiEditor({
  element: '#editor',
  aiChat: false,
  content: '<p>Browser distribution smoke test</p>',
})
assert.equal(editor.getText(), 'Browser distribution smoke test')
editor.destroy()

const umdBundle = await readFile(new URL('../dist/aieditor.umd.js', import.meta.url), 'utf8')
window.eval(umdBundle)
assert.equal(typeof window.AiEditor, 'function', 'UMD constructor global is missing')
assert.equal(typeof window.AiEditor.Uploader, 'function', 'UMD public API properties are missing')

dom.window.close()
console.log('Verified Browser ESM initialization and UMD globals')
