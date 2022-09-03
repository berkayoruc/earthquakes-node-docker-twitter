import fetch from "node-fetch";
import cheerio from "cheerio";
import fs from "fs";
import { createRequire } from "module";
import Twitter from "twitter";
const require = createRequire(import.meta.url);
var configJSON = require("./config.json");

setInterval(
  () =>
    fetch(configJSON.EQ_URL)
      .then((res) => res.text())
      .then((res) => evalRes(res))
      .catch((err) => console.log("en tepeden", err)),
  configJSON.INTERVAL
);

let comparer = (otherArray) => {
  return function (current) {
    return (
      otherArray.filter(function (other) {
        return other.date === current.date;
      }).length == 0
    );
  };
};

let evalRes = (res) => {
  console.log(new Date().toUTCString());
  const $ = cheerio.load(res, { xmlMode: true });
  const earthquakesDOM = getEarthquakesDOM($);
  const networkEarthquakes = createEarthquakesArray($, earthquakesDOM);
  readLocalFileEarthquakes()
    .then((strLocalEarthquakes) => {
      const localEarthquakes = JSON.parse(strLocalEarthquakes);
      const newEarthquakes = networkEarthquakes.filter(
        comparer(localEarthquakes)
      );
      console.log("newEarthquakes", newEarthquakes);
      const earthquakes = getEarthquakesBySelectedCriteria(newEarthquakes);
      console.log("earthquakes", earthquakes);
      // sendNewEarthQuakesNoti(earthquakes);
      sendTweetNewEarthquakes(earthquakes);
      writeEarthquakesToFile(networkEarthquakes);
      if (earthquakes.length === 0) {
        return;
      }
    })
    .catch((err) => console.log(err));
};

const sendTweetNewEarthquakes = (earthquakes) => {
  earthquakes.forEach((earthquake) => {
    if (earthquake.mag >= 3.5) {
      sendTweet(earthquake);
    }
  });
};

let getEarthquakesDOM = ($) => {
  return $("earhquake");
};

let createEarthquakesArray = ($, earthquakesDOM) => {
  let earthquakes = [];
  earthquakesDOM.each((index, earthquake) => {
    earthquakes.push(createEarthQuakeObj($, earthquake));
  });
  return earthquakes;
};

let createEarthQuakeObj = ($, earthquake) => {
  const date = $(earthquake).attr("name").trim();
  const location = $(earthquake).attr("lokasyon").replace(/\s\s+/g, " ").trim();
  const lat = $(earthquake).attr("lat").trim();
  const lng = $(earthquake).attr("lng").trim();
  const mag = $(earthquake).attr("mag").trim();
  const depth = $(earthquake).attr("Depth").trim();
  return { date, location, lat, lng, mag, depth };
};

let writeEarthquakesToFile = (earthquakes) => {
  fs.writeFile(
    "previousEarthquakes.json",
    JSON.stringify(earthquakes),
    function (err) {
      if (err) return console.log("yazarken hata", err);
      console.log("Written earthquakes.json");
    }
  );
};
const readFile = async (filePath) => {
  try {
    const data = await fs.promises.readFile(filePath, "utf8");
    return data;
  } catch (err) {
    console.log("okurken hata", err);
  }
};

let readLocalFileEarthquakes = () => {
  return readFile("previousEarthquakes.json");
};

const getEarthquakesBySelectedCriteria = (newEarthquakes) => {
  const foundEarthquakes = [];
  //   const cities = process.env.CITIES_DELIMITED_WITH_SEMICOLON.split(";");
  //   const minMagnitude = process.env.MIN_MAGNITUDE;
  // newEarthquakes.forEach((earthquake) => {
  //   cities.forEach((city) => {
  //     if (
  //       (city === "*" || earthquake.location.includes(city)) &&
  //       earthquake.mag >= minMagnitude
  //     ) {
  //       foundEarthquakes.push(earthquake);
  //     }
  //   });
  // });
  newEarthquakes.forEach((earthquake) => {
    // if(earthquake.mag >= minMagnitude) {
    foundEarthquakes.push(earthquake);
    // }
  });
  return foundEarthquakes;
};

const sendTweet = (earthquake) => {
  const client = new Twitter({
    consumer_key: configJSON.TWITTER_APIKEY,
    consumer_secret: configJSON.TWITTER_APIKEY_SECRET,
    access_token_key: configJSON.TWITTER_ACCESS_TOKEN,
    access_token_secret: configJSON.TWITTER_ACCESS_TOKEN_SECRET,
  });

  client.post("statuses/update", {
    status: `#Deprem\n#HAZTURK\nBüyüklük: ${earthquake.mag} ML\nKonum: ${earthquake.location}\nZaman: ${earthquake.date}\nDerinlik: ${earthquake.depth}\nEnlem: ${earthquake.lat}°\nBoylam: ${earthquake.lng}°\nhttps://rebrand.ly/HAZTURK`,
    function(error, tweet, response) {
      console.log("send tweet içinde olabilir");
      if (error) throw error;
      console.log(tweet); // Tweet body.
      console.log(response); // Raw response object.
    },
  });
};
