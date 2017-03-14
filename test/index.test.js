import chai           from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock           from 'nock';
import sinon          from 'sinon';

import fetchMiddleware from '../';

chai.use(chaiAsPromised);
chai.should();

describe('redux-fetch-middleware', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    const doGetState = () => { return {}; };

    it('should do nothing if no fetch key is defined', (done) => {
        const middleware = fetchMiddleware()({ getState: doGetState });
        const actionDefinition = {
            type: 'fetch_test'
        };

        const actionHandler = middleware(action => {
            action.should.equal(actionDefinition);
            done();
        });

        actionHandler(actionDefinition);
    });

    describe('caching', () => {
        const middleware = fetchMiddleware()({ getState: doGetState });

        it('should call cache method if cache is specified', () => {
            let actionDefinition = {
                type: 'test',
                fetch: {
                    cache: (state, action) => {
                        state.should.be.a('object');
                        action.should.equal(actionDefinition);
                        return true;
                    }
                }
            };

            const actionHandler = middleware(action => {
                action.type.should.equal(actionDefinition.type);
            });

            let promise = actionHandler(actionDefinition);

            return promise.should.be.fulfilled.and
                          .should.eventually.equal(true);
        });

        it('should fetch if cache is specified but returns falsey value', () => {
            let request = nock('http://localhost').get('/test.json').reply(200, { data: true });

            let actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/test.json',
                    cache: sinon.stub().returns(null)
                }
            };

            const actionHandler = middleware(() => {});
            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                actionDefinition.fetch.cache.calledOnce.should.equal(true);
                actionDefinition.fetch.cache.calledWith({}, actionDefinition).should.equal(true);

                data.data.should.equal(true);
                request.isDone().should.equal(true);
            });
        });
    });

    describe('basic requests', () => {
        let pending;
        let actionDefinition;
        let middleware = fetchMiddleware()({ getState: doGetState });

        let actionVerifier = (action) => {
            if (pending) {
                // The `PENDING` action should be sent first, so ensure that's what we receive, then flip pending so
                // we can check the next action is the expected type
                action.type.should.equal(`${actionDefinition.type}_PENDING`);
                pending = false;
            } else {
                // We've already received the `PENDING` action, so now we should receive the real action
                action.type.should.equal(actionDefinition.type);
            }
        };

        beforeEach(() => {
            pending = true;
        });

        it('should fetch the specified resource', () => {
            let request = nock('http://localhost').get('/test.json').reply(200, { data: true });
            // Pending event should fire first, so lets ensure we check both action types

            actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/test.json'
                }
            };

            const actionHandler = middleware(actionVerifier);

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled.and
                          .should.eventually.be.a('object').and
                          .should.eventually.deep.equal({ data: true })
            .then(() => {
                pending.should.equal(false);
                request.isDone().should.equal(true);
            });
        });

        it('should send FAILURE action when statusCode is not an acceptable value', () => {
            let request = nock('http://localhost').get('/test.json').reply(404, 'Not found');

            actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/test.json'
                }
            };

            const actionHandler = middleware((action) => {
                if (pending) {
                    // The `PENDING` action should be sent first, so ensure that's what we receive, then flip pending so
                    // we can check the next action is the expected type
                    action.type.should.equal(`${actionDefinition.type}_PENDING`);
                    pending = false;
                } else {
                    // We've already received the `PENDING` action, so now we should receive the real action
                    action.type.should.equal(`${actionDefinition.type}_FAILURE`);
                }
            });

            let promise = actionHandler(actionDefinition);

            return promise.should.be.rejected
            .then((err) => {
                err.status.should.equal(404);
                err.response.should.be.a('object');
                err.response.statusText.should.equal('Not Found');
                pending.should.equal(false);
                request.isDone().should.equal(true);
            });
        });

        it('should include status and original action in the meta property of the action on FAILURE', () => {
            let request = nock('http://localhost').get('/test.json').reply(400, 'Bad Request');

            actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/test.json'
                }
            };

            const actionHandler = middleware((action) => {
                if (pending) {
                    action.type.should.equal(`${actionDefinition.type}_PENDING`);
                    pending = false;
                } else {
                    action.type.should.equal(`${actionDefinition.type}_FAILURE`);
                    action.meta.should.exist.and.be.a('object');
                    action.meta.status.should.equal(400);
                    action.meta.originalAction.should.deep.equal(actionDefinition);
                }
            });

            let promise = actionHandler(actionDefinition);

            return promise.should.be.rejected
            .then((err) => {
                err.status.should.equal(400);
                pending.should.equal(false);
                request.isDone().should.equal(true);
            });
        });

        it('should let method be specified for the fetch request', () => {
            let request = nock('http://localhost', {
                reqheaders: {
                    accept: 'application/json',
                    'content-type': 'application/json'
                }
            }).post('/api', { test: true }).reply(200, { test: true });

            actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/api',
                    method: 'POST'
                },
                payload: { test: true }
            };

            const actionHandler = middleware(actionVerifier);

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);
                request.isDone().should.equal(true);
            });
        });

        it('should allow for common headers to be specified in the config', () => {
            let request = nock('http://localhost', {
                reqheaders: {
                    'x-app-id': 'test'
                }
            }).get('/').reply(200, { test: true });

            actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/'
                }
            };

            const configMiddleware = fetchMiddleware({
                headers: {
                    'X-App-Id': 'test'
                }
            })({ getState: doGetState });
            const actionHandler = configMiddleware(actionVerifier);

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);
                request.isDone().should.equal(true);
            });
        });

        it('should allow for custom headers to be specified in fetch object', () => {
            let request = nock('http://localhost', {
                reqheaders: {
                    'x-app-id': 'test'
                }
            }).get('/').reply(200, { test: true });

            actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/',
                    headers: {
                        'X-App-Id': 'test'
                    }
                }
            };

            const actionHandler = middleware(actionVerifier);

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);
                request.isDone().should.equal(true);
            });
        });

        it('should merge headers from config and fetch object, preferring fetch header', () => {
            let request = nock('http://localhost', {
                reqheaders: {
                    'x-app-id': 'test',
                    'x-custom': 'test',
                    'x-config': 'test'
                }
            }).get('/').reply(200, { test: true });

            actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/',
                    headers: {
                        'X-App-Id': 'test',
                        'X-Custom': 'test'
                    }
                }
            };

            const configMiddleware = fetchMiddleware({
                headers: {
                    'X-App-Id': 'config test',
                    'X-Config': 'test'
                }
            })({ getState: doGetState });
            const actionHandler = configMiddleware(() => { });

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);
                request.isDone().should.equal(true);
            });
        });
    });

    describe('authenticated requests', () => {
        it('should use config auth function for specifying Authorization header', () => {
            let request = nock('http://localhost', {
                reqheaders: {
                    'authorization': 'Bearer test'
                }
            }).get('/').reply(200, { test: true });

            const actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/'
                }
            };

            const authFn = sinon.stub().returns('Bearer test');

            const middleware = fetchMiddleware({ auth: authFn })({ getState: doGetState });
            const actionHandler = middleware(() => {});

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);

                authFn.calledOnce.should.equal(true);
                authFn.firstCall.args[0].should.deep.equal({});
                authFn.firstCall.args[1].should.equal(actionDefinition);

                request.isDone().should.equal(true);
            });
        });

        it('should not use Authorization header if auth function returns falsey value', () => {
            let request = nock('http://localhost', {
                badheaders: ['authorization']
            }).get('/').reply(200, { test: true });

            const actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/'
                }
            };

            const authFn = sinon.stub().returns('');

            const middleware = fetchMiddleware({ auth: authFn })({ getState: doGetState });
            const actionHandler = middleware(() => {});

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);

                authFn.calledOnce.should.equal(true);
                authFn.firstCall.args[0].should.deep.equal({});
                authFn.firstCall.args[1].should.equal(actionDefinition);

                request.isDone().should.equal(true);
            });
        });

        it('should use fetch object auth function if specified', () => {
            let request = nock('http://localhost', {
                reqheaders: {
                    'authorization': 'Bearer test'
                }
            }).get('/').reply(200, { test: true });

            const configAuthFn = sinon.stub().returns('Bearer badtest');
            const fetchAuthFn = sinon.stub().returns('Bearer test');

            const actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/',
                    auth: fetchAuthFn
                }
            };

            const middleware = fetchMiddleware({ auth: configAuthFn })({ getState: doGetState });
            const actionHandler = middleware(() => {});

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);

                configAuthFn.called.should.equal(false);

                fetchAuthFn.calledOnce.should.equal(true);
                fetchAuthFn.firstCall.args[0].should.deep.equal({});
                fetchAuthFn.firstCall.args[1].should.equal(actionDefinition);

                request.isDone().should.equal(true);
            });
        });

        it('should not include Authorization header if neither fetch nor config specify a function', () => {
            let request = nock('http://localhost', {
                badheaders: ['authorization']
            }).get('/').reply(200, { test: true });

            const actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/'
                }
            };

            const middleware = fetchMiddleware({ auth: true })({ getState: doGetState });
            const actionHandler = middleware(() => {});

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);

                request.isDone().should.equal(true);
            });
        });

        it('should not include Authorization header if fetch explicitly sets auth to false', () => {
            let request = nock('http://localhost', {
                badheaders: ['authorization']
            }).get('/').reply(200, { test: true });

            const actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/',
                    auth: false
                }
            };

            const middleware = fetchMiddleware({ auth: () => { return 'Authorization'; } })({ getState: doGetState });
            const actionHandler = middleware(() => {});

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled
            .then((data) => {
                data.should.be.a('object');
                data.test.should.equal(true);

                request.isDone().should.equal(true);
            });
        });
    });
});
