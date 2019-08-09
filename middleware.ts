"use strict";
const express = require("express");
const fetch = require("node-fetch");
const url = require("url");
import { browserNotSupported } from "@01ht/ht-app-browser-not-supported";

function middleware(
  pwashell,
  appName,
  domain,
  cloudinaryURL,
  svg,
  ico32,
  ico64,
  IESupport
) {
  const generateUrl = request => {
    return url.format({
      protocol: "https",
      host: domain,
      pathname: request.originalUrl
    });
  };
  const checkForBots = userAgent => {
    const botList = "googlebot|yandex|bingbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|vkShare|TelegramBot|WhatsApp|W3C_Validator|slackbot|facebot|developers.google.com/+/web/snippet/".toLowerCase();
    if (userAgent.toLowerCase().search(botList) !== -1) return true;
    return false;
  };

  const isIE = userAgent => {
    const msie = userAgent.indexOf("MSIE "); // IE 10 or older
    const trident = userAgent.indexOf("Trident/"); // IE 11
    return msie > 0 || trident > 0;
  };

  const app = express();

  const renderUrl = "https://render-tron.appspot.com/render";

  app.get("*", (req, res) => {
    try {
      const userAgent = req.headers["user-agent"];
      const botResult = checkForBots(userAgent);
      const path = url.parse(req.url).pathname;
      if (path === "/404") res.status(404);
      if (botResult) {
        const targetUrl = generateUrl(req);
        targetUrl.replace("robots.txt", "");
        // console.log(`${renderUrl}/${targetUrl}?wc-inject-shadydom=true`);
        fetch(`${renderUrl}/${targetUrl}?wc-inject-shadydom=true`)
          .then(function(fetchResponse) {
            if (fetchResponse.status === 404) res.status(404);
            return fetchResponse.text();
          })
          .then(function(body) {
            res.set("Cache-Control", "public, max-age=300, s-maxage=600");
            res.set("Vary", "User-Agent");
            res.send(body.toString());
          })
          .catch(err => {
            throw new Error(err);
          });
      } else {
        if (isIE(userAgent) && IESupport === undefined) {
          res.send(
            browserNotSupported(appName, cloudinaryURL, ico64, ico32, svg)
          );
        } else {
          res.send(pwashell);
        }
        // fetch(`https://01.ht/app.html`)
        //   .then(function(res) {
        //     return res.text();
        //   })
        //   .then(function(body) {
        //     res.send(body.toString());
        //   });
      }
    } catch (err) {
      res.send("Error:" + err);
      console.log("Error:" + err);
    }
  });
  return app;
}

export { middleware };
