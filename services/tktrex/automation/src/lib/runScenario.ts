import readline from 'readline';

import puppeteer from 'puppeteer';

import { AutomationScenario, AutomationStep } from '@shared/models/Automation';

import { CommandConfig } from '../models/CommandCreator';
import {
  handleCaptcha,
  acceptCookies,
  ttLogin,
} from './platformUtil';

export const prompt = (question: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

interface Context {
  ttLoggedIn: boolean;
}

export const runStep = async(
  config: CommandConfig,
  context: Context,
  page: puppeteer.Page,
  scenario: AutomationScenario,
  step: AutomationStep,
): Promise<Context> => {
  config.log.debug('running step: %O', step);

  if (step.type === 'search') {
    await page.goto(step.platformURL);

    await handleCaptcha(config, step.platform, page);
    await acceptCookies(config, step.platform, page);

    if (step.platform === 'tiktok' && !context.ttLoggedIn) {
      if (!scenario.credentials.tiktok) {
        throw new Error('no TikTok credentials provided');
      }

      await ttLogin(
        config,
        scenario.credentials.tiktok,
        page,
      );
    }

    return context;
  }

  throw new Error('unsupported step type');
};

export const dryRunAutomation =
  (config: CommandConfig) =>
    async(scenario: AutomationScenario): Promise<void> => {
      config.log.info('dry-running automation scenario...');

      const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
      });

      const page = await browser.newPage();

      const scriptReducer = async(
        ctx: Promise<Context>,
        step: AutomationStep,
      ): Promise<Context> => runStep(
        config,
        await ctx,
        page,
        scenario,
        step,
      );

      await scenario.script.reduce(
        scriptReducer,
        Promise.resolve({
          ttLoggedIn: false,
        }),
      );

      await browser.close();
    };
