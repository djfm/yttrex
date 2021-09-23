#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('yttrex:parserv');
const debuge = require('debug')('yttrex:parserv:error');
const overflowReport = require('debug')('yttrex:OVERFLOW');
const nconf = require('nconf');
const JSDOM = require('jsdom').JSDOM;
const fs = require('fs');

const videoparser = require('../parsers/video');
const longlabel = require('../parsers/longlabel');
const homeparser = require('../parsers/home');
const automo = require('../lib/automo');
const utils = require('../lib/utils');

nconf.argv().env().file({ file: 'config/settings.json' });

/* const echoes = require('../lib/echoes'); echoes.addEcho("elasticsearch"); echoes.setDefaultEcho("elasticsearch"); */

const FREQUENCY = 10;
const AMOUNT_DEFAULT = 20;
const BACKINTIMEDEFAULT = 3;

let skipCount = _.parseInt(nconf.get('skip')) ? _.parseInt(nconf.get('skip')) : 0;
let htmlAmount = _.parseInt(nconf.get('amount')) ? _.parseInt(nconf.get('amount')) : AMOUNT_DEFAULT;

const stop = _.parseInt(nconf.get('stop')) ? (_.parseInt(nconf.get('stop')) + skipCount): 0;
const backInTime = _.parseInt(nconf.get('minutesago')) ? _.parseInt(nconf.get('minutesago')) : BACKINTIMEDEFAULT;
const id = nconf.get('id');
const filter = nconf.get('filter') ? JSON.parse(fs.readFileSync(nconf.get('filter'))) : null;
const singleUse = !!id;
const repeat = !!nconf.get('repeat');

let nodatacounter = 0;
let processedCounter = skipCount;
let lastExecution = moment().subtract(backInTime, 'minutes').toISOString();
let computedFrequency = 10;
const stats = { lastamount: null, currentamount: null, last: null, current: null };
let lastErrorAmount = 0;

if(backInTime != BACKINTIMEDEFAULT) {
    const humanized = moment.duration(
        moment().subtract(backInTime, 'minutes') - moment()
    ).humanize();
    debug(`Considering ${backInTime} minutes (${humanized}), as override the standard ${BACKINTIMEDEFAULT} minutes ${lastExecution}`);
}

const advSelectors = {
    ".ytp-title-channel": videoparser.adTitleChannel,
    ".video-ads.ytp-ad-module": videoparser.videoAd,
    ".ytp-ad-player-overlay-instream-info": videoparser.overlay,
    ".ytp-chrome-top": videoparser.videoTitleTop,
    ".ytp-title-text": videoparser.videoTitleTop,
};

async function newLoop(htmlFilter) {
    /* this is the begin of the parsing core pipeline.
     * gets htmls from the db, if --repeat 1 then previously-analyzed-HTMLS would be
     * re-analyzed. otherwise, the default, is to skip those and wait for new 
     * htmls. To receive htmls you should have a producer consistend with the 
     * browser extension format, and bin/server listening 
     * 
     * This script pipeline might optionally start from the past, and 
     * re-analyze HTMLs based on --minutesago <number> option.
     * 
     * At the end update metadata only if meaningful update is present,
     * you might notice the library calls in automo, they should be refactored
     * and optimized.
     * */

    const htmls = await automo.getLastHTMLs(htmlFilter, skipCount, htmlAmount);
    if(!_.size(htmls.content)) {

        nodatacounter++;
        if( (nodatacounter % 10) == 1) {
            debug("%d no data at the last query: %j %j",
                nodatacounter, _.keys(htmlFilter), htmlFilter.savingTime);
        }
        lastExecution = moment().subtract(2, 'm').toISOString();
        computedFrequency = FREQUENCY;
        return;
    } else {
        computedFrequency = 0.1;
    }

    if(!htmls.overflow) {
        lastExecution = moment().subtract(BACKINTIMEDEFAULT, 'm').toISOString();
        /* 1 minute is the average stop, so it comeback to check 3 minutes before */
        overflowReport("<NOT>\t\t%d documents", _.size(htmls.content));
    }
    else {
        lastExecution = moment(_.last(htmls.content).savingTime);
        overflowReport("first %s (on %d) <last +minutes %d> next filter set to %s",
            _.first(htmls.content).savingTime, _.size(htmls.content),
            _.round(moment.duration(
                moment(_.last(htmls.content).savingTime ) - moment(_.first(htmls.content).savingTime )
            ).asMinutes(), 1),
            lastExecution);
    }

    if(stats.currentamount || stats.lastamount)
        debug("[+] %d start a new cicle, %d took: %s and now process %d htmls",
            processedCounter,
            stats.currentamount, moment.duration(moment() - stats.current).humanize(),
            _.size(htmls.content));
    stats.last = stats.current;
    stats.current = moment();
    stats.lastamount = stats.currentamount;
    stats.currentamount = _.size(htmls.content);

    const analysis = _.map(htmls.content, processEachHTML);
    /* analysis is a list with [ impression, metadata ] */

    const updates = [];
    for (const entry of _.compact(analysis)) {
        let r = await automo.updateMetadata(entry[0], entry[1], repeat);
        updates.push(r);
    }
    debug("%d html.content, %d analysis, compacted %d, effects: %j",
        _.size(htmls.content), _.size(analysis),
        _.size(_.compact(analysis)), _.countBy(updates, 'what'));

    /* reset no-data-counter if data has been sucessfully processed */
    if(_.size(_.compact(analysis)))
        nodatacounter = 0;

    /* also the HTML cutted off the pipeline, the many skipped
     * by _.compact all the null in the lists, should be marked as processed */
    const remaining = _.reduce(_.compact(analysis), function(memo, blob) {
        return _.reject(memo, { id: blob[0].id });
    }, htmls.content);

    debug("Usable HTMLs %d/%d - marking as processed the useless %d HTMLs\t\t(sleep %d)",
        _.size(_.compact(analysis)), _.size(htmls.content), _.size(remaining), computedFrequency);

    const rv = await automo.markHTMLsUnprocessable(remaining);
    debug("%d completed, took %d secs = %d mins",
        processedCounter, moment.duration(moment() - stats.current).asSeconds(),
        _.round(moment.duration(moment() - stats.current).asMinutes(), 2));
    return rv;
}

