"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const firebase_functions_1 = require("firebase-functions");
const express = require("express");
const url = require("url");
const puppeteer = require("puppeteer");
const ht_app_browser_not_supported_1 = require("@01ht/ht-app-browser-not-supported");
const envConfig = firebase_functions_1.config();
const appName = envConfig.app_config.name;
const origin = envConfig.app_config.origin;
const cloudinaryURL = `${envConfig.cloudinary.origin}/${envConfig.cloudinary.cloud_name}`;
const svg = envConfig.app_config.logo.svg;
const ico32 = envConfig.app_config.logo.ico32;
const ico64 = envConfig.app_config.logo.ico64;
function checkForBots(userAgent) {
    const botList = "googlebot|yandex|bingbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|vkShare|TelegramBot|WhatsApp|W3C_Validator|slackbot|facebot|developers.google.com/+/web/snippet/".toLowerCase();
    if (userAgent.toLowerCase().search(botList) !== -1)
        return true;
    return false;
}
function isIE(userAgent) {
    const trident = userAgent.indexOf("Trident/");
    const msie = userAgent.indexOf("MSIE ");
    return trident > 0 || msie > 0;
}
// https://github.com/GoogleChrome/rendertron/blob/master/src/renderer.ts
async function serialize(targetURL, pwashell) {
    function stripPage() {
        // Strip only script tags that contain JavaScript (either no type attribute or one that contains "javascript")
        const elements = document.querySelectorAll('script:not([type]), script[type*="javascript"], script[type*="module"], link[rel=import]');
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
        }
        else {
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
    page.evaluateOnNewDocument("customElements.forcePolyfill = true");
    page.evaluateOnNewDocument("ShadyDOM = {force: true}");
    page.evaluateOnNewDocument("ShadyCSS = {shimcssproperties: true}");
    // Go to targetURL for fixing url in page
    await page.goto(targetURL, { waitUntil: "load" });
    //  await page.waitFor(10000);
    // Remove script & import tags.
    await page.evaluate(stripPage);
    // Inject <base> tag with the origin of the request (ie. no path).
    await page.evaluate(injectBaseHref, `${origin}`);
    const content = await page.evaluate("document.firstElementChild.outerHTML");
    let statusCode = 200;
    // Set status to the initial server's response code. Check for a <meta
    // name="render:status_code" content="4xx" /> tag which overrides the status
    // code.
    const newStatusCode = await page.evaluate(() => {
        try {
            const meta = document.querySelector('meta[name="render:status_code"]');
            if (meta) {
                return parseInt(meta.getAttribute("content"));
            }
        }
        catch (err) {
            return false;
        }
        return false;
    });
    if (newStatusCode)
        statusCode = newStatusCode;
    await browser.close();
    return { statusCode: statusCode, content: content };
}
function createApp(pwashell) {
    const app = express();
    app.get("*", async (req, res) => {
        try {
            const userAgent = req.headers["user-agent"];
            const botResult = checkForBots(userAgent);
            const path = url.parse(req.url).path;
            if (botResult) {
                const result = await serialize(`${origin}${path}`, pwashell);
                // res.set("Cache-Control", "public, max-age=300, s-maxage=600");
                // res.set("Vary", "User-Agent");
                res.status(result.statusCode);
                res.send(result.content);
            }
            else {
                const browserNotSupportedParams = {
                    appName: appName,
                    cloudinaryURL: cloudinaryURL,
                    ico64: ico64,
                    ico32: ico32,
                    svg: svg
                };
                if (isIE(userAgent)) {
                    res.send(ht_app_browser_not_supported_1.browserNotSupported(browserNotSupportedParams));
                }
                else {
                    res.send(pwashell);
                }
            }
        }
        catch (err) {
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
exports.middleware = middleware;
//# sourceMappingURL=middleware.js.map