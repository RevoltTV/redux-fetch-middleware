import chai           from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock           from 'nock';
import sinon          from 'sinon';

import fetchMiddleware from '../';

chai.use(chaiAsPromised);
chai.should();

describe('redux-fetch-middleware', () => {
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

            return promise.should.be.fulfilled.and.
                           should.eventually.equal(true);
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
            return promise.should.be.fulfilled.
            then((data) => {
                actionDefinition.fetch.cache.calledOnce.should.equal(true);
                actionDefinition.fetch.cache.calledWith({}, actionDefinition).should.equal(true);

                data.data.should.equal(true);
                request.isDone().should.equal(true);
            });
        });
    });

    describe('basic requests', () => {
        it('should fetch the specified resource', () => {
            let request = nock('http://localhost').get('/test.json').reply(200, { data: true });

            // Pending event should fire first, so lets ensure we check both action types
            let pending = true;

            const middleware = fetchMiddleware()({ getState: doGetState });
            const actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/test.json'
                }
            };

            const actionHandler = middleware((action) => {
                if (pending) {
                    // The `PENDING` action should be sent first, so ensure that's what we receive, then flip pending so we
                    // can check the next action is the expected type
                    action.type.should.equal(`${actionDefinition.type}_PENDING`);
                    pending = false;
                } else {
                    // We've already received the `PENDING` action, so now we should receive the real action
                    action.type.should.equal(actionDefinition.type);
                }
            });

            let promise = actionHandler(actionDefinition);
            return promise.should.be.fulfilled.and.
                           should.eventually.be.a('object').and.
                           should.eventually.deep.equal({ data: true }).
            then(() => {
                pending.should.equal(false);
                request.isDone().should.equal(true);
            });
        });

        it('should send FAILURE action when statusCode is not an acceptable value', () => {
            let request = nock('http://localhost').get('/test.json').reply(404, 'Not found');

            let pending = true;

            const middleware = fetchMiddleware()({ getState: doGetState });
            const actionDefinition = {
                type: 'test',
                fetch: {
                    url: 'http://localhost/test.json'
                }
            };

            const actionHandler = middleware((action) => {
                if (pending) {
                    // The `PENDING` action should be sent first, so ensure that's what we receive, then flip pending so we
                    // can check the next action is the expected type
                    action.type.should.equal(`${actionDefinition.type}_PENDING`);
                    pending = false;
                } else {
                    // We've already received the `PENDING` action, so now we should receive the real action
                    action.type.should.equal(`${actionDefinition.type}_FAILURE`);
                }
            });

            let promise = actionHandler(actionDefinition);

            return promise.should.be.rejected.
            then((err) => {
                err.status.should.equal(404);
                err.response.should.be.a('object');
                err.response.statusText.should.equal('Not Found');
                pending.should.equal(false);
                request.isDone().should.equal(true);
            });
        });
    });
});
