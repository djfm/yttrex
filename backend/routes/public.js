const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('routes:public');
const discodebug = require('debug')('DISCONTINUED');

const params = require('../lib/params');
const automo = require('../lib/automo');
const utils = require('../lib/utils');
const CSV = require('../lib/CSV');

// This variables is used as cap in every readLimit below
const PUBLIC_AMOUNT_ELEMS = 110;
// This is in regards of the 'last' API cache, (which might be discontinued?)
const CACHE_SECONDS = 600;

const cache = {
    seconds: CACHE_SECONDS,
    content: null,
    computedAt: null,
    next: null,
};

function formatReturn(updated) {
    if(updated) {
        debug("Returning %d recent, at least duplicated, evidences part of a %d minutes long cache",
            _.size(updated.content), CACHE_SECONDS / 60);
        cache.content = updated.content;
        cache.computedAt = updated.computedAt;
        cache.next = updated.next
    } else {
        debug("returning cached copy of last duplicated evidences");
    }
    return {
        json: {
            content: cache.content,
            computedt: cache.computedAt.toISOString(),
            next: cache.next.toISOString(),
            cacheTimeSeconds: cache.seconds,
        }
    };
};

async function getLast(req) {

    if(_.isNull(cache.content) || (cache.next && moment().isAfter(cache.next)) ) {
        // if not initialized ^^^^ or if the cache time is expired: do the query
        const last = await automo.getTransformedMetadata([
            { $match: { title: { $exists: true }, "related.19": { $exists: true } }},
            { $sort: { savingTime: -1 }},
            { $limit: 1500 },
            { $group: { _id: "$videoId", amount: { $sum: 1 }}},
            { $match: { amount: { $gte: 4 }}},
            { $lookup: { from: 'metadata', localField: '_id', foreignField: 'videoId', as: 'info' }},
            { $limit: 20 }
        ])

        /* the complex entry has nested metadata */
        const reduction = _.map(last, function(ce) {
            let lst = _.last(_.orderBy(ce.info, 'savingTime')).savingTime;
            let d = moment.duration( moment(lst) - moment() );
            let timeago = d.humanize();
            return {
                title: ce.info[0].title,
                authorName: ce.info[0].authorName,
                occurrencies: ce.amount,
                videoId: ce._id,
                timeago,
                secondsago: d.asSeconds()
            }
        });
        let cacheFormat = {
            content: _.reverse(_.orderBy(reduction, 'secondsago')),
            computedAt: moment(),
            next: moment().add(cache.seconds, 'seconds')
        };
        return formatReturn(cacheFormat);
    }
    else {
        return formatReturn();
    }
};

async function getLastHome() {
    const DEFMAX = 100;

    let homelist = await automo.getMetadataByFilter({
        type: 'home',
        savingTime: { $gte: new Date(moment().startOf('day').toISOString()) }
    }, {
        amount: DEFMAX,
        skip: 0,
    });

    const rv = _.reduce(homelist, function(memo, e) {
        const accessId = utils.hash({who: e.publicKey, when: e.savingTime });
        _.each(e.selected, function(vinfo) {
            let selected = {
                accessId: accessId.substr(0, 10),
                metadataId: e.id,
                order: vinfo.index,
                source: vinfo.recommendedSource,
                title: vinfo.recommendedTitle,
                videoId: vinfo.videoId,
                thumbnailHref: vinfo.thumbnailHref,
                publicationTime: vinfo.publicationTime,
            }
            memo.push(selected);
        })
        return memo;
    }, []);

    debug("Returning as getLastHome, %d selected videos from %d evidences", _.size(rv), _.size(homelist));
    return { json: rv };
}

function ensureRelated(rv) {
    /* for each related it is called and only the basic info used in 'compare'
     * page get returned. return 'null' if content is not complete */
    const demanded = ['recommendedSource', 'recommendedTitle',
        'videoId', 'recommendedDisplayL', 'verified', 'index'];
    let sele = _.pick(rv, demanded);
    return (_.some(_.map(demanded, function(k) {
        return _.isUndefined(sele[k]);
    }))) ? null : sele;
}

async function getVideoId(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, PUBLIC_AMOUNT_ELEMS);
    debug("getVideoId %s amount %d skip %d default %d",
        req.params.query, amount, skip, PUBLIC_AMOUNT_ELEMS);

    const entries = await automo.getMetadataByFilter({ videoId: req.params.query}, { amount, skip });
    /* this map function ensure there are the approrpiate data (and thus filter out)
     * old content parsed with different format */

    const evidences = _.compact(_.map(entries, function(meta) {
        meta.related = _.reverse(_.compact(_.map(meta.related, ensureRelated)));
        if(!_.size(meta.related))
            return null;
        _.unset(meta, '_id');
        _.unset(meta, 'publicKey');
        return meta;
    }));
    debug("getVideoId: found %d matches about %s", _.size(evidences), req.params.query);
    return { json: evidences };
};

