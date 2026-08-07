import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";

const BOOK_PATH = "/mobile-baseline";
const MOBILE_PROJECT = "mobile-webkit-iphone";

test("renders the representative book page", async ({ page }, testInfo) => {
  await page.goto(BOOK_PATH);

  await expect(
    page.getByRole("heading", {
      name: "Playwright Mobile Baseline Book",
      level: 1,
    })
  ).toBeVisible();
  await expect(
    page.getByText("This fixture book gives the E2E suite deterministic prose to render.")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Chapter 1: Narrow Screen Chapter/ })
  ).toBeVisible();
  await expect(
    page.getByText("This chapter provides ordinary paragraph text for browser smoke coverage.")
  ).toBeVisible();

  if (testInfo.project.name !== MOBILE_PROJECT) {
    return;
  }

  const measurements = await page.evaluate(() => {
    const boundsFor = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect && {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
      };
    };
    const documentElement = document.documentElement;
    const body = document.body;

    return {
      documentElement: {
        clientWidth: documentElement.clientWidth,
        scrollWidth: documentElement.scrollWidth,
      },
      body: {
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth,
      },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      horizontalOverflow:
        documentElement.scrollWidth > documentElement.clientWidth ||
        body.scrollWidth > body.clientWidth,
      bounds: {
        main: boundsFor("main"),
        book: boundsFor(".book"),
      },
    };
  });

  const measurementsPath = testInfo.outputPath("mobile-layout-measurements.json");
  await fs.writeFile(measurementsPath, JSON.stringify(measurements, null, 2));
  await testInfo.attach("mobile-layout-measurements", {
    path: measurementsPath,
    contentType: "application/json",
  });

  const screenshotPath = testInfo.outputPath("mobile-full-page.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("mobile-full-page-screenshot", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
