// # Welcome to the extension docs!
// Here you can learn how the extension works and, if this is what you aim for,
// where to put your hands to hack the code.
//
// ## Structure of the extension
// The extension has two parts:
//  - a content script
//  - event pages.
//
// The **content script** is the JavaScript code injected into the youtube.com
// website. It can interact with the elements in the page to scrape the data and
// prepare the payload to be sent to the API.
//
// On the other side there are **event pages**. They are scripts triggered by
// some events sent from the **content script**. Since they run in *browser-space*,
// they have the permission (if granted) to do cross-domain requests, access
// cookies, and [much more](https://developer.chrome.com/extensions/declare_permissions).
// All **event pages** are contained in the [`./background`](./background/app.html) folder.
// (the name is **background** for historical reasons and it might be subject of changes
// in the future).
//
// Naming:
//   - videoSequence is a list of youtube videos
//   - comparativePage is the place where users accept to reproduce a videoSequence

// # Code

// Import other utils to handle the DOM and scrape data.
import $ from 'jquery';
import _ from 'lodash';
import moment from 'moment';

import config from './config';
import hub from './hub';
import { registerHandlers } from './handlers/index';
import extractor from './extractor';
import dom from './dom';
import { phase, initializeBlinks } from './blink';

const YT_VIDEOTITLE_SELECTOR = 'h1.title';

// bo is the browser object, in chrome is named 'chrome', in firefox is 'browser'
const bo = chrome || browser;

// variable used to spot differences due to refresh and url change
let randomUUID = 'INIT' + Math.random().toString(36).substring(2, 13) +
                Math.random().toString(36).substring(2, 13);

// to optimize the amount of reported data, we used a local cache
let lastObservedSize = 1;
let leafsCache = {};

// Boot the user script. This is the first function called.
// Everything starts from here.
function boot () {
    if (_.endsWith(window.location.origin, 'youtube.tracking.exposed')) {
        if (_.isUndefined($('#extension--parsable').html())) {
            return null;
        } else {
            // $(".extension-missing").hide();
            return null;
        }
    } else if (_.endsWith(window.location.origin, 'youtube.com')) {
        // this get executed only on youtube.com
        console.log(`yttrex version ${JSON.stringify(config)}`);

        // Register all the event handlers.
        // An event handler is a piece of code responsible for a specific task.
        // You can learn more in the [`./handlers`](./handlers/index.html) directory.
        registerHandlers(hub);

        // Lookup the current user and decide what to do.
        localLookup(response => {
            // `response` contains the user's public key, we save it global for the blinks
            console.log("app.js gets", response, "from localLookup");

            /* these parameters are loaded from localstorage */
            config.publicKey = response.publicKey;
            config.active = response.active;
            config.ux = response.ux;

            if(config.active !== true) {
                console.log("ytTREX disabled!"); // TODO some UX change
                return null;
            }
            return remoteLookup(ytTrexActions);
        });
    } else if (_.startsWith(window.location.origin, 'localhost')) {
        console.log('yttrex in localhost: ignored condition');
        return null;
    }
}

const hrefPERIODICmsCHECK = 9000;
let hrefWatcher = null;
function ytTrexActions(remoteInfo) {
    /* these functions are the main activity made in 
       content_script, and ytTrexActions is a callback
       after remoteLookup */
    console.log("initialize watchers, remoteInfo available:", remoteInfo);

    if(hrefWatcher)
        clearInterval(hrefWatcher);

    hrefWatcher = window.setInterval(hrefAndPageWatcher, hrefPERIODICmsCHECK);
    initializeBlinks();
    leafsWatcher();
    flush();
    // capture();
}

let lastVideoURL = null;
let lastVideoCNT = 0;
function hrefAndPageWatcher () {
    // phase('video.wait');
    let diff = (window.location.href !== lastVideoURL);

    // client might duplicate the sending of the same
    // video. using a random identifier, we spot the
    // clones and drop them server side.
    // also, here is cleaned the cache declared below
    if (diff) {
        phase('video.seen');
        cleanCache();
        refreshUUID();
    }
    if (!diff) {
        lastVideoCNT++;
        if (lastVideoCNT > 3) {
            // console.log(lastVideoCNT, "too many repetition: stop");
            return;
        }
    }

    lastVideoURL = window.location.href;
    const isPresent = document.querySelector(YT_VIDEOTITLE_SELECTOR);
    if(!isPresent)
        return;

    const sendableNode = document.querySelector('ytd-app');

    if (!sizeCheck(sendableNode.outerHTML))
        return;

    hub.event('newVideo', {
        element: sendableNode.outerHTML,
        size: sendableNode.outerHTML.length,
        href: window.location.href,
        randomUUID
    });
    phase('video.send');
}

function sizeCheck(nodeHTML) {
    // this function look at the LENGTH of the proposed element.
    // this is used in video because the full html body page would be too big.
    const s = _.size(nodeHTML);

    // check if the increment is more than 4%, otherwise is not interesting
    const percentile = (100 / s);
    const percentage = _.round(percentile * lastObservedSize, 2);

    if(percentage > 95) {
        console.log(`Skipping update as ${percentage}% of the page is already sent (size ${s}, lastObservedSize ${lastObservedSize})`);
        return false;
    }

    // this is the minimum size worthy of reporting
    if(s < 100000) {
        console.log("Too small to consider!", s);
        return false;
    }

    console.log(`Valid update as a new ${100-percentage}% of the page is worthy (size ${s}, lastObservedSize ${lastObservedSize})`);
    lastObservedSize = s;
    return true;
}

