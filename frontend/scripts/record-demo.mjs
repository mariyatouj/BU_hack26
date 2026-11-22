import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { mkdtemp, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const temp = await mkdtemp(join(tmpdir(), 'savermeal-film-'))
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', slowMo: 160 })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    colorScheme: 'light',
    recordVideo: { dir: temp, size: { width: 1280, height: 860 } },
  })
  const page = await context.newPage()
  const video = page.video()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  const click = (name) => page.getByRole('button', { name, exact: true }).click()
  const nav = (name) => page.getByRole('navigation').getByRole('link', { name, exact: true }).click()
  const pause = async (text, ms = 4600) => {
    await page.evaluate((text) => {
      let box = document.getElementById('video-caption')
      if (!box) {
        box = document.createElement('div')
        box.id = 'video-caption'
        box.style.cssText =
          'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:1000;max-width:94%;width:max-content;padding:12px 20px;color:white;background:#122a20f7;font:600 18px/1.4 system-ui;border-radius:9px;pointer-events:none;box-shadow:0 2px 10px #0005'
        document.body.append(box)
      }
      box.textContent = text
    }, text)
    await page.waitForTimeout(ms)
  }
  await page.goto(origin)
  await pause('SaverMeal connects a reachable pantry session with a meal you can cook.')
  await click('Along transit')
  await page.getByLabel('Maximum walk').selectOption('5')
  await page.getByLabel('Cuisine or region').selectOption('South Asian')
  await page.getByLabel('Find a recipe').fill('masoor')
  await pause('The Orange Line search uses actual stops and a five-minute walking limit.')
  await page.getByRole('button', { name: /Tomato masoor dal/ }).click()
  await page.getByText('Listed at this pantry', { exact: true }).scrollIntoViewIfNeeded()
  await pause('Ruggles Kitchen lists four required ingredients for tomato masoor dal.')
  await nav('Pantry editor')
  await page.getByLabel('onion', { exact: true }).selectOption('unavailable')
  await click('Save session changes')
  await pause('A pantry edit creates a new dated snapshot and keeps the previous one.')
  const openRecipe = async () => {
    await page.goto(origin + '/#explore/ruggles/dal')
    await page.getByText('Listed at this pantry', { exact: true }).scrollIntoViewIfNeeded()
  }
  await openRecipe()
  await pause('The same recipe now shows one missing ingredient.')
  await nav('Pantry editor')
  await page.getByLabel('onion', { exact: true }).selectOption('available')
  await click('Save session changes')
  await openRecipe()
  await page.getByText('Record pickup', { exact: true }).click()
  for (const name of ['red lentils (split dry)', 'tomatoes (canned)', 'onion', 'cumin'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await click('Save pickup')
  await pause('Visitors record exactly what they received at this session.')
  await nav('Pantry editor')
  await click('+90 minutes')
  await openRecipe()
  await pause('Time has advanced. Expired items now need confirmation for a new visit.')
  await nav('Cooking')
  for (const name of ['red lentils (split dry)', 'tomatoes (canned)', 'cumin'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await click('Use AI-generated rehearsal photo')
  await page.getByAltText('Selected meal').waitFor()
  await pause('The private cooking record uses the earlier pickup and three attested ingredients.')
  await click('Submit private meal')
  await page.getByText('300 pts', { exact: true }).waitFor()
  await pause('The accepted meal earns 100 points. The photo stays in this browser.')
  await nav('Wallet')
  await click('Reserve MBTA 1-day pass')
  await click('Confirm reservation')
  await page.getByText('MBTA 1-day pass · reserved').scrollIntoViewIfNeeded()
  await pause('A simulated claim reserves one unit of stock and records one debit.')
  await click('Cancel reservation')
  await pause('Cancellation restores the points and the reward stock.')
  await nav('Explore')
  await click('Along transit')
  await page.getByLabel('Line or bus route').selectOption('1')
  await page.getByLabel('Cuisine or region').selectOption('')
  await page.getByRole('button', { name: 'Newbury Pantry', exact: true }).scrollIntoViewIfNeeded()
  await pause('Bus 1 has directional access stops and a separate return-stop record.')
  await nav('Access help')
  await page.getByText('Why pantry access matters').scrollIntoViewIfNeeded()
  await pause('The public help page offers food, fare and museum resources without a points requirement.')
  await context.close()
  await copyFile(await video.path(), resolve('../docs/walkthrough.webm'))
  console.log('Recorded docs/walkthrough.webm')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
