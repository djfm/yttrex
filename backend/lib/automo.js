/* automo.js means "automongo".
 * This library should be included most of the time, because implement high level functions about mongodb access.
 * all the functions implemented in routes, libraries, and whatsoever, should be implemented here.
 *
 * The module mongo3.js MUST be used only in special cases where concurrency wants to be controlled
 * 
 * This file grows too much and expecially it fail its pourpose. Because if we need to have here an high-level
 * mongo library, now it is nonsensical so much application logic from routes and API falled here. This might 
 * demand a rewriting, especially because this library is copied in amazon.tracking.exposed and pornhub.tracking.exposed
 * and so all the trex derived works beside facebook.tracking.exposed (which as first prototype had a slightly different
 * approach).
 * 
 * In the long term the refactor would lead also to unite the parser in one package and manage domain (.com's) and 
 * project (config/settings.json) as variables.
 */
const _ = require('lodash');
const nconf = require('nconf');
const debug = require('debug')('lib:automo');
const moment = require('moment');
// const chardet = require('chardet')

const utils = require('../lib/utils');
const mongo3 = require('./mongo3');

async function getSummaryByPublicKey(publicKey, options) {
    /* this function return the basic information necessary to compile the
       landing personal page */
    const mongoc = await mongo3.clientConnect({concurrency: 1});

    const supporter = await mongo3.readOne(mongoc,
        nconf.get('schema').supporters, { publicKey });

    if(!supporter || !supporter.publicKey)
        throw new Error("Authentication failure");

    const metadata = await mongo3.readLimit(mongoc,
        nconf.get('schema').metadata, { publicKey: supporter.publicKey, title: {
            $exists: true }}, { savingTime: -1 }, options.amount, options.skip);

    const total = await mongo3.count(mongoc,
        nconf.get('schema').metadata, { publicKey: supporter.publicKey, title: {
            $exists: true
        } });

    const searches = await mongo3.readLimit(mongoc,
        nconf.get('schema').queries, { publicKey: supporter.publicKey }, { savingTime: -1},
            options.amount, options.skip);

    await mongoc.close();

    debug("Retrieved in getSummaryByPublicKey: data %d, total %d (amount %d skip %d) and searches %d",
        _.size(metadata), total, options.amount, options.skip, _.size(searches));

    const fields = [ 'id', 'login', 'videoId', 'savingTime', 'title', 'relative',
                     'authorName', 'authorSource', 'publicationTime', 'relatedN' ];
    const cleandata = _.map(metadata, function(e) {
        e.publicationTime = new Date(e.publicationTime);
        e.relatedN = _.size(e.related);
        e.relative = moment.duration( moment(e.savingTime) - moment() ).humanize() + " ago";
        return _.pick(e, fields);
    });

    const graphs = {};
    const listOfRelated = _.flatten(_.map(metadata, 'related'));

    /* the pie chars are generated from these reduction and rendered with c3js.org */
    graphs.views = _.countBy(metadata, 'authorName');

    /* a pie chart by counting how many video is recommended for you */
    graphs.reason = _.countBy(listOfRelated, 'foryou');
    graphs.reason = _.reduce(graphs.reason, function(memo, value, key) {
        _.set(memo, (key === 'true') ? 'for you' : 'organic', value);
        return memo;
    }, {});

    graphs.related = _.countBy(listOfRelated, 'recommendedSource')
    graphs.related = _.map(graphs.related, function(amount, name) {
        return { name, 'recommended videos': amount };
    });
    graphs.related = _.reverse(_.orderBy(graphs.related, 'recommended videos'));

    return { supporter, recent: cleandata, graphs, total, searches };
}

