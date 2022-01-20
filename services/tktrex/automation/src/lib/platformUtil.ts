import puppeteer from 'puppeteer';

import { CommandConfig } from '../models/CommandCreator';

export const sleep = async(ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks if a captcha is present on the page, if so,
 * wait until it is not present anymore (and ask user to solve it).
 */
export const handleCaptcha = async(
  config: CommandConfig,
  platform: 'tiktok' | 'youtube',
  page: puppeteer.Page,
): Promise<void> => {
  if (platform !== 'tiktok') {
    throw new Error('captcha handling is only implemented for TikTok');
  }

  try {
    await page.waitForSelector('#captcha-verify-image', {
      visible: true,
      timeout: 5000,
    });

    config.log.info('captcha detected, please solve it');

    for (;;) {
      try {
        await page.waitForSelector('#captcha-verify-image', {
          visible: true,
          timeout: 5000,
        });

        config.log.info('waiting for captcha to disappear...');
        await sleep(5000);
      } catch (err) {
        config.log.info('thanks for solving the captcha');
        break;
      }
    }
  } catch (err) {
    // ignore
  }
};

export const acceptCookies = async(
  config: CommandConfig,
  platform: 'tiktok' | 'youtube',
  page: puppeteer.Page,
): Promise<void> => {
  if (platform !== 'tiktok') {
    throw new Error('cookies banner accepting is only implemented for TikTok');
  }

  const banner = await page.$('[class*="CookieBannerContainer"]');

  if (!banner) {
    return;
  }

  const button = await banner.$('button:last-of-type');

  if (!button) {
    throw new Error('failed to accept cookies');
  }

  await button.click();

  config.log.info('accepted cookies');

  await sleep(5000);
};

export const ttLogin = async(
  config: CommandConfig,
  credentials: {
    username: string;
    password: string;
  },
  page: puppeteer.Page,
): Promise<void> => {
  await page.click('[data-e2e="top-login-button"]');

  const button = await page.waitForSelector(
    '[class*="social-container"] > div:nth-of-type(2)',
  );

  if (!button) {
    throw new Error('failed to find login button');
  }

  await button.click();

  await sleep(300000);
};
