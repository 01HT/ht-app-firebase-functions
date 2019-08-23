"use strict";
const functions = require("firebase-functions");
import { config } from "firebase-functions";
const express = require("express");
const puppeteer = require("puppeteer");
const url = require("url");
import { browserNotSupported } from "@01ht/ht-app-browser-not-supported";

const envConfig = config();

const appName = envConfig.app_config.name;
const domain = envConfig.app_config.domain;
const cloudinaryURL = `${envConfig.cloudinary.origin}/${
  envConfig.cloudinary.cloud_name
}`;
const svg = envConfig.app_config.logo.svg;
const ico32 = envConfig.app_config.logo.ico32;
const ico64 = envConfig.app_config.logo.ico64;
const ie11_support = envConfig.app_config.ie11_support ? true : false;

function generateUrl(request) {
  return url.format({
    protocol: "https",
    host: domain,
    pathname: request.originalUrl
  });
}

function checkForBots(userAgent) {
  const botList = "googlebot|yandex|bingbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|vkShare|TelegramBot|WhatsApp|W3C_Validator|slackbot|facebot|developers.google.com/+/web/snippet/".toLowerCase();
  if (userAgent.toLowerCase().search(botList) !== -1) return true;
  return false;
}

function isIE11(userAgent) {
  const trident = userAgent.indexOf("Trident/");
  return trident > 0;
}

function isIE10OrOlder(userAgent) {
  const msie = userAgent.indexOf("MSIE ");
  return msie > 0;
}

function createApp(pwashell) {
  const app = express();
  app.get("*", async (req, res) => {
    try {
      const userAgent = req.headers["user-agent"];
      const botResult = checkForBots(userAgent);
      const path = url.parse(req.url).pathname;
      if (path === "/404") res.status(404);
      if (botResult) {
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        const page = await browser.newPage();
        const targetUrl = generateUrl(req);
        targetUrl.replace("robots.txt", "");
        const response = await page.goto(targetUrl, {
          waitUntil: "networkidle0"
        });
        if(response.status() === 404) res.status(404);
        const html = await page.content();
        res.set("Cache-Control", "public, max-age=300, s-maxage=600");
        res.set("Vary", "User-Agent");
        res.send(html);
        await browser.close();
      } else {
        const ie11 = isIE11(userAgent);
        const ieOld = isIE10OrOlder(userAgent);

        const browserNotSupportedParams = {
          appName: appName,
          cloudinaryURL: cloudinaryURL,
          ico64: ico64,
          ico32: ico32,
          svg: svg,
          ie11_support: ie11_support
        };

        if (ieOld || (ie11 && !ie11_support)) {
          res.send(browserNotSupported(browserNotSupportedParams));
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
  return functions.runWith({ memory: '1GB' }).https.onRequest(createApp(pwashell));
}

export { middleware };