async function getMetadataByPublicKey(publicKey, options) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const supporter = await mongo3.readOne(mongoc, nconf.get('schema').supporters, { publicKey });

    if(!supporter)
        throw new Error("publicKey do not match any user");

    const filter = {
        publicKey: supporter.publicKey,
        type: options.type,
    };
    if(options.takefull || options.typefilter)
        debug("Options takefull and typefilter were remove")

    if(!options.type)
        debug("This call might not work as expected");

    /* remind self legacy data might not return */

    if(options.timefilter)
        _.set(filter, 'savingTime.$gte', new Date(options.timefilter));

    const metadata = await mongo3.readLimit(mongoc,
        nconf.get('schema').metadata, filter,
            { savingTime: -1 }, options.amount, options.skip);

    await mongoc.close();

    debug("Retrieved in getMetadataByPublicKey: %d metadata (filter %j)", _.size(metadata), filter);
    return {
        supporter,
        metadata,
    };
};

async function getMetadataByFilter(filter, options) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const metadata = await mongo3.readLimit(mongoc,
        nconf.get('schema').metadata, filter, { savingTime: -1 },
        options.amount, options.skip);

    await mongoc.close();
    return metadata;
};

async function getMetadataFromAuthor(filter, options) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});

    const sourceVideo = await mongo3.readOne(mongoc,
        nconf.get('schema').metadata, filter);

    if(!sourceVideo || !sourceVideo.id)
        throw new Error("Video not found, invalid videoId");

    const videos = await mongo3.readLimit(mongoc,
        nconf.get('schema').metadata, { authorSource: sourceVideo.authorSource},
        { savingTime: -1 }, options.amount, options.skip);

    const total = await mongo3.count(mongoc,
        nconf.get('schema').metadata, { authorSource: sourceVideo.authorSource});

    await mongoc.close();
    return {
        content: videos,
        overflow: (_.size(videos) === options.amount),
        total,
        pagination: options,
        authorName: sourceVideo.authorName,
        authorSource: sourceVideo.authorSource,
    }
};

async function getMetadataFromAuthorChannelId(channelId, options) {
    const mongoc = await mongo3.clientConnect({ concurrency: 1 });

    const videos = await mongo3.readLimit(mongoc,
        nconf.get('schema').metadata, { authorSource: channelId },
        { savingTime: -1 }, 100, options.skip);

    const relatedl = _.compact(_.flatten(_.map(videos, 'related')));
    debug("matching %d videos by authorSource (%j) had %d total related",
        videos.length, channelId, relatedl.length);

    if(!relatedl) {
        await mongoc.close();
        /* structure to say "No data available" */
        return {
            content: [], overflow: false, total: 0,
            pagination: options,
        };
    }

    const authors = _.reduce(relatedl, function(memo, related) {
        // legacy .source, an open problem is the logic to
        // get rid of old data, if that matters.
        const rs = related.recommendedSource || related.source;
        if(!memo[rs]) {
            const obj = {
                username: rs,
                channelId: "hack--to-use--the-same-TypeScript OBJ",
                // client side should replace the link w/ search Query
                // this hack, and so the empty avatar, is because
                // the return value typescript is ContentCreator
                avatar: "",
                recommendedVideosCount: 1
            }
            memo[rs] = obj;
        } else {
            memo[rs].recommendedVideosCount++;
        }
        return memo;
    }, {});

    const total = await mongo3.count(mongoc,
        nconf.get('schema').metadata, { authorSource: channelId });

    const ordered = _.map(_.orderBy(
        authors, ['recommendedVideosCount'], ['desc']), function(o) {
            // this hack is because we would generate the link
            // client side, and sneak into 'channelId' the number of
            // times the channel got recommended.
            o.channelId = (o.recommendedVideosCount + "");
            delete o.recommendedVideosCount;
            return o;
        });

    // TODO considerare options.skip e options.amount
    await mongoc.close();
    return {
        content: _.take(ordered, options.amount),
        overflow: (_.size(videos) === options.amount),
        total,
        pagination: options,
    }
};