const watchedPaths = {
    banner: { selector: '.video-ads.ytp-ad-module', parents: 4, color: 'blue', screen: true },
    ad: { selector: '.ytp-ad-player-overlay', parents: 4, color: 'blue', screen: true },
    overlay: { selector: '.ytp-ad-player-overlay-instream-info', parents: 4, color: 'blue', screen: true },
    toprightad: { selector: 'ytd-promoted-sparkles-web-renderer' },
    toprightpict: { selector: '.ytd-action-companion-ad-renderer' },

    channel: {
        selector: '[href^="/channel/"].ytd-video-owner-renderer',
        parents: 1,
    },
    searchcard: { selector: '.ytd-search-refinement-card-renderer' },
    channellink: { selector: '.channel-link' },
    label: { selector: '[aria-label]' }, 

    /* for searches, + aria label */
    sectionName: { selector: 'h2', color: "goldenrod" },
    searchAds: {
        selector: '.ytd-promoted-sparkles-text-search-renderer',
        parents: 2
    },
};

const getOffsetLeft = element => {
  let offsetLeft = 0;
  while(element) {
    offsetLeft += element.offsetLeft;
    element = element.offsetParent;
  }
  return offsetLeft;
}

const getOffsetTop = element => {
  let offsetTop = 0;
  while(element) {
    offsetTop += element.offsetTop;
    element = element.offsetParent;
  }
  return offsetTop;
}

function onCaptured(imageUri) {
  console.log(imageUri);
}

function onError(error) {
  console.log(`Error: ${error}`);
}

function manageNodes(command, selectorName, selected) {
    // command has .selector .parents .preserveInvisible (this might be undefined)

    const offsetTop = getOffsetTop(selected);
    const offsetLeft = getOffsetLeft(selected);
    let isVisible = (offsetTop + offsetLeft) > 0;
    if(command.preserveInvisible != true) {
        if(!isVisible) {
            // console.log("killing an invisible", offsetLeft, offsetTop, selectorName, selected);
            return;
        }
    }

    // this to highlight what is collected as fragments
    selected.style.border = '1px solid ' + (command.color ? command.color : 'red');

    // if escalation to parents, highlight with different color
    if(command.parents) {
        selected = _.reduce(_.times(command.parents), function(memo) {
            // console.log("collecting parent", selectorName, memo.tagName, memo.parentNode.tagName);
            return memo.parentNode;
        }, selected);
        selected.style.border = '3px dotted green';
    }

    if(command.screen) {
        console.log("Processing screen!");
        try {
            // debugger;
            const c= bo.tab.captureVisibleTab();
            c.then(onCaptured, onError);
            const capturing = bo.tabs.Tab.captureVisibleTab();
            capturing.then(onCaptured, onError);
        } catch(error) {
            console.warn("tab screencapture fail", error);
        }
    }
    const html = selected.outerHTML;
    const hash = html
        .split('')
        .reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0); return a&a},0);

    if(leafsCache[hash]) {
        leafsCache[hash]++;
        return;
        console.log("cache increment",
            hash, leafsCache[hash], selectorName);
    }
    // most of the time this doesn't happens: duplication are many!
    // is debug-worthy remove the 'return' and send cache counter.

    leafsCache[hash] = 1;
    // as it is the first observation, take infos and send it
    const acquired = {
        html,
        hash,
        offsetTop,
        offsetLeft,
        href: window.location.href,
        selectorName,
        randomUUID,
    };

    // helpful only at development time:
    // const extra = extractor.mineExtraMetadata(selectorName, acquired);
    // console.table(extra);

    hub.event('newInfo', acquired);
    phase('adv.seen');
};

function leafsWatcher () {
    // inizialized MutationObserver with the selectors and 
    // then a list of functions would handle it
    _.each(watchedPaths, function(command, selectorName) {
        dom.on(command.selector,
            _.partial(manageNodes, command, selectorName)
        );
    })
}

function cleanCache() {
    leafsCache = {};
    lastObservedSize = 1;
}

var lastCheck = null;
function refreshUUID () {
    const REFERENCE = 3;
    if (lastCheck && lastCheck.isValid && lastCheck.isValid()) {
        var timed = moment.duration(moment() - lastCheck);
        if (timed.asSeconds() > REFERENCE) {
            // here is an example of a non secure random generation
            // but doesn't matter because the query on the server we
            // has this with the user publicKey, so if someone wants to
            // corrupt their data: they can ¯\_(ツ)_/¯
            randomUUID = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15); /*
            console.log(
                "-> It is more than", REFERENCE, timed.asSeconds(),
                "Refreshed randomUUID", randomUUID); */
        } else { /*
            console.log("-> It is less then", REFERENCE, timed.asSeconds()); */
        }
    };
    lastCheck = moment(); // TODO understand and verify, should this be in the block above?
}

// The function `localLookup` communicates with the **action pages**
// to get information about the current user from the browser storage
// (the browser storage is unreachable from a **content script**).
function localLookup (callback) {
    bo.runtime.sendMessage({
        type: 'localLookup',
        payload: {
            userId: 'local' // at the moment is fixed to 'local'
        }
    }, callback);
}

// The function `remoteLookup` communicate the intention
// to the server of performing a certain test, and retrive
// the userPseudonym from the server - this is not used in ytTREX
function remoteLookup (callback) {
    bo.runtime.sendMessage({
        type: 'remoteLookup',
        payload: {
            config,
            href: window.location.href,
        }
    }, callback);
}

function flush () {
    window.addEventListener('beforeunload', (e) => {
        hub.event('windowUnload');
    });
}

// Before booting the app, we need to update the current configuration
// with some values we can retrieve only from the `chrome`space.
bo.runtime.sendMessage({type: 'chromeConfig'}, (response) => {
    Object.assign(config, response);
    boot();
});
