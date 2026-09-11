import assert from 'node:assert/strict'
import {accessSync, createReadStream, statSync} from 'node:fs'
import {createServer} from 'node:http'
import {dirname, extname, join, normalize, sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const verifyCdn = process.argv.includes('--cdn')
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

const selfHostedPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="/node_modules/layui/dist/css/layui.css">
  <link rel="stylesheet" href="/dist/style.css">
</head>
<body>
  <div id="editor"></div>
  <span id="font-probe" style="font-family: KaTeX_Main">Math</span>
  <p id="load-status" data-state="loading">Loading</p>
  <button id="read-content" disabled>Read</button>
  <button id="destroy-editor" disabled>Destroy</button>
  <button id="create-editor" disabled>Create</button>
  <textarea id="content-output" readonly></textarea>
  <script src="/node_modules/layui/dist/layui.js"></script>
  <script src="/node_modules/requirejs/require.js"></script>
  <script>
    define('legacy-page', [], function () {
      return {name: 'RequireJS legacy page'}
    })
    requirejs(['legacy-page'], function (legacyPage) {
      void initialize(legacyPage)
    }, showError)

    async function initialize(legacyPage) {
      try {
        window.testStep = 'before-import'
        const {AiEditor} = await import('/dist/browser.js')
        window.testStep = 'after-import'
        const status = document.querySelector('#load-status')
        const readButton = document.querySelector('#read-content')
        const destroyButton = document.querySelector('#destroy-editor')
        const createButton = document.querySelector('#create-editor')
        const output = document.querySelector('#content-output')
        let editor

        function createEditor() {
          editor = new AiEditor({
            element: '#editor',
            locale: 'zh-CN',
            content: '<h2>' + legacyPage.name + '</h2><p>Self-hosted Browser ESM</p>',
            aiChat: false,
            uploader: {
              async upload(file, {onProgress}) {
                onProgress(100)
                return {url: URL.createObjectURL(file)}
              },
            },
          })
          readButton.disabled = false
          destroyButton.disabled = false
          createButton.disabled = true
          status.dataset.state = 'ready'
          status.textContent = 'Ready'
        }
        function destroyEditor() {
          editor?.destroy()
          editor = undefined
          readButton.disabled = true
          destroyButton.disabled = true
          createButton.disabled = false
          status.dataset.state = 'destroyed'
          status.textContent = 'Destroyed'
        }
        readButton.addEventListener('click', () => {
          output.value = editor?.getHTML() ?? ''
        })
        destroyButton.addEventListener('click', destroyEditor)
        createButton.addEventListener('click', createEditor)
        createEditor()
      } catch (error) {
        const status = document.querySelector('#load-status')
        status.dataset.state = 'error'
        status.textContent = error instanceof Error ? error.message : String(error)
        console.error(error)
      }
    }

    function showError(error) {
      const status = document.querySelector('#load-status')
      status.dataset.state = 'error'
      status.textContent = error instanceof Error ? error.message : String(error)
      console.error(error)
    }
  </script>
</body>
</html>`

const umdPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="/dist/style.css">
</head>
<body>
  <div id="editor"></div>
  <p id="load-status" data-state="loading">Loading</p>
  <script src="/node_modules/requirejs/require.js"></script>
  <script>
    requirejs.config({paths: {aieditor: '/dist/aieditor.umd'}})
    requirejs(['aieditor'], function (AiEditor) {
      try {
        const EditorConstructor = AiEditor.default ?? AiEditor
        const editor = new EditorConstructor({
          element: '#editor',
          content: '<p>RequireJS loaded UMD</p>',
          aiChat: false,
        })
        window.testEditor = editor
        const status = document.querySelector('#load-status')
        status.dataset.state = 'ready'
        status.textContent = 'Ready'
      } catch (error) {
        const status = document.querySelector('#load-status')
        status.dataset.state = 'error'
        status.textContent = error instanceof Error ? error.message : String(error)
        console.error(error)
      }
    })
  </script>
</body>
</html>`

function resolveStaticPath(pathname) {
  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '')
  const absolutePath = join(projectRoot, relativePath)
  assert(absolutePath === projectRoot || absolutePath.startsWith(`${projectRoot}${sep}`))
  return absolutePath
}