async function getRelatedByWatcher(publicKey, options) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});

    const supporter = await mongo3.readOne(mongoc, nconf.get('schema').supporters, { publicKey });
    if(!supporter)
        throw new Error("publicKey do not match any user");

    const related = await mongo3
        .aggregate(mongoc, nconf.get('schema').metadata, [
            { $match: { 'watcher': supporter.p }},
            { $sort: { savingTime: -1 }},
            { $skip: options.skip },
            { $limit : options.amount },
            { $lookup: { from: 'videos', localField: 'id', foreignField: 'id', as: 'videos' }},
            { $unwind: '$related' }
        ]);
    await mongoc.close();
    return related;
}

async function getVideosByPublicKey(publicKey, filter, htmlToo) {
    // refactor: this was a double purpose API but actually has only one pourpose. htmlToo should never be true here
    const mongoc = await mongo3.clientConnect({concurrency: 1});

    const supporter = await mongo3.readOne(mongoc, nconf.get('schema').supporters, { publicKey });
    if(!supporter)
        throw new Error("publicKey do not match any user");

    const selector = _.set(filter, 'publicKey', supporter.publicKey);
    debug("getVideosByPublicKey with flexible selector (%j)", filter);
    const metadata = await mongo3.read(mongoc, nconf.get('schema').metadata, selector, { savingTime: -1 });
    const ret = { metadata };

    if(htmlToo) {
        const htmlfilter = { metadataId: { "$in": _.map(metadata, 'id') } };
        const htmls = await mongo3.read(mongoc, nconf.get('schema').htmls, htmlfilter, { savingTime: -1 });
        ret.html = htmls;
    }

    await mongoc.close();
    return ret;
};

async function getHTMLVideosByMetadataId(metadataId) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const htmls = await mongo3.read(mongoc, nconf.get('schema').htmls, {metadataId}, { savingTime: -1 });
    await mongoc.close();
    return htmls;
}

async function deleteEntry(publicKey, id) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const supporter = await mongo3.readOne(mongoc, nconf.get('schema').supporters, { publicKey });
    if(!supporter)
        throw new Error("publicKey do not match any user");

    const metadata = await mongo3.deleteMany(mongoc, nconf.get('schema').metadata, { id: id });
    await mongoc.close();
    return { metadata };
};

async function getRelatedByVideoId(videoId, options) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const related = await mongo3
        .aggregate(mongoc, nconf.get('schema').metadata, [
            { $match: { videoId: videoId } },
            { $sort: { savingTime: -1 }},
            { $skip: options.skip },
            { $limit : options.amount },
            // { $lookup: { from: 'videos', localField: 'id', foreignField: 'id', as: 'videos' }},
            // TODO verify how this work between v1 and v2 transition
            { $unwind: '$related' },
            { $sort: { savingTime: -1 }}
        ]);
    await mongoc.close();
    debug("Aggregate of getRelatedByVideoId: %d entries", _.size(related));
    return _.map(related, function(r) {
        return {
            savingTime: r.savingTime,
            id: r.id.substr(0, 20),
            watcher: utils.string2Food(r.publicKey),
            blang: r.blang,

            recommendedVideoId: r.related.videoId,
            recommendedPubtime: r.related.publicationTime ? r.related.publicationTime.toISOString() : "Invalid Date",
            recommendedForYou: r.related.foryou,
            recommendedTitle: r.related.recommendedTitle,
            recommendedAuthor: r.related.recommendedSource,
            recommendedVerified: r.related.verified,
            recommendationOrder: r.related.index,
            recommendedViews: r.related.recommendedViews,
            watchedId: r.videoId,
            watchedAuthor: r.authorName,
            watchedPubtime: r.publicationTime ? r.publicationTime.toISOString() : "Invalid Date",
            watchedTitle: r.title,
            watchedViews: r.viewInfo.viewStr ? r.viewInfo.viewNumber : null,
            watchedChannel: r.authorSource,
        };
    });
}

async function write(where, what) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    let retv;
    try {
        await mongo3.insertMany(mongoc, where, what);
        retv = { error: false, ok: _.size(what) };
    } catch(error) {
        debug("db.write %s", error.message);
        retv = { error: true, info: error.message };
    }
    await mongoc.close();
    return retv;
}

