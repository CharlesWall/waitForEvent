const {EventEmitter} = require('events');
const waitForEvent = require('..');
const uuid = require('uuid');
const assert = require('assert');

describe('waitForEvent', () => {
  let eventEmitter;
  let eventName;
  let emittedEvent;

  function assertEventListenerCleanup() {
    assert(eventEmitter._eventsCount === 0, 'eventEmitter was not cleaned up');
  }

  function shouldNotResolve(timeout, promise) {
    return new Promise((resolve, reject) => {
      promise.then((result) => {
        reject(new Error(`Expected to not resolve, but resolve with ${result}`));
      });
      setTimeout(resolve, timeout);
    }).then(() => { eventEmitter.removeAllListeners(eventName); });
  }

  function shouldReject(promise, expectedErrorMessage) {
    return promise
      .then(() => {
        throw new Error('this should not have resolved');
      })
      .catch(error => {
        assert.equal(error.message, expectedErrorMessage);
        return error;
      });
  }

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    eventName = uuid.v4();
    emittedEvent = {};
  });

  afterEach(() => {
    assertEventListenerCleanup();
  });

  it('should resolve with the event that was emitted when the event is emitted', async () => {
    const [resultEvent] = await Promise.all([
      waitForEvent(eventEmitter, eventName),
      (async () => { 
        eventEmitter.emit(eventName, emittedEvent); 
      })()
    ]);

    assert(resultEvent === emittedEvent, 'did not receive the emitted event');
  });

  it('should not resolve if a different event is emitted', async () => {
    await Promise.all([
      shouldNotResolve(10, waitForEvent(eventEmitter, eventName)),
      (() => { 
        eventEmitter.emit('this is not the event you are looking for', emittedEvent); 
      })()
    ]);
  });

  it('should not resolve if no event is emitted', async () => {
    await shouldNotResolve(10, waitForEvent(eventEmitter, eventName));
  });

  context('a filter function is passed in', () => {
    it('should pass the event into the filter function', async () => {
      let filterEvent;
      const filter = event => { 
        filterEvent = event; 
        return true;
      };
      await Promise.all([
        waitForEvent(eventEmitter, eventName, filter),
        (async () => { eventEmitter.emit(eventName, emittedEvent); })()
      ]);

      assert(filterEvent === emittedEvent, 'the event that was emitted was not passed into the filter');
    });

    it('should reject if the filter rejects', async () => {
      const filter = () => { 
        throw new Error('this should fail');
      };
      const eventPromise = waitForEvent(eventEmitter, eventName, filter);
      await Promise.all([
        shouldReject(eventPromise, 'this should fail'),
        (() => { eventEmitter.emit(eventName, emittedEvent); })()
      ]);
    });
    
    context('filter function returns a truthy value or promise', () => {
      [ 
        true,
        1,
        100, 
        'truthy',
      ].forEach(truthyValue => {

        it(`should resolve with the event when filter returns ${truthyValue}`, async () => {
          let truePromiseFilter = async () => { return truthyValue; };
          const [resultEvent] = await Promise.all([
            waitForEvent(eventEmitter, eventName, truePromiseFilter),
            (async () => { eventEmitter.emit(eventName, emittedEvent); })()
          ]);
          assert(resultEvent === emittedEvent, 'did not receive the emitted event');
        });

        it(`should resolve with the event when filter returns Promise(${truthyValue})`, async () => {
          let truePromiseFilter = async () => { return Promise.resolve(truthyValue); };
          const [resultEvent] = await Promise.all([
            waitForEvent(eventEmitter, eventName, truePromiseFilter),
            (async () => { eventEmitter.emit(eventName, emittedEvent); })()
          ]);
          assert(resultEvent === emittedEvent, 'did not receive the emitted event');
        });
      });
    });

    context('filter function returns a falsy value or promise', () => {
      [ 
        false, 
        0, 
        '', 
        null, 
        undefined,
      ].forEach((falsyValue) => {
        it(`should not resolve when filter returns ${falsyValue}`, async () => {
          let falsePromiseFilter = async () => { return falsyValue; };
          await Promise.all([
            shouldNotResolve(10, waitForEvent(eventEmitter, eventName, falsePromiseFilter)),
            (() => { eventEmitter.emit(eventName, emittedEvent); })()
          ]);
        });

        it(`should not resolve when filter returns Promise(${falsyValue})`, async () => {
          let falsePromiseFilter = async () => { return Promise.resolve(falsyValue); };
          await Promise.all([
            shouldNotResolve(10, waitForEvent(eventEmitter, eventName, falsePromiseFilter)),
            (() => { eventEmitter.emit(eventName, emittedEvent); })()
          ]);
        });
      });
    });
  });

  context('a timeout is passed in', () => {
    it('should reject if the event is not emitted before the timeout', async () => {
      const timeout = 100;
      const eventName = 'timed event';
      setTimeout(() => { 
        eventEmitter.emit(eventName, {});
      }, timeout + 10);
      const eventPromise = waitForEvent(eventEmitter, eventName, {timeout});
      await shouldReject(eventPromise, 'Timed out waiting for event');
    });
    it('should resolve if the event is emitted before the timeout', async () => {
      const timeout = 100;
      const eventName = 'timed event';
      setTimeout(() => { 
        eventEmitter.emit(eventName, {});
      }, timeout - 10);
      await waitForEvent(eventEmitter, eventName, {timeout});
    });
  });

  context('future', () => {
    context.skip('debug messages', () => {
      it('should emit a debug message when listening starts');
      it('should emit a debug message when an unsuccessful filter calls is made');
      it('should emit a debug message when a successful filter calls is made');
      it('should emit a debug message when it resolves');
    });
    context.skip('add a README.txt');
  });
});
