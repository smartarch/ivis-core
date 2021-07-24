'use strict';

function usernameValid(username) {
    return /^[a-zA-Z0-9][a-zA-Z0-9_\-.]*$/.test(username);
}

function isSignalSetAggregationIntervalValid(intervalStr) {
    return /^[1-9]\d*[smhd]$/.test(intervalStr);
}

/**
 * Checks whether the given token is valid Elasticsearch 6.x Date histogram
 * interval. Since 7.x, interval field is deprecated and replaced with
 * calendar_interval and fixed_interval.
 * see: https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-aggregations-bucket-datehistogram-aggregation.html
 * @param {string} token
 * @returns {bool} true if valid
 */
function isValidEsInterval(token) {
    const singles = /^1(ms|s|m|h|d|w|M|q|y)$/;
    const multiples = /^([1-9][0-9]+|[2-9])(ms|s|m|h|d)$/;

    return (singles.test(token) || multiples.test(token));
}

/**
 * Checks whether the given token is valid Elasticsearch 7.x Date histogram
 * fixed_interval.
 * see: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html
 * @param {string} token
 * @returns {bool} true if valid
 */
function isValidEsFixedInterval(token) {
    const fixed = /^[1-9][0-9]*(ms|s|m|h|d)$/;

    return fixed.test(token);
}

/**
 * Checks whether the given token is valid Elasticsearch 7.x Date histogram
 * calendar_interval.
 * see: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html
 * @param {string} token
 * @returns {bool} true if valid
 */
function isValidEsCalendarInterval(token) {
    const calendar = /^1(m|h|d|w|M|q|y)$/;

    return calendar.test(token);
}


module.exports = {
    usernameValid,
    isSignalSetAggregationIntervalValid,
    isValidEsInterval,
    isValidEsFixedInterval,
    isValidEsCalendarInterval,
};
