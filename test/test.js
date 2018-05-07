const {EventEmitter} = require('events');
const waitForEvent = require('..');
const uuid = require('uuid');
const assert = require('assert');

describe('waitForEvent', () => {
  testWithEmitter('Event Emitter', EventEmitter);
  testWithEmitter('Browser Emitter', class BrowserEmitter {
    constructor() {
      this.eventEmitter = new EventEmitter();
    }
    addEventListener(eventName, handler) {
      this.eventEmitter.on(eventName, handler);
    }
    removeEventListener(eventName, handler) {
      this.eventEmitter.removeListener(eventName, handler);
    }
    removeAllListeners(eventName) {
      this.eventEmitter.removeListener(eventName);
    }
    dispatchEvent(event) {
      this.eventEmitter.emit(event.name, event);
    }
    get _eventsCount() {
      return this.eventEmitter._eventsCount;
    }
  });

  function testWithEmitter(suiteName, EventEmitter) {
    let eventEmitter;
    let eventName;
    let emittedEvent;

    function emit(eventEmitter, eventName, event) {
      if (typeof eventEmitter.emit === 'function') {
        eventEmitter.emit(eventName, event);
      } else if (typeof eventEmitter.dispatchEvent === 'function') {
        event.name = eventName;
        eventEmitter.dispatchEvent(event);
      } else {
        throw new Error('no event emitter to call');
      }
    }

    function assertEventListenerCleanup() {
      assert(eventEmitter._eventsCount === 0, 'eventEmitter was not cleaned up');
    }

    function shouldNotResolve(timeout, promise) {
      return new Promise((resolve, reject) => {
        promise.then((result) => {
          reject(new Error(`Expected to not resolve, but resolve with ${result}`));
        });
        setTimeout(resolve, timeout);
      });
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

    context(suiteName, () => {
      it('should resolve with the event that was emitted when the event is emitted', async () => {
        const [resultEvent] = await Promise.all([
          waitForEvent(eventEmitter, eventName),
          (async () => {
            emit(eventEmitter, eventName, emittedEvent);
          })()
        ]);

        assert(resultEvent === emittedEvent, 'did not receive the emitted event');
        assertEventListenerCleanup();
      });

      it('should not resolve if a different event is emitted', async () => {
        await Promise.all([
          shouldNotResolve(10, waitForEvent(eventEmitter, eventName)),
          (() => {
            emit(eventEmitter, 'this is not the event you are looking for', emittedEvent);
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
            (async () => { emit(eventEmitter, eventName, emittedEvent); })()
          ]);

          assert(filterEvent === emittedEvent, 'the event that was emitted was not passed into the filter');
          assertEventListenerCleanup();
        });

        it('should reject if the filter rejects', async () => {
          const filter = () => {
            throw new Error('this should fail');
          };
          const eventPromise = waitForEvent(eventEmitter, eventName, filter);
          await Promise.all([
            shouldReject(eventPromise, 'this should fail'),
            (() => { emit(eventEmitter, eventName, emittedEvent); })()
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
                (async () => { emit(eventEmitter, eventName, emittedEvent); })()
              ]);
              assert(resultEvent === emittedEvent, 'did not receive the emitted event');
              assertEventListenerCleanup();
            });

            it(`should resolve with the event when filter returns Promise(${truthyValue})`, async () => {
              let truePromiseFilter = async () => { return Promise.resolve(truthyValue); };
              const [resultEvent] = await Promise.all([
                waitForEvent(eventEmitter, eventName, truePromiseFilter),
                (async () => { emit(eventEmitter, eventName, emittedEvent); })()
              ]);
              assert(resultEvent === emittedEvent, 'did not receive the emitted event');
              assertEventListenerCleanup();
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
                (() => { emit(eventEmitter, eventName, emittedEvent); })()
              ]);
            });

            it(`should not resolve when filter returns Promise(${falsyValue})`, async () => {
              let falsePromiseFilter = async () => { return Promise.resolve(falsyValue); };
              await Promise.all([
                shouldNotResolve(10, waitForEvent(eventEmitter, eventName, falsePromiseFilter)),
                (() => { emit(eventEmitter, eventName, emittedEvent); })()
              ]);
            });
          });
        });
      });

      context('a timeout is passed in', () => {
        it('should reject if the event is not emitted before the timeout', async () => {
          const timeout = 100;
          setTimeout(() => {
            emit(eventEmitter, eventName, {});
          }, timeout + 10);
          const eventPromise = waitForEvent(eventEmitter, eventName, {timeout});
          await shouldReject(eventPromise, 'Timed out waiting for event');
        });
        it('should resolve if the event is emitted before the timeout', async () => {
          const timeout = 100;
          const eventName = 'timed event';
          setTimeout(() => {
            emit(eventEmitter, eventName, {});
          }, timeout - 10);
          await waitForEvent(eventEmitter, eventName, {timeout});
          assertEventListenerCleanup();
        });
      });

      context('debug messages', () => {
        let logs;
        let logger = message => { logs.push(message); };
        beforeEach(() => { logs = []; });

        context('with a filter', () => {
          const filter = event => { return event === emittedEvent; };
          it('should log debug messages', async () => {
            await Promise.all([
              waitForEvent(eventEmitter, eventName, { logger, filter}),
              (async () => {
                emit(eventEmitter, eventName, {});
                emit(eventEmitter, eventName, emittedEvent);
              })()
            ]);
            assert.equal(logs[0], `Waiting for event: ${eventName}`);
            assert.equal(logs[1], `Filtering for event: ${eventName}`);
            assert.equal(logs[2], `Filtering for event: ${eventName}`);
            assert.equal(logs[3], `Got matching event: ${eventName}`);
            assertEventListenerCleanup();
          });
        });
        context('without a filter', () => {
          it('should log debug messages', async () => {
            await Promise.all([
              waitForEvent(eventEmitter, eventName, { logger }),
              (async () => {
                emit(eventEmitter, eventName, emittedEvent);
              })()
            ]);
            assert.equal(logs[0], `Waiting for event: ${eventName}`);
            assert.equal(logs[1], `Got matching event: ${eventName}`);
            assertEventListenerCleanup();
          });
        });
      });
    });
  }
});
