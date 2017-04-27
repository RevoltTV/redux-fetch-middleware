import _     from 'lodash';
import debug from 'debug';
import fetch from 'isomorphic-fetch';

const log = debug('@revolttv:redux-fetch-middleware');

const determineContentType = (payload) => {
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
        // We return null because the browser will automatically determine the Content-Type and add the proper
        // multipart boundaries
        return null;
    }

    return 'application/json';
};

const lowercaseHeaders = (obj) => {
    return _.mapKeys(obj, (value, key) => key.toLowerCase());
};

const middleware = (config = {}) => (store) => (next) => (action) => {
    if (!action.fetch) {
        return next(action);
    }

    const state = store.getState();
    let cached;
    let promise;

    if (_.isFunction(action.fetch.cache) && (cached = action.fetch.cache(state, action))) {
        // The `action.api` definition specified how to retrieve an already
        // fetched value. If that method also returns data, we assume that the
        // state is already populated with the response for the current request
        log('retrieved value from cache', action, cached);
        promise = Promise.resolve(cached);
    } else {
        let headers = {};
        if (action.fetch.auth !== false && (action.fetch.auth || config.auth)) {
            // Allow the config object to specify the Authorization header, or
            // specify a function to get the Authorization header from state
            let authFn = _.isFunction(config.auth) ? config.auth : _.noop;
            if (_.isFunction(action.fetch.auth)) {
                authFn = action.fetch.auth;
            }

            log('applying auth header');
            let authHeader = authFn(state, action);
            if (authHeader) {
                headers['authorization'] = authHeader;
            }
        }

        let options = {
            credentials: action.fetch.credentials || config.credentials || 'omit',
            headers: _.extend(lowercaseHeaders(headers), lowercaseHeaders(config.headers), lowercaseHeaders(action.fetch.headers)),
            method: action.fetch.method || 'GET'
        };

        if (options.method.toUpperCase() !== 'GET' && action.payload) {
            options.headers['accept'] = options.headers['accept'] || 'application/json';
            options.headers['content-type'] = options.headers['content-type'] || determineContentType(action.payload);
            options.body = action.payload;

            if (options.headers['content-type'] === 'application/json') {
                options.body = JSON.stringify(options.body);
            } else if (!options.headers['content-type']) {
                delete options.headers['content-type'];
            }
        }

        promise = fetch(action.fetch.url, options)
        .then(response => {
            if (response.status >= 200 && response.status < 300) {
                log(`${options.method} :: ${action.fetch.url}`);
                return response.json();
            } else {
                let error = new Error(response.statusText);
                error.status = response.status;
                error.response = response;
                throw error;
            }
        })
        .catch(err => {
            log(`FAILURE: ${options.method} :: ${action.fetch.url} (${_.get(err, 'response.status', 500)})`);

            return err.response.json()
            .then((body) => {
                err.body = body;
                next({
                    type: `${action.type}_FAILURE`,
                    payload: err,
                    error: true,
                    meta: {
                        originalAction: action,
                        promise,
                        status: _.get(err, 'response.status', 500)
                    }
                });

                throw err;
            });
        });

        log(`PENDING: ${options.method} :: ${action.fetch.url}`);
        next({
            type: `${action.type}_PENDING`,
            payload: action,
            meta: {
                promise
            }
        });
    }

    return promise.then(body => {
        next({
            type: action.type,
            payload: body,
            meta: {
                action,
                promise
            }
        });

        return body;
    });
};

export default middleware;
