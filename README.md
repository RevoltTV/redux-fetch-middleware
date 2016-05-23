# redux-fetch-middleware

[![Build Status](https://travis-ci.org/RevoltTV/redux-fetch-middleware.svg?branch=master)](https://travis-ci.org/RevoltTV/redux-fetch-middleware)
[![Coverage Status](https://coveralls.io/repos/github/RevoltTV/redux-fetch-middleware/badge.svg?branch=master)](https://coveralls.io/github/RevoltTV/redux-fetch-middleware?branch=master)

A middleware for Redux that uses `isomorphic-fetch` to perform network requests

# Usage

Install the package

```
npm install --save @revolttv/redux-fetch-middleware
```

Create the middleware, and then apply it to your store

```
import { applyMiddleware, createStore } from 'redux';
import FetchMiddleware from '@revolttv/redux-fetch-middleware';

let fetchMiddleware = FetchMiddleware({
    // Config
});
let store = createStore(reducers, initialState, applyMiddleware(fetchMiddleware));
```

Specify actions that leverage the middleware

```
function getUser(userId) {
    return {
        type: 'GET_USER',
        fetch: {
            url: `https://example.com/api/users/${userId}`,
            method: 'GET',
            headers: {
                'X-Application-Id': 'abc123'
            },
            auth: (state) => { return `Bearer ${state.auth.token}`; }
        }
    };
}
```

While a request is in flight, an action is emitted in the form of `${action.type}_PENDING`. For example, the action
`GET_USER` would produce an action `GET_USER_PENDING`, with a `payload` of the original action.

If the request completes successfully, the original action is dispatched (`GET_USER`), with the response body in
the payload.

If the request fails (either connection error or HTTP error code returned), then an action in the form of
`${action.type}_FAILURE` is dispatched, with a key `error: true`, and the `payload` being the received error.

## Configuration

When creating the middleware, a configuration object can be passed in to provide some defaults

```
{
    // Specify how the Authorization header is constructed
    auth: (state, action) => { return state.auth.token; },

    // Custom headers that will be applied to all requests
    headers: {
        'X-Your-Header': 'Header Value'
    },

    // How to deal with cookies (see fetch specification)
    credentials: 'include' || 'same-origin' || 'omit'

}
```
