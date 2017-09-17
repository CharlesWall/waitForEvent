# wait-for-event-promise

A simple module that exposes a function used to wait for specific events
from an emitter.

## Installation

```bash
npm install wait-for-event-promise
```

## Usage

#### `waitForEvent(emitter: EventEmitter, eventName: String [, filter: Function, options: Object ])`

A minimal example:

```js
const waitForEvent = require('wait-for-event-promise');
const EventEmitter = require('events')

(async function () {
  // create event emitter
  const emitter = new EventEmitter();

  // create a promise for wait for a 'hello' event
  const helloPromise = waitForEvent(emitter, 'hello');

  // emit a hello event
  emitter.emit('hello', {
    message: 'world'
  });

  // promise will resolve with the data that was emit
  const event = await helloPromise; // { message: 'world' }
  console.log(event.message); // outputs: 'world'
})();
```

A function can be passed into to filter out events that you don't care about.

```js
const emitter = new EventEmitter();

const helloPromise = waitForEvent(emitter, 'hello', (event) => {
  return event === 'world';
});

emitter.emit('hello', 'bob');
// we don't care about bob, so helloPromise has not resolved yet

emitter.emit('hello', 'world');
// now helloPromise has resolved

const event = await helloPromise;
console.log(event); // outputs: 'world'
```

Alternatively, a filter can be provided as part of the `options` object.

```js
waitForEvent(emitter, 'hello', {
  filter: (value) => value === 'world'
});
```

A timeout can also be used to ensure you don't indefinitely wait on an event.
If the emitter does not emit the proper event before the timeout, the
promise will reject.

```js
const emitter = new EventEmitter();

// wait for 1000 ms before rejecting
const helloPromise = waitForEvent(emitter, 'hello', {
  timeout: 1000
});

try {
  await helloPromise;
} catch (err) {
  // after 1000 ms has passed
  console.err(err);  // err.message === "Timed out waiting for event"
}
```

A timeout can also be used with a filter function.

```js
waitForEvent(emitter, 'hello', (value) => {
  return event === 'hello';
}, { timeout: 1000 });

// alternatively, you can use supply the filter function in the options
waitForEvent(emitter, 'hello', {
  timeout: 1000,
  filter: (event) => event === 'world'
});
```

A logging function can be passed in to get more information about what
the module is doing.

```js
const helloPromise = waitForEvent(emitter, 'hello', {
  logger: console.debug.bind(console),
  filter: (event) => event === 'hello'
});

emitter.emit('hi');
emitter.emit('hey');
emitter.emit('yo');
emitter.emit('hello');
```

In your logs, you will see the following output:

```
Waiting for event: hello
Filtering for event: hello
Filtering for event: hello
Filtering for event: hello
Got matching event: hello
```