async function tofu(publicKey, version) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});

    let supporter = await mongo3.readOne(mongoc,
        nconf.get('schema').supporters, { publicKey });

    if( _.get(supporter, '_id') ) {
        supporter.lastActivity = new Date();
        supporter.version = version;
        await mongo3.updateOne(mongoc,
            nconf.get('schema').supporters, { publicKey }, supporter);
    } else {
        supporter = {};
        supporter.publicKey = publicKey;
        supporter.version = version;
        supporter.creationTime = new Date();
        supporter.lastActivity = new Date();
        supporter.p = utils.string2Food(publicKey);
        debug("TOFU: new publicKey received, from: %s", supporter.p);
        await mongo3.writeOne(mongoc,
            nconf.get('schema').supporters, supporter);
    }

    await mongoc.close();
    return supporter;
}

async function getLastLeaves(filter, skip, amount) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const labels = await mongo3
        .readLimit(mongoc, nconf.get('schema').leaves,
            filter, { savingTime: 1},
            amount, skip || 0
        );
    await mongoc.close();

    return {
        overflow: _.size(labels) === amount,
        content: labels
    };
}

async function upsertSearchResults(listof, cName) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    let written = 0;
    for (const entry of listof) {
        const a = await mongo3.upsertOne(mongoc, cName, {id: entry.id}, entry);
        // TODO check return value to see if updated|upsert|fail
        written++;
    }
    await mongoc.close();
    return written;
}

async function updateAdvertisingAndMetadata(adlist) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    let written = 0;
    for (const entry of adlist) {
        const a = await mongo3.upsertOne(mongoc, nconf.get('schema').ads,
            { id: entry.id }, entry);
        // TODO check return value to see if updated|upsert|fail
        written++;
    }
    await mongoc.close();
    return written;

}

async function getLastHTMLs(filter, skip, amount) {

    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const defskip = skip || 0;
    const htmls = await mongo3.readLimit(mongoc,
        nconf.get('schema').htmls, filter,
        { savingTime: 1}, // never change this!
        amount, defskip);

    await mongoc.close();
    return {
        overflow: _.size(htmls) === amount,
        content: htmls
    }
}

async function markHTMLsUnprocessable(htmls) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const ids = _.map(htmls, 'id');
    const r = await mongo3.updateMany(mongoc, nconf.get('schema').htmls,
        { id: { $in: ids }}, { processed: false });
    // TODO check return value to check if updated or inserted
    // debug("partial update happened! (it should be ok) %j", r.result);
    await mongoc.close();
    return r;
}

async function createMetadataEntry(mongoc, html, newsection) {
    let exists = _.pick(html, ['publicKey', 'savingTime', 'clientTime', 'href' ]) ;
    exists = _.extend(exists, newsection);
    exists.id = html.metadataId;
    await mongo3.writeOne(mongoc, nconf.get('schema').metadata, exists);
    return exists;
}

