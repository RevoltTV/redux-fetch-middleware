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
        promise = Promise.resolve(cached);
    } else {
        let headers = {};
        if (action.fetch.auth && config.auth) {
            // Allow the config object to specify the Authorization header, or
            // specify a function to get the Authorization header from state
            let authFn = _.isFunction(config.auth) ? config.auth : _.noop;
            if (_.isFunction(action.fetch.auth)) {
                authFn = action.fetch.auth;
            }

            headers['Authorization'] = authFn(state, action);
        }

        let options = {
            credentials: config.credentials || 'include',
            headers: _.extend(headers, action.fetch.headers),
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
                log(`FAILURE: ${options.method} :: ${action.fetch.url} (${response.status})`);
                let error = new Error(response.statusText);
                error.status = response.status;
                error.response = response;
                throw error;
            }
        })
        .catch(err => {
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
