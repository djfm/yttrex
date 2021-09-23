#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('yttrex:mirrorer');
var request = Promise.promisifyAll(require('request'));
var nconf = require('nconf');

nconf.argv().env();

if(!nconf.get('key'))
    return console.log("--key required");

const source = nconf.get('source') || 'https://youtube.tracking.exposed';
const sourceUrl = `${source}/api/v1/mirror/${nconf.get('key')}/`;
const dest = nconf.get('dest') || 'http://localhost:9000';
const destUrl = `${dest}/api/v2/events`;

debug("Fetching latest samples via %s", sourceUrl);
return request
    .getAsync({url: sourceUrl, rejectUnauthorized: false } )
    .then(function(res) {
        // debug("Download completed (%d)", _.size(res.body) );
        return res.body;
    })
    .then(JSON.parse)
    .then(function(e) {
        if(!e.content)
            process.exit(0);
        // debug("Extracted %d elements", e.elements);
        return e.content;
    })
    .map(function(copiedReq) {
        debug("%s", _.map(copiedReq.body, 'href').join(',') );
        return request
            .postAsync(destUrl, { json: copiedReq.body, headers: copiedReq.headers })
            .then(function(result) {
                if(result.body && result.body.supporter)
                    debug("OK %s: %s",
                        copiedReq.headers['x-yttrex-version'], result.body.supporter.p);
                else
                    debug("?? %s - %j",
                        copiedReq.headers['x-yttrex-version'], result.body);
            })
    }, { concurrency: 1})
    .catch(function(error) {
        debug("――― [E] %s %s", error.message, new Date());
    });