async function updateMetadata(html, newsection, repeat) {

    async function markHTMLandClose(mongoc, html, retval) {
        await mongo3.updateOne(mongoc, nconf.get('schema').htmls, { id: html.id }, { processed: true });
        await mongoc.close();
        return retval;
    }

    /* we should look at the same metadataId in the metadata collection,
       and update new information if missing */
    const mongoc = await mongo3.clientConnect({concurrency: 1});

    if(!html.metadataId) {
        debug("metadataId is not an ID!");
        return await markHTMLandClose(mongoc, html, { what: 'not an ID'});
    }

    const exists = await mongo3.readOne(mongoc, nconf.get('schema').metadata, { id: html.metadataId });

    if(!exists) {
        await createMetadataEntry(mongoc, html, newsection);
        debug("Created metadata %s [%s] from %s",
            html.metadataId, 
            (newsection.title ? newsection.title : "+" + newsection.type + "+"),
            html.href);
        return await markHTMLandClose(mongoc, html, { what: 'created'});
    }

    let updates = 0;
    let forceu = repeat;
    const newkeys = [];
    const updatedkeys = [];
    /* we don't care if these fields change value, they'll not be 'update' */
    const careless = [ 'clientTime', 'savingTime' ];
    const up = _.reduce(newsection, function(memo, value, key) {

        if(_.isUndefined(value)) {
            debug("updateChecker: <%s> has undefined value!", key);
            return memo;
        }
        if(_.indexOf(careless, key) !== -1)
            return memo;

        const current = _.get(memo, key);
        if(!current) {
            _.set(memo, key, value);
            newkeys.push(key);
            updates++;
        } else if(utils.judgeIncrement(key, current, value)) {
            _.set(memo, key, value);
            updatedkeys.push(key);
            forceu = true;
            updates++;
        }
        return memo;
    }, exists);

    if(updates)
        debug("Metadata UPDATE: %s (%s) %d -> new %j, overwritten: %j",
            html.metadataId, html.selector, updates, newkeys, updatedkeys);

    if(forceu || updates ) {
        // debug("Update from incremental %d to %d", exists.incremental, up.incremental);
        // not in youtube!
        await mongo3.updateOne(mongoc, nconf.get('schema').metadata, { id: html.metadataId }, up );
        return await markHTMLandClose(mongoc, html, { what: 'updated'});
    }
    return await markHTMLandClose(mongoc, html, { what: 'duplicated'});
}

async function getMixedDataSince(schema, since, maxAmount) {
    // investigate on usage and meaninging: possible refactor
    console.trace("getMixedData", schema, since, maxAmount);

    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const retContent = [];

    for (const cinfo of schema) {
        const columnName = _.first(cinfo);
        const fields = _.nth(cinfo, 1);
        const timevar = _.last(cinfo);
        const filter = _.set({}, timevar, { $gt: since});

        /* it prefer the last samples, that's wgy the sort -1 */
        const r = await mongo3.readLimit(mongoc,
            nconf.get('schema')[columnName], filter, _.set({}, timevar, -1),
            maxAmount, 0);

        /* if an overflow is spotted, with message is appended */
        if(_.size(r) === maxAmount)
            retContent.push({
                template: 'info',
                message: 'Whoa, too many! capped limit at ' + maxAmount,
                subject: columnName,
                id: "info-" + _.random(0, 0xffff),
                timevar: new Date(
                    moment(_.last(r)[timevar]).subtract(1, 'ms').toISOString()
                ),
                /* one second is added to be sure the alarm message appears after the
                 * last, and not in between the HTMLs/metadatas */
            });

        /* every object has a variable named 'timevar', and the $timevar we
         * used to pick the most recent 200 is renamed as 'timevar'. This allow
         * us to sort properly the sequence of events happen server side */
        _.each(r, function(o) {
            const good = _.pick(o, fields)
            good.template = columnName;
            good.relative = _.round(
                moment.duration( moment() - moment(o[timevar]) ).asSeconds()
            , 1);

            good.timevar = new Date(o[timevar]);
            good.printable = moment(good.timevar).format('HH:mm:ss');
            _.unset(good, timevar);

            /* supporters, or who know in the future, might have not an 'id'.
               it is mandatory for client side logic, so it is attributed random */
            if(_.isUndefined(good.id))
                _.set(good, 'id', "RANDOM-" + _.random(0, 0xffff));

            retContent.push(good);
        });
    }

    await mongoc.close();
    return retContent;
}

async function flexibleRemove(collection, filter) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const count = await mongo3.count(mongoc, collection, filter);
    if(count === 1) {
        const result = await mongo3
            .deleteMany(mongoc, collection, filter);
        debug("flexibleRemove result: %j", result.result);
        return !!result.result.ok;
    } else {
        debug("flexibleRemove refuse to delete as matches are %d", count);
    }
    await mongoc.close();
    return false;
}

async function getTransformedMetadata(chain) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const result = await mongo3
        .aggregate(mongoc, nconf.get('schema').metadata, chain);
    await mongoc.close();
    return result;
}