async function getRelated(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, PUBLIC_AMOUNT_ELEMS);
    debug("getRelated %s query directly 'related.videoId'. amount %d skip %d", req.params.query, amount, skip);
    const entries = await automo.getMetadataByFilter({ "related.videoId": req.params.query }, { amount, skip});
    const evidences = _.map(entries, function(meta) {
        meta.related = _.map(meta.related, function(e) {
            return _.pick(e, ['recommendedTitle', 'recommendedSource', 'index', 'foryou', 'videoId']);
        });
        meta.timeago = moment.duration( meta.savingTime - moment() ).humanize();
        return _.omit(meta, ['_id', 'publicKey'])
    });
    debug("getRelated: returning %d matches about %s", _.size(evidences), req.params.query);
    return { json: evidences };
};

async function getVideoCSV(req) {
    // /api/v1/videoCSV/:query/:amount
    const MAXENTRY = 2800;
    const { amount, skip } = params.optionParsing(req.params.paging, MAXENTRY);
    debug("getVideoCSV %s, amount %d skip %d (default %d)", req.params.query, amount, skip, MAXENTRY);
    const byrelated = await automo.getRelatedByVideoId(req.params.query, { amount, skip} );
    const csv = CSV.produceCSVv1(byrelated);
    const filename = 'video-' + req.params.query + "-" + moment().format("YY-MM-DD") + ".csv"
    debug("VideoCSV: produced %d bytes, returning %s", _.size(csv), filename);

    if(!_.size(csv))
        return { text: "Error, Zorry: 🤷" };

    return {
        headers: {
            "Content-Type": "csv/text",
            "Content-Disposition": "attachment; filename=" + filename
        },
        text: csv,
    };
};

async function getByAuthor(req) {
    /* this API do not return the standard format with videos and related inside,
     * but a data format ready for the visualization provided - this has been 
     * temporarly suspended: https://github.com/tracking-exposed/youtube.tracking.exposed/issues/18 */

    const { amount, skip } = params.optionParsing(req.params.amount, PUBLIC_AMOUNT_ELEMS);
    debug("getByAuthor %s amount %d skip %d", req.params.query, amount, skip);

    let authorStruct;
    try {
        authorStruct = await automo.getMetadataFromAuthor({
            videoId: req.params.query
        }, { amount, skip});
    } catch(e) {
        debug("getByAuthor error: %s", e.message);
        return {
            json: {
                error: true,
                message: e.message
            }
        }
    }

    const authorName = authorStruct.authorName;
    debug("getByAuthor returns %d elements from %s",
        _.size(authorStruct.content), authorName);

    const units = { total: 0, stripped: 0 }
    const ready = _.flatten(_.compact(_.map(authorStruct.content, function(video, i) {
        if(video.related && video.related[0] && video.related[0].title) {
            units.stripped++;
            return null;
        }
        // ^^^ this because old data with .title haven't the recommendedSource
        // and client can't do anything. so we'll count the effective values
        units.total++;
        video.id = video.id.substr(0, 20);

        return _.map(video.related, function(recommended, n) {
            const cleanVideoId = recommended.videoId.replace(/\&.*/, '');
            return {
                id: video.id + i + cleanVideoId + n,
                watchedTitle: video.title,
                watchedVideoId: video.videoId,
                savingTime: video.savingTime,
                recommendedVideoId: cleanVideoId,
                recommendedViews: recommended.recommendedViews,
                recommendedTitle: recommended.recommendedTitle,
                recommendedChannel: recommended.recommendedSource,
            }
        });
    })));

    debug("Returning byAuthor (%s) %d video considered, %d recommendations",
        authorName, _.size(authorStruct.content), _.size(ready) );

    return { json: {
        authorName,
        authorSource: authorStruct.authorSource,
        paging: authorStruct.paging,
        overflow: authorStruct.overflow,
        ...units,
        content: ready,
    }};
};

async function discontinued(req) {
    discodebug("%j", req);
    return { text: "discontinued" };
}

module.exports = {
    getLast,
    getLastHome,
    getVideoId,
    getRelated,
    getVideoCSV,
    getByAuthor,

    /* this special handler is used for all the API who aren't supported anymore.
     * It might be elsewhere, not just in routes/public.js, but ... */
    discontinued,
};
