"use strict";
const functions = require("firebase-functions");
import { config } from "firebase-functions";
const express = require("express");
const puppeteer = require("puppeteer");
const url = require("url");
import { browserNotSupported } from "@01ht/ht-app-browser-not-supported";

const envConfig = config();

const appName = envConfig.app_config.name;
const origin = envConfig.app_config.origin;
const cloudinaryURL = `${envConfig.cloudinary.origin}/${
  envConfig.cloudinary.cloud_name
}`;
const svg = envConfig.app_config.logo.svg;
const ico32 = envConfig.app_config.logo.ico32;
const ico64 = envConfig.app_config.logo.ico64;

function checkForBots(userAgent) {
  const botList = "googlebot|yandex|bingbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|vkShare|TelegramBot|WhatsApp|W3C_Validator|slackbot|facebot|developers.google.com/+/web/snippet/".toLowerCase();
  if (userAgent.toLowerCase().search(botList) !== -1) return true;
  return false;
}

function isIE(userAgent) {
  const trident = userAgent.indexOf("Trident/");
  const msie = userAgent.indexOf("MSIE ");
  return trident > 0 || msie > 0;
}

// https://github.com/GoogleChrome/rendertron/blob/master/src/renderer.ts
async function serialize(requestUrl) {
  // Executed on the page after the page has loaded. Strips script and import tags to prevent further loading of resources.
  function stripPage() {
    // Strip only script tags that contain JavaScript (either no type attribute or one that contains "javascript")
    const elements = document.querySelectorAll(
      'script:not([type]), script[type*="javascript"], link[rel=import]'
    );
    for (const e of Array.from(elements)) {
      e.remove();
    }
  }

  //  Injects a <base> tag which allows other resources to load. This has no effect on serialised output, but allows it to verify render quality.
  function injectBaseHref() {
    const base = document.createElement("base");
    base.setAttribute("href", origin);

    const bases = document.head.querySelectorAll("base");
    if (bases.length) {
      // Patch existing <base> if it is relative.
      const existingBase = bases[0].getAttribute("href") || "";
      if (existingBase.startsWith("/")) {
        bases[0].setAttribute("href", origin + existingBase);
      }
    } else {
      // Only inject <base> if it doesn't already exist.
      document.head.insertAdjacentElement("afterbegin", base);
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    // args need for correct work in firebase functions
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

   // Add webcomponentsjs library and set params for serialization webcomponents for make it readable for crawlers
  page.evaluateOnNewDocument(
    `var wcjsScript = document.createElement("script");
    script.src = "/node_modules/@webcomponents/webcomponentsjs/webcomponents-loader.js";
    document.body.appendChild(wcjsScript);`
  );
  page.evaluateOnNewDocument("customElements.forcePolyfill = true");
  page.evaluateOnNewDocument("ShadyDOM = {force: true}");
  page.evaluateOnNewDocument("ShadyCSS = {shimcssproperties: true}");

  let response = null;
  // Capture main frame response. This is used in the case that rendering
  // times out, which results in puppeteer throwing an error. This allows us
  // to return a partial response for what was able to be rendered in that
  // time frame.
  page.addListener("response", r => {
    if (!response) {
      response = r;
    }
  });

  requestUrl.replace("robots.txt", "");

  try {
    // Navigate to page. Wait until there are no oustanding network requests.
    response = await page.goto(requestUrl, {
      timeout: 30000,
      waitUntil: "load"
    });
  } catch (e) {
    console.error(e);
  }

  // Wait 5 sec after load for full page loading
  await page.evaluate(() => {
    const promise = new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, 5000);
    });
    return promise;
  });

  if (!response) {
    console.error("response does not exist");
    // This should only occur when the page is about:blank. See
    // https://github.com/GoogleChrome/puppeteer/blob/v1.5.0/docs/api.md#pagegotourl-options.
    await page.close();
    return { statusCode: 400, content: "" };
  }

  // Set status to the initial server's response code. Check for a <meta
  // name="render:status_code" content="4xx" /> tag which overrides the status
  // code.
  let statusCode = response.status();
  const newStatusCode = await page
    .$eval('meta[name="render:status_code"]', element =>
      parseInt(element.getAttribute("content") || "")
    )
    .catch(() => undefined);
  // On a repeat visit to the same origin, browser cache is enabled, so we may
  // encounter a 304 Not Modified. Instead we'll treat this as a 200 OK.
  if (statusCode === 304) {
    statusCode = 200;
  }
  // Original status codes which aren't 200 always return with that status
  // code, regardless of meta tags.
  if (statusCode === 200 && newStatusCode) {
    statusCode = newStatusCode;
  }
  // Remove script & import tags.
  await page.evaluate(stripPage);
  // Inject <base> tag with the origin of the request (ie. no path).
  await page.evaluate(injectBaseHref, `${origin}`);

  // Serialize page.
  const content = await page.evaluate("document.firstElementChild.outerHTML");

  await page.close();
  return { statusCode: statusCode, content: content };
}

function createApp(pwashell) {
  const app = express();
  app.get("*", async (req, res) => {
    try {
      const userAgent = req.headers["user-agent"];
      const botResult = checkForBots(userAgent);
      const pathname = url.parse(req.url).pathname;

      if (botResult) {
        const result = await serialize(`${origin}${pathname}`);
        // res.set("Cache-Control", "public, max-age=300, s-maxage=600");
        // res.set("Vary", "User-Agent");
        res.status(result.statusCode);
        res.send(result.content);
      } else {
        const browserNotSupportedParams = {
          appName: appName,
          cloudinaryURL: cloudinaryURL,
          ico64: ico64,
          ico32: ico32,
          svg: svg
        };
        if (isIE(userAgent)) {
          res.send(res.send(browserNotSupported(browserNotSupportedParams)));
        } else {
          res.send(pwashell);
        }
      }
    } catch (err) {
      res.send("Error:" + err);
      console.log("Error:" + err);
    }
  });
  return app;
}

function middleware(pwashell) {
  return functions
    .runWith({ memory: "2GB" })
    .https.onRequest(createApp(pwashell));
}

export { middleware };