async function markExperCompleted(mongoc, filter) {
    /* this is called in two different condition:
     1) when a new experiment gets registered and the previously 
        opened by the same publicKey should be closed
     2) when the DELETE api is called to effectively close the exp */
    return await mongo3
        .updateOne(mongoc, nconf.get('schema').experiments,
            filter, {
                status: "completed",
                completeAt: new Date()
            });
}

async function concludeExperiment(testTime) {
    /* this function is called by guardoni v.1.8 when the 
     * access on a directive URL have been completed */
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const r = await markExperCompleted(mongoc, { testTime } );
    await mongoc.close();
    return r;
}

async function saveExperiment(expobj) {
    /* this is used by guardoni v.1.8 as handshake connection,
       the expobj constains a variety of fields, check
       routes/experiment.js function channel3 */
    if(expobj.experimentId === 'DEFAULT_UNSET')
        return null;

    const mongoc = await mongo3.clientConnect({concurrency: 1});
    /* a given public Key can have only one experiment per time */
    const filter = {
        publicKey: expobj.publicKey,
        status: 'active'
    };

    /* every existing experiment from the same pubkey, which
     * is active, should also be marked "completed" */
    const precedent = await markExperCompleted(mongoc, filter);

    expobj.status = "active";
    await mongo3
        .writeOne(mongoc, nconf.get('schema').experiments, expobj);
    await mongoc.close();
    return expobj;
}

async function pullExperimentInfo(publicKey) {
    // because only one experiment per publicKey might
    // exist in a due time, we can be quite sure on the results
    // here
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const exp = await mongo3.readOne(mongoc, nconf.get('schema').experiments,
        { publicKey, status: "active" });
    await mongoc.close();
    if(exp)
        return exp;
    return null;
}

async function registerDirective(links, directiveType) {
    /* this API is called by guardoni when --csv is used,
       the API is POST localhost:9000/api/v3/directives/comparison */
    const experimentId = utils.hash({
        type: directiveType,
        links, 
    });
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const exist = await mongo3.readOne(mongoc,
        nconf.get('schema').directives, {
            experimentId
        });

    if(exist && exist.experimentId) {
        debug("Directive already found in the DB!")
        await mongoc.close();
        return {
            status: 'exist',
            experimentId: exist.experimentId,
            since: exist.when,
        };
    }

    /* else, we don't had such data, hence */
    await mongo3.writeOne(mongoc,
        nconf.get('schema').directives, {
        when: new Date(),
        directiveType,
        links,
        experimentId,
    })
    await mongoc.close();
    debug("Registered directive %s|%s", directiveType, experimentId);
    return { status: 'created', experimentId };
}

async function pickDirective(experimentId) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const rb = await mongo3.readOne(mongoc,
        nconf.get('schema').directives, { experimentId });
    await mongoc.close();
    return rb;
}

module.exports = {
    /* used by routes/personal */
    getSummaryByPublicKey,
    getMetadataByPublicKey,
    getRelatedByWatcher,
    getVideosByPublicKey,
    deleteEntry,

    /* used by routes/public */
    getMetadataByFilter,
    getMetadataFromAuthor,
    getMetadataFromAuthorChannelId,

    /* used by routes/htmlunit */
    getHTMLVideosByMetadataId,

    /* used by public/videoCSV */
    getRelatedByVideoId,

    /* used in events.js processInput */
    tofu,
    write,

    /* used in parserv2 */
    getLastHTMLs,
    updateMetadata,
    markHTMLsUnprocessable,

    /* used in bin/leaveserv.js */
    getLastLeaves,
    upsertSearchResults,
    updateAdvertisingAndMetadata,

    /* used in getMonitor */
    getMixedDataSince,
    flexibleRemove,

    /* generalized aggregation call */
    getTransformedMetadata,

    /* experiment related operations */
    saveExperiment,
    pullExperimentInfo,

    concludeExperiment,

    /* chiaroscuro */
    registerDirective,
    pickDirective,
};