const server = createServer((request, response) => {
  const {pathname} = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (pathname === '/self-hosted.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'})
    response.end(selfHostedPage)
    return
  }
  if (pathname === '/umd.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'})
    response.end(umdPage)
    return
  }
  if (pathname === '/favicon.ico') {
    response.writeHead(204)
    response.end()
    return
  }
  try {
    const path = resolveStaticPath(pathname)
    if (!statSync(path).isFile()) throw new Error('Not a file')
    response.writeHead(200, {'content-type': mimeTypes.get(extname(path)) ?? 'application/octet-stream'})
    createReadStream(path).pipe(response)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

async function launchBrowser() {
  const configuredChrome = process.env.AIEDITOR_CHROMIUM_PATH
  const systemChrome = configuredChrome
    ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined)
  if (systemChrome) {
    try {
      accessSync(systemChrome)
      return await chromium.launch({executablePath: systemChrome, headless: true})
    } catch {
      // Fall through to Playwright's managed Chromium installation.
    }
  }
  try {
    return await chromium.launch({headless: true})
  } catch (error) {
    throw new Error(
      'Chromium is unavailable. Run `npx playwright install chromium` or set AIEDITOR_CHROMIUM_PATH.',
      {cause: error},
    )
  }
}

async function verifyEditorLifecycle(page, expectedText) {
  try {
    await page.locator('#load-status:not([data-state="loading"])').waitFor({timeout: verifyCdn ? 60_000 : 15_000})
    assert.equal(await page.locator('#load-status').getAttribute('data-state'), 'ready')
  } catch (error) {
    const status = await page.locator('#load-status').evaluate((element) => ({
      state: element.dataset.state,
      text: element.textContent,
    })).catch(() => ({state: 'missing', text: 'Missing status element'}))
    const diagnostics = await page.evaluate(() => ({
      define: typeof window.define,
      layui: typeof window.layui,
      requirejs: typeof window.requirejs,
      legacyPageDefined: window.requirejs?.defined?.('legacy-page'),
      step: window.testStep,
      resources: performance.getEntriesByType('resource').map((entry) => entry.name),
      scripts: [...document.scripts].map((script) => script.src || 'inline'),
    }))
    throw new Error(
      `Editor did not become ready: ${JSON.stringify(status)}; ${JSON.stringify(diagnostics)}`,
      {cause: error},
    )
  }
  assert.equal(await page.locator('.aieditor').count(), 1)
  assert.equal(await page.evaluate(() => typeof requirejs), 'function')
  assert.equal(await page.evaluate(() => typeof layui), 'object')

  await page.locator('#read-content').click()
  await page.locator('#content-output').waitFor()
  assert.match(await page.locator('#content-output').inputValue(), new RegExp(expectedText))

  await page.locator('#destroy-editor').click()
  await page.locator('#create-editor:not([disabled])').waitFor()
  assert.equal(await page.locator('.aieditor').count(), 0)

  await page.locator('#create-editor').click()
  await page.locator('.aieditor').waitFor()
  assert.equal(await page.locator('.aieditor').count(), 1)
}

let browser
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object')
  const baseUrl = `http://127.0.0.1:${address.port}`
  browser = await launchBrowser()
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []
  const fontResponses = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('requestfailed', (request) => errors.push(`request: ${request.url()} (${request.failure()?.errorText})`))
  page.on('response', (response) => {
    if (!response.ok()) errors.push(`response: ${response.status()} ${response.url()}`)
    if (/\/assets\/.*\.woff2(?:$|\?)/.test(response.url())) fontResponses.push(response.url())
  })

  try {
    if (verifyCdn) {
      await page.goto(`${baseUrl}/examples/layui-esm/index.html`, {waitUntil: 'networkidle', timeout: 120_000})
      await verifyEditorLifecycle(page, 'RequireJS legacy page')
    } else {
      await page.goto(`${baseUrl}/self-hosted.html`, {waitUntil: 'networkidle', timeout: 60_000})
      await verifyEditorLifecycle(page, 'Self-hosted Browser ESM')
      await page.evaluate(() => document.fonts.load('16px KaTeX_Main', 'Math'))
      assert(fontResponses.some((url) => url.includes('/dist/assets/')), 'KaTeX font was not loaded from dist/assets')

      await page.goto(`${baseUrl}/umd.html`, {waitUntil: 'networkidle', timeout: 60_000})
      await page.locator('#load-status[data-state="ready"]').waitFor({timeout: 60_000})
      assert.equal(await page.locator('.aieditor').count(), 1)
      assert.equal(await page.evaluate(() => typeof window.testEditor?.getHTML), 'function')
      assert.match(await page.evaluate(() => window.testEditor.getHTML()), /RequireJS loaded UMD/)
      await page.evaluate(() => window.testEditor.destroy())
    }
    assert.deepEqual(errors, [], `Browser errors:\n${errors.join('\n')}`)
  } catch (error) {
    throw new Error(`${error.message}\n${errors.join('\n')}`, {cause: error})
  }
  console.log(`Verified ${verifyCdn ? 'CDN demo' : 'self-hosted Browser ESM'} in Chromium`)
} finally {
  await browser?.close()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}
