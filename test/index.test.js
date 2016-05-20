import chai           from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock           from 'nock';

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

    it('should call cache method if cache is specified', (done) => {
        const middleware = fetchMiddleware()({ getState: doGetState });
        const actionDefinition = {
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

        actionHandler(actionDefinition)
        .then(data => {
            data.should.equal(true);
            done();
        })
        .catch(done);
    });

    it('should fetch the specified resource', () => {
        nock('http://localhost').get('/test.json').reply(200, { data: true });

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
        });
    });

    it('should send FAILURE action when statusCode is not an acceptable value', () => {
        nock('http://localhost').get('/test.json').reply(404, 'Not found');

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
        });
    });
});
