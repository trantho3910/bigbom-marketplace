import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
//import { logger } from 'redux-logger';
import createBrowserHistory from 'history/createBrowserHistory';

import rootReducer from '../reducers';
import rootSaga from '../sagas';

const sagaMiddleware = createSagaMiddleware();

export const browserHistory = createBrowserHistory();
export const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));

const storeConfig = () => {
    return { ...store, runSaga: sagaMiddleware.run(rootSaga) };
};

export default storeConfig;
