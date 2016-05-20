import chai from 'chai';
import nock from 'nock';

import fetchMiddleware from '../';

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

    it('should fetch the specified resource', (done) => {
        nock('http://localhost').get('/test.json').reply(200, { data: true });

        const middleware = fetchMiddleware()({ getState: doGetState });
        const actionDefinition = {
            type: 'test',
            fetch: {
                url: 'http://localhost/test.json'
            }
        };

        const actionHandler = middleware(() => { });

        actionHandler(actionDefinition)
        .then(data => {
            data.should.be.a('object');
            data.data.should.equal(true);
            done();
        })
        .catch(done);
    });
});
