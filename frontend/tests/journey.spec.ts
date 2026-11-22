import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const tap = async (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()
const nav = async (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('link', { name, exact: true }).click()
const beat = async (page: Page) => {
  if (process.env.RECORD_DEMO) await page.waitForTimeout(1000)
}

test('transit, inventory edit, historical pickup, private meal and reservation', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto('/')
  await tap(page, 'Along transit')
  await page.getByLabel('Cuisine or region').selectOption('South Asian')
  await page.getByLabel('Find a recipe').fill('masoor')
  const meal = page.getByRole('button', { name: /Tomato masoor dal/ })
  await meal.click()
  await expect(page.getByText(/4 listed here · 0 at home · 0 more needed/)).toBeVisible()
  await beat(page)
  const staff = await context.newPage()
  await staff.goto('/#staff')
  await staff.getByLabel('onion', { exact: true }).selectOption('unavailable')
  await tap(staff, 'Save session changes')
  await expect(page.getByText(/3 listed here · 0 at home · 1 more needed/)).toBeVisible()
  await beat(page)
  await staff.getByLabel('onion', { exact: true }).selectOption('available')
  await tap(staff, 'Save session changes')
  await expect(page.getByText(/4 listed here · 0 at home · 0 more needed/)).toBeVisible()
  await page.getByText('Record pickup', { exact: true }).click()
  for (const name of ['red lentils (split dry)', 'tomatoes (canned)', 'onion', 'cumin'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await tap(page, 'Save pickup')
  await expect(page.getByRole('status').filter({ hasText: 'Pickup saved' })).toBeVisible()
  await tap(staff, '+90 minutes')
  await expect(page.getByText(/need confirmation/)).toBeVisible()
  await beat(page)
  await nav(page, 'Cooking')
  for (const name of ['red lentils (split dry)', 'tomatoes (canned)', 'cumin'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await tap(page, 'Use AI-generated rehearsal photo')
  await expect(page.getByAltText('Selected meal')).toBeVisible()
  await beat(page)
  await tap(page, 'Submit private meal')
  await expect(page.getByText('300 pts', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByAltText('Private cooking submission')).toBeVisible()
  await nav(page, 'Wallet')
  await tap(page, 'Reserve MBTA 1-day pass')
  await tap(page, 'Confirm reservation')
  await expect(page.getByText('MBTA 1-day pass · reserved')).toBeVisible()
  await expect(page.getByText('0 pts', { exact: true })).toBeVisible()
  await beat(page)
  await tap(page, 'Cancel reservation')
  await expect(page.getByText('300 pts', { exact: true })).toBeVisible()
  await nav(page, 'Explore')
  await tap(page, 'Along transit')
  await page.getByLabel('Line or bus route').selectOption('1')
  await expect(page.getByRole('button', { name: 'Newbury Pantry', exact: true })).toBeVisible()
  await beat(page)
  await nav(page, 'Access help')
  await expect(page.getByText('Why pantry access matters')).toBeVisible()
  await beat(page)
  await tap(staff, 'Reset demo')
  await tap(staff, 'Confirm reset')
  await expect(page.getByText('200 pts', { exact: true })).toBeVisible()
  await nav(page, 'Cooking')
  await expect(page.getByText('No meals recorded yet.')).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile list, unavailable services and explicit filter recovery', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_a: unknown, b: (v: unknown) => void) => b({ code: 1, PERMISSION_DENIED: 1 }),
      },
    }),
  )
  await page.goto('/')
  await tap(page, 'Use my location')
  await expect(page.getByRole('status')).toContainText('declined')
  await page.getByLabel('Neighborhood or ZIP').fill('02120')
  await tap(page, 'Set origin')
  await page.getByLabel('Find a recipe').fill('impossible dish')
  await expect(page.getByText(/No session recipe meets/)).toBeVisible()
  await tap(page, 'Search all cuisines within 10 miles')
  await tap(page, 'Along transit')
  await page.getByLabel('Line or bus route').selectOption('39')
  await page.getByLabel('Maximum walk').selectOption('5')
  await expect(page.getByText(/No pantry falls within/)).toBeVisible()
  await page.getByLabel('Maximum walk').selectOption('10')
  await context.setOffline(true)
  await page.getByText('Directions and live departures', { exact: true }).click()
  await tap(page, 'Check live departures')
  await expect(page.getByText(/Live transit is unavailable/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Symphony Community Table', exact: true })).toBeVisible()
  const map = page.getByRole('group', { name: 'Boston demonstration pantries and MBTA routes' })
  await expect(map).toBeHidden()
  await tap(page, 'Show pantry map')
  await map.getByRole('button', { name: 'Explore Symphony Community Table' }).press('Enter')
  await expect(page.getByRole('combobox', { name: 'Pantry', exact: true })).toHaveValue('symphony')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('two tabs racing for the last week pass debit and restore exactly once', async ({ page, context }) => {
  await page.goto('/#wallet')
  // Install a funded balance in this isolated browser so the last-stock race is independent of the weekly cap.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('savermeal-routes', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite'),
        store = tx.objectStore('records'),
        read = store.get('state')
      read.onsuccess = () => {
        const state = read.result
        state.ledger[0].amount = 1600
        store.put(state, 'state')
      }
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  })
  await page.reload()
  const other = await context.newPage()
  await other.goto('/#wallet')
  await Promise.all([page, other].map((p) => tap(p, 'Reserve MBTA 7-day pass')))
  await Promise.all([page, other].map((p) => tap(p, 'Confirm reservation')))
  for (const p of [page, other]) await expect(p.getByText('900 pts', { exact: true })).toBeVisible()
  await Promise.all(
    [page, other].map((p) =>
      p.getByRole('button', { name: 'Cancel reservation' }).evaluate((b: HTMLButtonElement) => b.click()),
    ),
  )
  await expect(page.getByText('1600 pts', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('MBTA 7-day pass · canceled')).toHaveCount(1)
})

test('the single-file build opens directly offline with a pantry recipe deep link', async ({
  page,
  context,
}) => {
  await context.setOffline(true)
  const { pathToFileURL } = await import('node:url')
  const { resolve } = await import('node:path')
  await page.goto(pathToFileURL(resolve('dist-demo/index.html')).href + '#explore/ruggles/dal')
  await expect(page.getByRole('button', { name: /Tomato masoor dal/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(page.getByText('Listed at this pantry', { exact: true })).toBeVisible()
  await tap(page, 'Save recipe')
  await nav(page, 'Cooking')
  await expect(page.getByText('Saved recipes', { exact: true })).toBeVisible()
  await nav(page, 'Explore')
  await page.getByRole('link', { name: 'Featured recipe, tomato masoor dal' }).click()
  await expect(page.getByText('Listed at this pantry', { exact: true })).toBeVisible()
})
