import { Client, Server, WebSocket } from 'mock-socket';

import { OutgoingRequest, RequestSuccessResponse, RequestErrorResponse } from '../../types/api_internal.js';
import { EventEmitter } from 'events';
import { DEFAULT_CONNECT_PARAMS } from './mock-data.js';

interface MockFunctionCreator {
  fn: (...args: any[]) => any;
};

type RequestCallback = (requestData: object) => void;

const toEmitId = (path: string, method: string) => {
  return `${path}_${method}`;
};

const getDefaultMockCreatorF = () => ({
  fn: () => {},
});

interface MockServerOptions {
  url: string;
  reportMissingListeners?: boolean;
  mockF: MockFunctionCreator;
}

const DEFAULT_MOCK_SERVER_OPTIONS: MockServerOptions = {
  url: DEFAULT_CONNECT_PARAMS.url,
  reportMissingListeners: true,
  mockF: getDefaultMockCreatorF(),
}

type MockRequestResponseDataObject<DataT extends object | undefined> = Omit<RequestSuccessResponse<DataT>, 'callback_id'> | Omit<RequestErrorResponse, 'callback_id'>;
type MockRequestResponseDataHandler<DataT extends object | undefined> = (request: OutgoingRequest, s: WebSocket) => MockRequestResponseDataObject<DataT>;
type MockRequestResponseData<DataT extends object | undefined> = MockRequestResponseDataObject<DataT> | MockRequestResponseDataHandler<DataT>;

const getMockServer = (initialOptions: Partial<MockServerOptions> = {}) => {
  const { url, reportMissingListeners, mockF }: MockServerOptions = {
    ...DEFAULT_MOCK_SERVER_OPTIONS,
    ...initialOptions,
  };

  const mockServer = new Server(url);
  let socket: Client;
  const emitter = new EventEmitter();

  const send = (data: object) => {
    socket.send(JSON.stringify(data));
  };

  const addServerHandler = <DataT extends object | undefined>(
    method: string, 
    path: string, 
    responseData: MockRequestResponseData<DataT>,
    subscriptionCallback?: RequestCallback
  ) => {
    emitter.addListener(
      toEmitId(path, method), 
      (request: OutgoingRequest, s: WebSocket) => {
        if (subscriptionCallback) {
          subscriptionCallback(request);
        }

        const data = typeof responseData === 'function' ? responseData(request, s) : responseData;
        if (!data ||!data.code) {
          throw new Error(`Mock server: response handler for path ${path} must return a status code`);
        }

        const response: RequestSuccessResponse | RequestErrorResponse = {
          callback_id: request.callback_id,
          ...data,
        };

        s.send(JSON.stringify(response));
      }
    );
  };

  const addDummyDataHandler = (method: string, path: string) => {
    emitter.addListener(
      toEmitId(path, method), 
      (request: OutgoingRequest, s: WebSocket) => {
        // Do nothing
      }
    );
  }

  const addRequestHandler = <DataT extends object | undefined>(
    method: string, 
    path: string, 
    data?: DataT | MockRequestResponseDataHandler<DataT>, 
    subscriptionCallback?: RequestCallback
  ) => {
    const handlerData = typeof data === 'function' ? data : {
      data,
      code: data ? 200 : 204,
    }

    addServerHandler<DataT>(
      method, 
      path, 
      handlerData, 
      subscriptionCallback
    );
  }

  const addErrorHandler = (
    method: string, 
    path: string, 
    errorStr: string | null, 
    errorCode: number, 
    subscriptionCallback?: RequestCallback
  ) => {
    addServerHandler(
      method, 
      path, 
      {
        error: !errorStr ? null as any : {
          message: errorStr,
        },
        code: errorCode,
      }, 
      subscriptionCallback
    );
  }

  const addSubscriptionHandlerImpl = (
    moduleName: string,
    type: string,
    listenerName: string,
    entityId?: string | number,
  ) => {
    const subscribeFn = mockF.fn();
    const unsubscribeFn = mockF.fn();

    const path = entityId ? `${moduleName}/${entityId}/${type}/${listenerName}` : `${moduleName}/${type}/${listenerName}`;

    addRequestHandler('POST', path, undefined, subscribeFn);
    addRequestHandler('DELETE', path, undefined, unsubscribeFn);

    const fire = (data: object, entityId?: string | number) => {
      send({
        event: listenerName,
        data,
        id: entityId,
      });
    }

    return {
      fire,

      subscribeFn,
      unsubscribeFn,

      path,
    }
  }
  

  const addSubscriptionHandler = (
    moduleName: string,
    listenerName: string,
    entityId?: string | number,
  ) => {
    return addSubscriptionHandlerImpl(moduleName, 'listeners', listenerName, entityId);
  }

  const addHookHandler = (
    moduleName: string,
    listenerName: string,
  ) => {
    const subscriber = addSubscriptionHandlerImpl(moduleName, 'hooks', listenerName);

    const addResolver = (completionId: number) => {
      const resolveFn = mockF.fn();
      const rejectFn = mockF.fn();

      addRequestHandler(
        'POST', 
        `${subscriber.path}/${completionId}/resolve`, 
        undefined, 
        resolveFn
      );

      addRequestHandler(
        'POST', 
        `${subscriber.path}/${completionId}/reject`, 
        undefined, 
        rejectFn
      );

      const fire = (data: object) => {
        send({
          event: listenerName,
          data,
          completion_id: completionId,
        });
      }

      return { fire, resolveFn, rejectFn };
    };

    return {
      addResolver,

      ...subscriber,
    }
  }


  mockServer.on('connection', s => {
    socket = s;

    socket.on('message', (messageObj) => {
      const request: OutgoingRequest = JSON.parse(messageObj as string);
      const emitId = toEmitId(request.path, request.method);
      const processed = emitter.emit(emitId, request, s);
      if (reportMissingListeners && !processed) {
        console.warn(`Mock server: no listeners for event ${request.method} ${request.path}`);
      }
    });
  });

  mockServer.on('close', () => {
    emitter.removeAllListeners();
  });

  return {
    addRequestHandler,
    addErrorHandler,

    addSubscriptionHandler,
    addHookHandler,

    ignoreMissingHandler: addDummyDataHandler,
    stop: () => {
      mockServer.stop(() => {
        // ...
      });
    },
    send,
    url,
  };
};

export { getMockServer };