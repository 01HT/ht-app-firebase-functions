"use strict";
const functions = require("firebase-functions");
import { config } from "firebase-functions";
const express = require("express");
const puppeteer = require("puppeteer");
import { browserNotSupported } from "@01ht/ht-app-browser-not-supported";

const envConfig = config();

const appName = envConfig.app_config.name;
const origin = envConfig.app_config.origin;
const cloudinaryURL = `${envConfig.cloudinary.origin}/${envConfig.cloudinary.cloud_name}`;
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
async function serialize(pwashell) {
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
  const htmlWitchInject = pwashell.replace(
    "<head>",
    `<head>
    <script>
        customElements.forcePolyfill = true;
        ShadyDOM = {force: true};
        ShadyCSS = {shimcssproperties: true};
    </script>
    <script src="/node_modules/@webcomponents/webcomponentsjs/webcomponents-bundle.js"></script>`
  );

  await page.setContent(htmlWitchInject, { timeout: 30000, waitUntil: "load" });

  let statusCode = 200;
  const newStatusCode = await page
    .$eval('meta[name="render:status_code"]', element =>
      parseInt(element.getAttribute("content") || "")
    )
    .catch(() => undefined);

  // Original status codes which aren't 200 always return with that status
  // code, regardless of meta tags.
  if (newStatusCode) statusCode = newStatusCode;
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

      if (botResult) {
        const result = await serialize(pwashell);
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
