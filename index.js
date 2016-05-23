import _     from 'lodash';
import debug from 'debug';
import fetch from 'isomorphic-fetch';

const log = debug('@revolttv:redux-fetch-middleware');
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
        if (action.fetch.auth || config.auth) {
            // Allow the config object to specify the Authorization header, or
            // specify a function to get the Authorization header from state
            let authFn = _.isFunction(config.auth) ? config.auth : _.noop;
            if (_.isFunction(action.fetch.auth)) {
                authFn = action.fetch.auth;
            }

            log('applying auth header');
            let authHeader = authFn(state, action);
            if (authHeader) {
                headers['Authorization'] = authHeader;
            }
        }

        let options = {
            credentials: action.fetch.credentials || config.credentials || 'omit',
            headers: _.extend(headers, config.headers, action.fetch.headers),
            method: action.fetch.method || 'GET'
        };

        if (options.method.toUpperCase() !== 'GET' && action.payload) {
            options.headers['Accept'] = 'application/json';
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(action.payload);
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

            next({
                type: `${action.type}_FAILURE`,
                payload: err,
                promise
            });

            throw err;
        });

        next({
            type: `${action.type}_PENDING`,
            payload: action,
            promise
        });
    }

    return promise.then(body => {
        next({
            type: action.type,
            payload: body,
            promise
        });

        return body;
    });
};

export default middleware;
