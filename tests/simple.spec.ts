import { test, expect, Response } from '@playwright/test';
import * as gzip from 'gzip-js'

async function processPageRequest(response: Response) {
  const requestOfResponse = response.request()
  if (!requestOfResponse) {
    console.warn(`Missing request object for response`)
    return
  }

  // Skip any requests that are not going to posthog.com
  const parsedRequestUrl = new URL(requestOfResponse.url())
  const isPosthogRequest = parsedRequestUrl.hostname === 'app.posthog.com' && parsedRequestUrl.pathname.endsWith('e/')
  if (!isPosthogRequest) {
    return
  }

  // Get the request data from this Posthog request
  const requestHeaders = await requestOfResponse.allHeaders()
  expect(requestHeaders).toBeDefined()
  const requestData = await requestOfResponse.postDataBuffer()
  expect(requestData).not.toBeNull()
  expect(requestData!.length).toBeGreaterThan(0)

  // Problematic requests are gzipped compressed
  const isCompressEvent = parsedRequestUrl.searchParams.get('compression') === 'gzip-js'
  if (isCompressEvent) {
    // Decompress the request data
    const decompressedRequestData = Buffer.from(gzip.unzip(requestData)).toString('utf-8')
    const parsedJson = JSON.parse(decompressedRequestData)
    if (Array.isArray(parsedJson)) {
      parsedJson.forEach((event, index) => {
        expect(event).toHaveProperty('event')

        test.info().attachments.push({
          name: `posthog event request #${index}`,
          contentType: 'application/json',
          body: Buffer.from(JSON.stringify(event, null, 2))
        })
      })
    }
  }
}

test.describe('Posthog Interceptor', () => {
  test('posthog', async ({ page }, testInfo) => {
    page.on('response', async (response) => {
      try {
        await processPageRequest(response)
      } catch (err) {
        console.log(err)
      }
    })

    await page.goto('https://posthog.com')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'simple/posthog-homepage.png' })

    const button = await page.locator(`role=link[name=/Get Started/i]`).first()
    await expect(button).toBeVisible()
    await button.click()

    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'simple/posthog-book.png' })

    // Wait a bit of time to ensure the website has send
    // events to Posthog for ingestion
    await page.waitForTimeout(5000)

    const testAttachments = testInfo.attachments ?? []
    expect(testAttachments.length).toBeGreaterThan(0)
  })
})