function processEachHTML(htmlentry) {
    /* main function invoked by the main loop */
    if(!htmlentry || !htmlentry.html || typeof htmlentry.html !== "string") {
        debug("Not usable evidence id %s (incremental %d pkt %d)",
            htmlentry.id, htmlentry.incremental, htmlentry.packet);
        return null;
    }

    const envelop = {
        impression: _.omit(htmlentry, ['html', '_id']),
        jsdom: new JSDOM(htmlentry.html.replace(/\n\ +/g, ''))
                .window.document,
    }

    let metadata = null;
    try {
        debug("#%d\ton (%d minutes ago) %s %d.%d %s %s %s",
            processedCounter,
            _.round(moment.duration( moment() - moment(htmlentry.savingTime)).asMinutes(), 0),
            htmlentry.metadataId,
            htmlentry.packet, htmlentry.incremental,
            htmlentry.href.replace(/https:\/\//, ''), htmlentry.size, htmlentry.selector);
        processedCounter++;

        const curi = htmlentry.href.replace(/.*youtube\.com\//, '').replace(/\?.*/, '')
        // Replace with URL parsing

        if(!_.size(curi) && htmlentry.selector == "ytd-app") {
            /* without clean URI, it is an youtube home */
            metadata = homeparser.process(envelop);
            _.unset(metadata, 'sections');
        }
        else if(htmlentry.selector == "ytd-app") {
            /* else, if is ytd-app, it is a full video content */
            metadata = videoparser.process(envelop);
        }
        else if(_.indexOf(_.keys(advSelectors), htmlentry.selector) != -1)  {
            /* if the selector is one of the adveritising related dissector, find it out */
            metadata = advSelectors[htmlentry.selector](envelop, htmlentry.selector);
            /* possible fields: 'adLink', 'adLabel', 'adChannel' */
        } else {
            debuge("Selector not supported %s", htmlentry.selector);
            return null;
        }

        if(!metadata)
            return null;

        /* experiment support */
        if(envelop.impression.experiment)
            metadata.experiment = envelop.impression.experiment;

    } catch(error) {
        debuge("#%d\t selector (%s) error: %s", processedCounter, htmlentry.selector, error.message);
        return null;
    }

    return [ envelop.impression, metadata ];
}

async function appendLabelError(currentList, lastSentAmount) {
    // pick the last appended errors 
    const newerrors = currentList.slice( currentList.length - lastSentAmount );
    return _.map(newerrors, async function(le) {
        try {
            await automo.write(nconf.get('schema').errors, {
                type: 'longlabel',
                from: 'parserv',
                when: new Date(),
                label: le,
                id: utils.hash({labelerror: le})
            });
            return true;
        } catch(error) {
            debug("Unable to write on collection 'errors': %s", e.message);
            return false;
        }
    });
}

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function wrapperLoop() {

    if( id && (skipCount || (htmlAmount != AMOUNT_DEFAULT) ) ) {
        debug("Ignoring --skip and --amount because of --id");
        skipCount = 0;
        htmlAmount = AMOUNT_DEFAULT;
    }

    if(stop && htmlAmount > (stop - skipCount) ) {
        htmlAmount = (stop - skipCount);
        debug("--stop %d imply --amount %d", stop, htmlAmount);
    }

    let actualRepeat = (repeat || !!id || !!filter || (backInTime != BACKINTIMEDEFAULT) );
    if(actualRepeat != repeat)
        debug("--repeat it is implicit!");

    while(true) {
        try {
            let htmlFilter = {
                savingTime: {
                    $gt: new Date(lastExecution),
                },
                type: 'video',
            };
            if(!actualRepeat)
                htmlFilter.processed = { $exists: false };
            // else, we consider every html

            if(filter)
                htmlFilter.metadataId = { '$in': filter };
            if(id) {
                debug("Targeting a specific metadataId");
                htmlFilter = {
                    metadataId: id
                }
            }

            if(stop && stop <= processedCounter) {
                console.log("Reached configured limit of ", stop, "( processed:", processedCounter, ")");
                process.exit(processedCounter);
            }
            await newLoop(htmlFilter);

            if(_.size(longlabel.unrecognized) && _.size(longlabel.unrecognized) > lastErrorAmount )  {
                let tmpr = await appendLabelError(longlabel.unrecognized, lastErrorAmount);
                debug("Appended last errors in longlabel: %s (%j)", _.last(longlabel.unrecognized), tmpr);
                lastErrorAmount = _.size(longlabel.unrecognized);
            }

        } catch(e) {
            console.log("Error in newLoop", e.message, e.stack);
        }
        if(singleUse) {
            debug("Single execution done!")
            process.exit(0);
        }
        await sleep(computedFrequency * 1000)
    }
}

try {
    if(filter && id)
        throw new Error("Invalid combo, you can't use --filter and --id");

    wrapperLoop();
} catch(e) {
    console.log("Error in wrapperLoop", e.message);
}
